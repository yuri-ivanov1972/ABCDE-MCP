// Uses the workspace Chromium directly, with no extra browser package or test service.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createProductionServer } from './serve.mjs';
import { createMcpPageProxy } from '../../../docs/abcde-mcp/abcde-page-proxy.mjs';

let origin = process.argv.find((arg, index) => index > 1 && !arg.startsWith('--')) ?? 'http://127.0.0.1:80';
const integrated = process.argv.includes('--integrated') || process.argv.includes('--production-integration');
const lvRoute = integrated ? '/lv/mcp' : '/';
const enRoute = integrated ? '/en/mcp' : '/en/';
const servers = [];
if (process.argv.includes('--production-integration')) {
  const upstream = createProductionServer();
  await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  servers.push(upstream);
  const proxy = createMcpPageProxy({ upstreamOrigin: `http://127.0.0.1:${upstream.address().port}` });
  const host = createServer(async (req, res) => {
    if (await proxy(req, res)) return;
    res.writeHead(404); res.end('Not found');
  });
  await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
  servers.push(host);
  origin = `http://127.0.0.1:${host.address().port}`;
  console.log('Checking built production files through the abcde.lv proxy contract; using the real local API counters');
}
const directory = await mkdtemp(path.join(os.tmpdir(), 'abcde-agent-browser-'));
const browser = spawn('chromium', [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run',
  '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${directory}`,
], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
let counter = 0, buffer = '';
const pending = new Map();
const errors = [];
browser.stdio[4].on('data', (chunk) => {
  buffer += chunk.toString();
  let boundary;
  while ((boundary = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, boundary));
    buffer = buffer.slice(boundary + 1);
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) continue;
      pending.delete(message.id);
      clearTimeout(request.timeout);
      message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result);
    } else if (message.method === 'Runtime.exceptionThrown') {
      errors.push(message.params.exceptionDetails.exception?.description ?? message.params.exceptionDetails.text);
    } else if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(' '));
    }
  }
});
function send(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++counter;
    const timeout = setTimeout(() => { pending.delete(id); reject(Error(`Timed out: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timeout });
    browser.stdio[3].write(`${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`);
  });
}
let session;
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, session);
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      if (await evaluate(`!!document.documentElement && (${expression})`)) return;
    } catch (error) {
      if (!/Execution context was destroyed|Cannot find context/.test(error.message)) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(`Browser condition failed: ${expression}`);
}
async function navigate(route, language) {
  await send('Page.navigate', { url: `${origin}${route}` }, session);
  await waitFor(`location.pathname === ${JSON.stringify(route)} && document.documentElement.lang === ${JSON.stringify(language)} && !!document.querySelector('h1')`);
}
try {
  const target = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;
  await send('Page.enable', {}, session);
  await send('Runtime.enable', {}, session);
  await send('Emulation.setScriptExecutionDisabled', { value: true }, session);
  for (const [route, language, heading] of [[lvRoute, 'lv', 'Veido veselīgāku'], [enRoute, 'en', 'Build a healthier']]) {
    await navigate(route, language);
    assert.ok((await evaluate("document.querySelector('h1').innerText")).includes(heading));
    assert.equal(await evaluate("document.querySelectorAll('[data-testid^=\"text-setup-step-\"]').length"), 4);
    assert.equal(await evaluate("document.querySelectorAll('[data-testid^=\"text-limitation-\"]').length"), 6);
    assert.ok(await evaluate("!!document.querySelector('a[href=\"/mcp-site/content/" + language + ".md\"]')"));
    await waitFor("getComputedStyle(document.body).margin === '0px'");
    await waitFor("document.querySelector('.brand-logo')?.complete && document.querySelector('.brand-logo')?.naturalWidth === 300");
    assert.equal(await evaluate("getComputedStyle(document.body).backgroundColor"), 'rgb(255, 255, 255)');
    assert.match(await evaluate("getComputedStyle(document.body).fontFamily"), /system-ui/);
    assert.equal(await evaluate("!!document.querySelector('link[href*=\"fonts.googleapis.com\"]')"), false);
  }
  console.log('PASS JavaScript disabled: both full language pages, real logo, system fonts, CSS and Markdown links');

  await send('Emulation.setScriptExecutionDisabled', { value: false }, session);
  await navigate(lvRoute, 'lv');
  await waitFor('/^\\d/.test(document.querySelector("[data-testid=value-tool-calls]")?.textContent?.trim() ?? "")');
  await evaluate("localStorage.setItem('abcde-mcp-language', 'lv'); document.querySelector('[data-testid=button-language-en]').click()");
  await waitFor(`location.pathname === ${JSON.stringify(enRoute)} && document.documentElement.lang === "en"`);
  await waitFor('/^\\d/.test(document.querySelector("[data-testid=value-tool-calls]")?.textContent?.trim() ?? "")');
  assert.equal(await evaluate("localStorage.getItem('abcde-mcp-language')"), 'en');
  await evaluate('window.__agentCheckBeforeReload = true');
  await send('Page.reload', {}, session);
  await waitFor('!window.__agentCheckBeforeReload && document.documentElement.lang === "en" && /^\\d/.test(document.querySelector("[data-testid=value-tool-calls]")?.textContent?.trim() ?? "")');
  console.log('PASS JavaScript enabled: hydration, language navigation/reload, saved preference and live counters');

  await send('Browser.grantPermissions', {
    origin: new URL(origin).origin, permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  await send('Page.bringToFront', {}, session);
  const endpoint = await evaluate("document.querySelector('[data-testid=text-public-endpoint]').textContent");
  assert.equal(endpoint, 'https://abcde-mcp.replit.app/mcp');
  await evaluate("document.querySelector('[data-testid=button-copy-endpoint]').click()");
  await waitFor('document.querySelector("[data-testid=status-copy-announcement]").textContent === "Copied"');
  assert.equal(await evaluate('navigator.clipboard.readText()'), endpoint);
  const prompt = await evaluate("document.querySelector('[data-testid=text-prompt-1]').textContent");
  await evaluate("document.querySelector('[data-testid=button-copy-prompt-1]').click()");
  await waitFor('document.querySelector("[data-testid=status-copy-announcement]").textContent === "Prompt copied."');
  assert.equal(await evaluate('navigator.clipboard.readText()'), prompt);
  console.log('PASS endpoint and prompt copying: actual clipboard text and accessible announcements');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true }, session);
  assert.ok(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'));
  await evaluate("document.querySelector('[data-testid=button-language-lv]').click()");
  await waitFor(`location.pathname === ${JSON.stringify(lvRoute)} && document.documentElement.lang === "lv"`);
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS mobile overflow/language navigation and no fresh JavaScript or hydration errors');
} finally {
  try { await send('Browser.close'); } catch { browser.kill(); }
  await new Promise((resolve) => browser.exitCode !== null ? resolve() : browser.once('exit', resolve));
  await rm(directory, { recursive: true, force: true });
  for (const server of servers.reverse()) await new Promise((resolve) => server.close(resolve));
}
