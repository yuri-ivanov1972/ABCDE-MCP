import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createProductionServer } from './serve.mjs';
import { createServer as createHttpServer } from 'node:http';
import { createMcpPageProxy } from '../../../docs/abcde-mcp/abcde-page-proxy.mjs';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let vite, renderer, content, config, template, production, address;
before(async () => {
  vite = await createServer({
    configFile: false, root, base: '/', plugins: [react()],
    define: { 'import.meta.env.VITE_PUBLIC_MCP_URL': JSON.stringify('https://obsolete.example/mcp') },
    resolve: { alias: { '@': path.join(root, 'src') } },
    ssr: { noExternal: ['@workspace/api-client-react'] },
    server: { middlewareMode: true, hmr: false, ws: false, watch: null },
    appType: 'custom',
  });
  renderer = await vite.ssrLoadModule('/src/entry-server.tsx');
  content = await vite.ssrLoadModule('/src/page-content.tsx');
  config = await vite.ssrLoadModule('/src/site-config.ts');
  template = await readFile(path.join(root, 'index.html'), 'utf8');
  production = createProductionServer({ root: path.join(root, 'dist/public') });
  await new Promise((resolve) => production.listen(0, '127.0.0.1', resolve));
  address = `http://127.0.0.1:${production.address().port}`;
});
after(async () => {
  if (production) await new Promise((resolve) => production.close(resolve));
  if (vite) await vite.close();
});

function plain(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'");
}

for (const [language, route] of [['lv', '/'], ['en', '/en/'], ['lv', '/lv/mcp'], ['en', '/en/mcp']]) {
  test(`${route}: initial HTML contains full shared page content without JavaScript`, () => {
    const html = renderer.renderPage(template, route);
    const visible = plain(html);
    const md = renderer.markdown(language);
    const c = content.translations[language];
    assert.match(html, new RegExp(`<html lang="${language}"`));
    assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
    assert.equal(html.includes('<!--page-'), false);
    assert.equal(html.includes('Update this description'), false);
    for (const item of [c.intro, c.setupIntro, c.adminNote, c.privacy, c.statsStaticNote, c.footer, c.footerTag,
      ...c.steps.flat(), ...content.copyPrompts[language],
      ...c.stepsSetup.map((item) => plain(renderToStaticMarkup(item))),
      ...c.limitations.map((item) => plain(renderToStaticMarkup(item))),
    ]) {
      assert.ok(visible.includes(item), `Initial HTML missing ${item}`);
      // Markdown adds emphasis only to step titles; all other substantive copy stays exact.
      assert.ok(md.includes(item), `Markdown missing ${item}`);
    }
    assert.ok(visible.includes(config.verifiedMcpEndpoint));
    assert.ok(md.includes(config.verifiedMcpEndpoint));
    assert.ok(visible.includes(c.statsUnavailable));
    assert.ok(!/<div[^>]*data-testid="value-tool-calls"[^>]*>\d/.test(html));
  });

  test(`${route}: canonical, alternatives and content discovery use selected public URLs`, () => {
    const html = renderer.renderPage(template, route);
    assert.ok(html.includes(`rel="canonical" href="https://abcde.lv/${language}/mcp"`));
    assert.ok(html.includes(`property="og:url" content="https://abcde.lv/${language}/mcp"`));
    assert.match(html, /hreflang="lv"/);
    assert.match(html, /hreflang="en"/);
    assert.match(html, /hreflang="x-default"/);
    assert.ok(html.includes(`href="/mcp-site/content/${language}.md"`));
    assert.ok(html.includes('href="/mcp-site/llms.txt"'));
    assert.ok(html.includes(`href="${route}" hrefLang="${language}"`));
    if (route.endsWith('/mcp')) {
      assert.ok(html.includes('href="/lv/mcp" hrefLang="lv"'));
      assert.ok(html.includes('href="/en/mcp" hrefLang="en"'));
    }
    assert.equal(html.includes('.replit.dev'), false);
  });
}

test('language URLs determine content, independent of a saved preference', () => {
  // A renderer must never read localStorage or vary its language by crawler identity.
  globalThis.localStorage = { getItem: () => 'en' };
  try {
    assert.match(renderer.renderPage(template, '/'), /<html lang="lv"/);
    assert.match(renderer.renderPage(template, '/en/'), /<html lang="en"/);
  } finally { delete globalThis.localStorage; }
});

