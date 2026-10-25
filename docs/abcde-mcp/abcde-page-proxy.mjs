// Framework-neutral Node middleware reference for the OTHER (abcde.lv) project.
// Copy this file there, inspect its framework, and mount before its SPA fallback.
// Default upstream verified via deployment metadata on 2026-10-25.
const defaultUpstream = 'https://abcde-mcp.replit.app';
const pages = new Set(['/lv/mcp', '/en/mcp', '/lv/mcp/', '/en/mcp/',
  '/lv/mcp/index.html', '/en/mcp/index.html']);
const documents = new Set(['/mcp-site/content/lv.md', '/mcp-site/content/en.md',
  '/mcp-site/llms.txt', '/mcp-site/sitemap.xml', '/mcp-site/robots.txt',
  '/mcp-site/favicon.svg', '/mcp-site/stats']);

export function isMcpPagePath(path) {
  return pages.has(path) || path.startsWith('/mcp-site/');
}

export function createMcpPageProxy({ upstreamOrigin = defaultUpstream } = {}) {
  // Server-owned configuration only. Never read this from a request/query/header.
  const origin = new URL(upstreamOrigin);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) throw Error('Invalid upstream origin');
  return async function proxyMcpPage(req, res) {
    const rawUrl = req.url ?? '/';
    const [pathname] = rawUrl.split('?');
    if (!isMcpPagePath(pathname)) return false;
    const send = (status, message) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : message);
      return true;
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, 'Method not allowed\n');
    }
    const asset = /^\/mcp-site\/assets\/[a-zA-Z0-9_-][a-zA-Z0-9_.-]*$/.test(pathname);
    if (!pages.has(pathname) && !documents.has(pathname) && !asset) return send(404, 'Not found\n');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
      const destination = new URL(pathname, origin);
      // All query parameters are intentionally ignored. Neither destination nor
      // auth can be influenced by the caller; no browser cookies are forwarded.
      const response = await fetch(destination, {
        method: req.method, redirect: 'manual', signal: controller.signal,
        headers: { Accept: pathname === '/mcp-site/stats' ? 'application/json' : '*/*' },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) throw Error('Missing redirect');
        const redirect = new URL(location, destination);
        if (redirect.origin !== origin.origin || !pages.has(redirect.pathname)) throw Error('Unsafe redirect');
        res.writeHead(response.status, { Location: `${redirect.pathname}${redirect.search}`,
          'Cache-Control': 'no-store' });
        res.end();
        return true;
      }
      const chunks = [];
      let size = 0;
      if (req.method !== 'HEAD' && response.body) {
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 4 * 1024 * 1024) throw Error('Upstream body too large');
          chunks.push(Buffer.from(chunk));
        }
      }
      const body = Buffer.concat(chunks);
      const headers = {
        'Content-Type': response.headers.get('content-type') ?? 'application/octet-stream',
        'Cache-Control': pathname === '/mcp-site/stats' ? 'no-store' :
          response.headers.get('cache-control') ?? 'public, max-age=0, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      };
      // fetch may decompress upstream bytes: never copy its Content-Length or
      // Content-Encoding, cookies, hop-by-hop headers, or upstream CSP wholesale.
      if (req.method !== 'HEAD') headers['Content-Length'] = String(body.length);
      res.writeHead(response.status, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
      return true;
    } catch {
      if (!res.destroyed) return send(502, 'MCP page service unavailable\n');
      return true;
    } finally {
      clearTimeout(timeout);
      res.off('close', disconnect);
    }
  };
}
