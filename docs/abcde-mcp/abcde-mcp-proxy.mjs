// Dedicated machine-endpoint proxy for the separate abcde.lv project.
// Mount BEFORE body parsers, compression, auth, language redirects and HTML fallback.
// The page proxy is intentionally separate. This module uses only Node built-ins.
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const defaultUpstream = 'https://abcde-mcp.replit.app/mcp';
const requestHeaders = [
  'accept', 'content-type', 'origin', 'mcp-protocol-version', 'mcp-session-id',
  'mcp-method', 'mcp-name', 'last-event-id',
];
const responseHeaders = [
  'content-type', 'mcp-protocol-version', 'mcp-session-id', 'allow', 'retry-after',
  'www-authenticate',
];
const methods = ['POST', 'GET', 'DELETE', 'HEAD', 'OPTIONS'];
const maxRequestBytes = 32 * 1024;

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

function readBody(req, signal) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    const cleanup = () => {
      req.off('data', data);
      req.off('end', end);
      req.off('error', error);
      signal.removeEventListener('abort', abort);
    };
    const error = (cause) => { cleanup(); reject(cause); };
    const abort = () => error(signal.reason);
    const end = () => { cleanup(); resolve(Buffer.concat(chunks)); };
    const data = (chunk) => {
      size += chunk.length;
      if (size > maxRequestBytes) {
        error(failure(413, 'Request body is too large.'));
        req.resume();
      } else chunks.push(chunk);
    };
    if (signal.aborted) return reject(signal.reason);
    req.on('data', data);
    req.once('end', end);
    req.once('error', error);
    signal.addEventListener('abort', abort, { once: true });
  });
}

function validOrigin(value, allowed) {
  if (value === undefined) return true; // Non-browser MCP clients need no Origin.
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return !url.username && !url.password && url.origin === value &&
      allowed.has(url.origin);
  } catch { return false; }
}