test('main-site branding is local, byte-verified and available through scoped proxy paths', async () => {
  const logoPath = '/mcp-site/assets/nutri-score-logo-354d7707378f.png';
  const proxy = createMcpPageProxy({ upstreamOrigin: address });
  const host = createHttpServer((req, res) => proxy(req, res));
  await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${host.address().port}`;
  try {
    for (const route of ['/', '/en/', '/lv/mcp', '/en/mcp']) {
      const html = renderer.renderPage(template, route);
      assert.ok(html.includes(`src="${logoPath}"`));
      assert.ok(html.includes('href="/mcp-site/favicon.svg"'));
      assert.equal(html.includes('fonts.googleapis.com'), false);
    }
    for (const [resource, type, hash] of [
      [logoPath, 'image/png', '354d7707378f0f173724a08dada63fa2f837f1687190701872396e14530217d0'],
      ['/mcp-site/favicon.svg', 'image/svg+xml', '42ee8f8cf9722afd994ff096392ea8ce02b4fa5be62686f9127744e0795df2d6'],
    ]) {
      const response = await fetch(`${origin}${resource}`);
      assert.equal(response.status, 200);
      assert.ok(response.headers.get('content-type').startsWith(type));
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
      const head = await fetch(`${origin}${resource}`, { method: 'HEAD' });
      assert.equal(head.status, 200);
      assert.equal(await head.text(), '');
    }
    const css = await readFile(path.join(root, 'src/index.css'), 'utf8');
    assert.equal(/fonts\.googleapis|DM Sans|Manrope|Space Mono/.test(css), false);
  } finally { await new Promise((resolve) => host.close(resolve)); }
});

test('agent documents contain shared content, not snapshots or unsupported promises', () => {
  const documents = renderer.agentDocuments();
  for (const lang of ['lv', 'en']) assert.equal(documents[`content/${lang}.md`].body, renderer.markdown(lang));
  assert.match(documents['llms.txt'].body, /voluntary llms.txt discovery convention/);
  assert.match(documents['llms.txt'].body, /content\/lv\.md/);
  assert.match(documents['llms.txt'].body, /content\/en\.md/);
  assert.match(documents['llms.txt'].body, /No verified prices/);
  assert.match(documents['robots.txt'].body, /User-agent: \*\nAllow: \//);
  assert.equal((documents['sitemap.xml'].body.match(/<loc>/g) ?? []).length, 2);
  assert.equal(documents['sitemap.xml'].body.includes('/api/'), false);
  assert.ok(documents['sitemap.xml'].body.includes('https://abcde.lv/lv/mcp</loc>'));
  assert.ok(documents['sitemap.xml'].body.includes('https://abcde.lv/en/mcp</loc>'));
  assert.equal(documents['sitemap.xml'].body.includes('replit.app'), false);
  for (const name of ['content/lv.md', 'content/en.md', 'llms.txt', 'sitemap.xml']) {
    assert.equal(documents[`mcp-site/${name}`].body, documents[name].body);
  }
});

test('the real connection address wins over obsolete configuration everywhere', async () => {
  const expected = JSON.parse(await readFile(path.join(root, 'src/connection.json'), 'utf8')).primaryEndpoint;
  assert.equal(config.verifiedMcpEndpoint, expected);
  for (const route of ['/', '/en/', '/lv/mcp', '/en/mcp']) {
    const html = renderer.renderPage(template, route);
    assert.ok(html.includes(`data-testid="text-public-endpoint">${expected}</code>`));
    assert.ok(html.includes('data-testid="button-copy-endpoint"'));
    assert.equal(html.includes('obsolete.example'), false);
  }
  for (const name of ['content/lv.md', 'content/en.md', 'llms.txt']) {
    const body = renderer.agentDocuments()[name].body;
    assert.ok(body.includes(expected), name);
    assert.equal(body.includes('obsolete.example'), false);
  }
  // The displayed value and clipboard handler must use the same authoritative value.
  const app = await readFile(path.join(root, 'src/App.tsx'), 'utf8');
  assert.match(app, /const endpoint = verifiedMcpEndpoint;/);
  assert.match(app, /onClick=\{\(\) => copyText\(endpoint,/);
});

test('invalid primary addresses fail rather than changing public instructions', () => {
  for (const value of ['', null, 'https://evil.example/mcp', 'https://abcde.lv/mcp/',
    'http://abcde.lv/mcp', 'https://abcde.lv/mcp?key=x']) {
    assert.throws(() => config.selectPrimaryEndpoint(value));
  }
});

for (const expected of ['https://abcde.lv/mcp', 'https://abcde-mcp.replit.app/mcp']) {
test(`approved primary ${expected} is shared by all HTML and agent documents`, async () => {
  assert.equal(config.selectPrimaryEndpoint(expected), expected);
  const other = expected === config.mainSiteMcpEndpoint ? config.directMcpEndpoint : config.mainSiteMcpEndpoint;
  const directory = await mkdtemp(path.join(tmpdir(), 'abcde-connection-test-'));
  const fixture = path.join(directory, 'connection.json');
  let promoted;
  try {
    await writeFile(fixture, JSON.stringify({ primaryEndpoint: expected }));
    promoted = await createServer({
      configFile: false, root, base: '/', plugins: [react()],
      resolve: { alias: { '@': path.join(root, 'src'), './connection.json': fixture } },
      ssr: { noExternal: ['@workspace/api-client-react'] },
      server: { middlewareMode: true, hmr: false, ws: false, watch: null }, appType: 'custom',
    });
    const renderer = await promoted.ssrLoadModule('/src/entry-server.tsx');
    for (const route of ['/', '/en/', '/lv/mcp', '/en/mcp']) {
      const html = renderer.renderPage(template, route);
      assert.ok(html.includes(`data-testid="text-public-endpoint">${expected}</code>`));
      assert.equal(html.includes(other), false);
    }
    for (const [name, document] of Object.entries(renderer.agentDocuments())) {
      if (name.endsWith('.md') || name.endsWith('llms.txt')) {
        assert.ok(document.body.includes(expected), name);
        // The main-domain endpoint is also a prefix of legitimate /mcp-site/ URLs.
        assert.equal(document.body.includes(`(${other})`), false, name);
        assert.equal(document.body.split('\n').some((line) => line.endsWith(` ${other}`)), false, name);
      }
    }
  } finally {
    if (promoted) await promoted.close();
    await rm(directory, { recursive: true, force: true });
  }
});
}

test('endpoint configuration rejects private/dev addresses, credentials and query parameters', () => {
  for (const value of ['http://example.com/mcp', 'https://localhost/mcp', 'https://test.replit.dev/mcp',
    'https://user:password@example.com/mcp', 'https://example.com/mcp?token=example',
    'https://example.com/not-mcp', '']) assert.equal(config.publicEndpoint(value), '');
  assert.equal(config.publicEndpoint(config.verifiedMcpEndpoint), config.verifiedMcpEndpoint);
  assert.equal(config.sitePath('/prefix/', 'content/en.md'), '/prefix/content/en.md');
});

test('production files return the right body, MIME type, UTF-8 and no HTML fallback', async () => {
  for (const [route, type, sample] of [
    ['/', 'text/html', 'Veido veselīgāku'],
    ['/en/', 'text/html', 'Build a healthier'],
    ['/lv/mcp', 'text/html', 'Veido veselīgāku'],
    ['/en/mcp', 'text/html', 'Build a healthier'],
    ['/content/lv.md', 'text/markdown', 'Iesaki'],
    ['/content/en.md', 'text/markdown', 'Suggest a high-protein'],
    ['/llms.txt', 'text/plain', '# ABCDE MCP'],
    ['/robots.txt', 'text/plain', 'User-agent: *'],
    ['/sitemap.xml', 'application/xml', '<urlset'],
    ['/mcp-site/content/lv.md', 'text/markdown', 'Iesaki'],
    ['/mcp-site/content/en.md', 'text/markdown', 'Suggest a high-protein'],
    ['/mcp-site/llms.txt', 'text/plain', '# ABCDE MCP'],
    ['/mcp-site/sitemap.xml', 'application/xml', '<urlset'],
    ['/mcp-site/favicon.svg', 'image/svg+xml', '<svg'],
  ]) {
    const response = await fetch(`${address}${route}`);
    assert.equal(response.status, 200, route);
    assert.ok(response.headers.get('content-type').startsWith(type), route);
    if (!type.startsWith('image/')) assert.match(response.headers.get('content-type'), /charset=utf-8/);
    const body = await response.text();
    assert.ok(body.includes(sample), route);
    if (route.endsWith('.md') || route.endsWith('.txt')) assert.equal(body.includes('<!DOCTYPE'), false);
    const head = await fetch(`${address}${route}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(await head.text(), '');
  }
});

test('missing documents and unknown routes return real 404 responses', async () => {
  for (const route of ['/content/missing.md', '/missing.txt', '/missing.xml', '/missing-page', '/assets/missing.js',
    '/mcp-site/content/missing.md', '/mcp-site/assets/missing.js', '/%2e%2e%2fpackage.json']) {
    const response = await fetch(`${address}${route}`);
    assert.equal(response.status, 404, route);
    assert.match(response.headers.get('content-type'), /^text\/plain/);
    assert.equal((await response.text()).includes('<html'), false);
  }
  assert.equal((await fetch(`${address}/%zz`)).status, 400);
  assert.equal((await fetch(`${address}/`, { method: 'POST' })).status, 405);
});

test('language aliases redirect and generated asset links resolve', async () => {
  const response = await fetch(`${address}/en`, { redirect: 'manual' });
  assert.equal(response.status, 308);
  assert.equal(response.headers.get('location'), '/en/');
  for (const alias of ['/lv/mcp/', '/en/mcp/', '/lv/mcp/index.html', '/en/mcp/index.html']) {
    const response = await fetch(`${address}${alias}?source=test`, { redirect: 'manual' });
    assert.equal(response.status, 308);
    assert.equal(response.headers.get('location'), `/${alias.startsWith('/lv/') ? 'lv' : 'en'}/mcp?source=test`);
  }
  for (const route of ['/', '/en/', '/lv/mcp', '/en/mcp']) {
    const html = await (await fetch(`${address}${route}`)).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/mcp-site\/assets\/[^"]+)"/g)].map((match) => match[1]);
    assert.ok(assets.length >= 2);
    for (const asset of assets) {
      const response = await fetch(`${address}${asset}`);
      assert.equal(response.status, 200, asset);
      assert.match(response.headers.get('cache-control'), /immutable/);
    }
  }
});