export function createMcpProxy({
  upstreamUrl = defaultUpstream,
  allowedHosts = ['abcde.lv'],
  allowedOrigins = [
    'https://abcde.lv', 'https://abcde-mcp.replit.app',
    'https://claude.ai', 'https://claude.com', 'https://www.claude.com',
  ],
  timeoutMs = 45_000,
  maxResponseBytes = 4 * 1024 * 1024,
} = {}) {
  // Options are trusted server configuration only, never request-derived.
  const target = new URL(upstreamUrl);
  const localFixture = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if ((target.protocol !== 'https:' && !(target.protocol === 'http:' && localFixture)) ||
      target.username || target.password || target.pathname !== '/mcp' ||
      target.search || target.hash) throw new Error('Invalid fixed MCP upstream');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 120_000 ||
      !Number.isSafeInteger(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error('Invalid MCP proxy bounds');
  }
  const hosts = new Set(allowedHosts);
  const origins = new Set(allowedOrigins);

  return async function proxyMcp(req, res) {
    const rawPath = (req.url ?? '').split('?')[0];
    if (rawPath !== '/mcp') return false; // No prefix, slash or language redirects.
    const respond = (status, message) => {
      req.resume(); // Drain rejected input without retaining it.
      if (res.destroyed || res.headersSent) return;
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        ...(status === 405 ? { Allow: methods.join(', ') } : {}),
      });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({
        jsonrpc: '2.0', error: { code: -32603, message }, id: null,
      }));
    };
    let host;
    try {
      const value = req.headers.host;
      const parsed = new URL(`http://${value}`);
      if (!value || parsed.host !== value.toLowerCase() || parsed.username || parsed.password) throw Error();
      host = parsed.hostname;
    } catch { respond(403, 'Invalid Host.'); return true; }
    if (!hosts.has(host) || !validOrigin(req.headers.origin, origins)) {
      respond(403, 'Host or Origin is not allowed.'); return true;
    }
    if (!methods.includes(req.method)) { respond(405, 'Method not allowed.'); return true; }
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id, Mcp-Protocol-Version, Retry-After, Allow');
    }
    if (req.method === 'OPTIONS') {
      req.resume();
      res.writeHead(204, {
        'Cache-Control': 'no-store', Allow: methods.join(', '),
        'Access-Control-Allow-Methods': methods.join(', '),
        'Access-Control-Allow-Headers': requestHeaders.join(', '),
      });
      res.end();
      return true;
    }
    // Avoid silently forwarding an empty body after framework middleware consumed it.
    if (req.body !== undefined || req.readableEnded) {
      respond(500, 'MCP proxy must run before body parsers.'); return true;
    }
    const declaredLength = req.headers['content-length'];
    if (declaredLength !== undefined && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxRequestBytes)) {
      respond(413, 'Request body is too large.'); return true;
    }
    if (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity') {
      respond(415, 'Compressed request bodies are not supported.'); return true;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(failure(504, 'MCP upstream timed out.')), timeoutMs);
    const disconnected = () => {
      if (!res.writableEnded) controller.abort(failure(499, 'Client disconnected.'));
    };
    req.once('aborted', disconnected);
    res.once('close', disconnected);
    try {
      // Only the small request is buffered, byte-for-byte, never parsed or logged.
      const body = await readBody(req, controller.signal);
      const headers = {};
      for (const name of requestHeaders) {
        if (typeof req.headers[name] === 'string') headers[name] = req.headers[name];
      }
      // Do not copy Host, cookies, Authorization, X-Forwarded-* or target parameters.
      headers['accept-encoding'] = 'identity';
      headers['content-length'] = String(body.length);
      const send = target.protocol === 'https:' ? httpsRequest : httpRequest;
      const incoming = await new Promise((resolve, reject) => {
        const outgoing = send(target, { method: req.method, headers, signal: controller.signal }, resolve);
        outgoing.once('error', reject);
        outgoing.end(body);
      });
      const status = incoming.statusCode ?? 502;
      const type = incoming.headers['content-type'] ?? '';
      if ((status >= 300 && status < 400) || /text\/html/i.test(type) ||
          (status >= 200 && status < 300 && ![202, 204].includes(status) &&
            !/^(application\/json|text\/event-stream)(?:;|$)/i.test(type)) ||
          (incoming.headers['content-encoding'] && incoming.headers['content-encoding'] !== 'identity')) {
        incoming.destroy();
        throw failure(502, 'Invalid MCP upstream response.');
      }
      const outgoingHeaders = {
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no',
      };
      for (const name of responseHeaders) {
        if (incoming.headers[name] !== undefined) outgoingHeaders[name] = incoming.headers[name];
      }
      res.writeHead(status, outgoingHeaders);
      res.flushHeaders();
      let transferred = 0;
      const bound = new Transform({
        transform(chunk, _encoding, callback) {
          transferred += chunk.length;
          callback(transferred > maxResponseBytes ? failure(502, 'MCP response is too large.') : null,
            transferred > maxResponseBytes ? undefined : chunk);
        },
      });
      // Pipeline preserves backpressure and destroys upstream on client disconnect.
      // Never accumulate SSE or JSON responses into a whole-response buffer.
      await pipeline(incoming, bound, res, { signal: controller.signal });
    } catch (error) {
      if (res.headersSent) {
        if (!res.destroyed) res.destroy();
      } else if (!res.destroyed) {
        const cause = controller.signal.aborted ? controller.signal.reason : error;
        const status = [413, 504].includes(cause?.status) ? cause.status : 502;
        respond(status, status === 413 ? 'Request body is too large.' :
          status === 504 ? 'MCP upstream timed out.' : 'MCP upstream is unavailable.');
      }
    } finally {
      clearTimeout(timer);
      req.off('aborted', disconnected);
      res.off('close', disconnected);
    }
    return true;
  };
}