test('real HTTP proxy preserves production pages, scoped files and unrelated host routes', async () => {
  const proxy = createMcpPageProxy({ upstreamOrigin: address });
  const host = createHttpServer(async (req, res) => {
    if (await proxy(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Existing ABCDE website');
  });
  await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${host.address().port}`;
  try {
    for (const lang of ['lv', 'en']) {
      const response = await fetch(`${origin}/${lang}/mcp`);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.ok(html.includes(`lang="${lang}"`));
      assert.ok(html.includes(config.verifiedMcpEndpoint));
      const assets = [...html.matchAll(/(?:src|href)="(\/mcp-site\/[^"]+)"/g)].map((m) => m[1]);
      for (const asset of assets) assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset);
      const alias = await fetch(`${origin}/${lang}/mcp/`, { redirect: 'manual' });
      assert.equal(alias.status, 308);
      assert.equal(alias.headers.get('location'), `/${lang}/mcp`);
      assert.equal((await fetch(`${origin}/mcp-site/content/${lang}.md`)).status, 200);
    }
    for (const route of ['/', '/lv/products', '/en/products', '/api/stats', '/assets/main.js', '/robots.txt', '/llms.txt', '/sitemap.xml', '/mcp']) {
      assert.equal(await (await fetch(`${origin}${route}`)).text(), 'Existing ABCDE website', route);
    }
    for (const route of ['/mcp-site/content/missing.md', '/mcp-site/assets/missing.js', '/mcp-site/%2e%2e%2fapi/stats']) {
      assert.equal((await fetch(`${origin}${route}`)).status, 404, route);
    }
    assert.equal((await fetch(`${origin}/en/mcp`, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${origin}/mcp-site/content/en.md`, { method: 'HEAD' })).status, 200);
  } finally { await new Promise((resolve) => host.close(resolve)); }
});

test('scoped statistics preserve real counters, omit browser credentials and fail explicitly', async () => {
  let available = true, leaked = false;
  const stats = createHttpServer((req, res) => {
    leaked ||= Boolean(req.headers.cookie || req.headers.authorization);
    assert.equal(req.url, '/api/stats');
    res.writeHead(available ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(available ? '{"toolCalls":127,"measuredSessions":null,"sessionMeasurementAvailable":false}' : '{"error":"Unavailable"}');
  });
  await new Promise((resolve) => stats.listen(0, '127.0.0.1', resolve));
  const landing = createProductionServer({ statsUrl: `http://127.0.0.1:${stats.address().port}/api/stats` });
  await new Promise((resolve) => landing.listen(0, '127.0.0.1', resolve));
  const proxy = createMcpPageProxy({ upstreamOrigin: `http://127.0.0.1:${landing.address().port}` });
  const host = createHttpServer((req, res) => proxy(req, res));
  await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${host.address().port}/mcp-site/stats`;
  try {
    const response = await fetch(url, { headers: { Cookie: 'test=private', Authorization: 'Bearer test-fixture' } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).toolCalls, 127);
    assert.equal(leaked, false);
    available = false;
    const failure = await fetch(url);
    assert.equal(failure.status, 503);
    assert.equal((await failure.json()).error, 'Statistics unavailable');
    assert.equal((await fetch(url, { method: 'HEAD' })).status, 503);
  } finally {
    for (const server of [host, landing, stats]) await new Promise((resolve) => server.close(resolve));
  }
});

test('proxy outage is a bounded 502, not successful HTML or invented statistics', async () => {
  const proxy = createMcpPageProxy({ upstreamOrigin: 'http://127.0.0.1:1' });
  const host = createHttpServer((req, res) => proxy(req, res));
  await new Promise((resolve) => host.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${host.address().port}/lv/mcp`);
    assert.equal(response.status, 502);
    assert.match(await response.text(), /unavailable/);
  } finally { await new Promise((resolve) => host.close(resolve)); }
});
