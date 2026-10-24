import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createProductionServer } from './serve.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let vite, renderer, content, config, template, production, address;
before(async () => {
  vite = await createServer({
    configFile: false, root, base: '/', plugins: [react()],
    define: { 'import.meta.env.VITE_PUBLIC_MCP_URL': JSON.stringify('https://obsolete.example/mcp') },
    resolve: { alias: { '@': path.join(root, 'src') } },
    ssr: { noExternal: ['@workspace/api-client-react'] },
    server: { middlewareMode: true, hmr: false, watch: null },
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

for (const [language, route] of [['lv', '/'], ['en', '/en/']]) {
  test(`${language}: initial HTML contains full shared page content without JavaScript`, () => {
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

  test(`${language}: canonical, alternatives and content discovery use verified public URLs`, () => {
    const html = renderer.renderPage(template, route);
    assert.ok(html.includes(`rel="canonical" href="${config.publishedOrigin}${route}"`));
    assert.match(html, /hreflang="lv"/);
    assert.match(html, /hreflang="en"/);
    assert.match(html, /hreflang="x-default"/);
    assert.ok(html.includes(`href="/content/${language}.md"`));
    assert.ok(html.includes('href="/llms.txt"'));
    assert.ok(html.includes(`href="${route}" hrefLang="${language}"`));
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
  assert.equal(documents['sitemap.xml'].body.includes('/mcp'), false);
});

test('the real connection address wins over obsolete configuration everywhere', async () => {
  const expected = 'https://abcde-mcp.replit.app/mcp';
  assert.equal(config.verifiedMcpEndpoint, expected);
  for (const route of ['/', '/en/']) {
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
    ['/content/lv.md', 'text/markdown', 'Iesaki'],
    ['/content/en.md', 'text/markdown', 'Suggest a high-protein'],
    ['/llms.txt', 'text/plain', '# ABCDE MCP'],
    ['/robots.txt', 'text/plain', 'User-agent: *'],
    ['/sitemap.xml', 'application/xml', '<urlset'],
  ]) {
    const response = await fetch(`${address}${route}`);
    assert.equal(response.status, 200, route);
    assert.ok(response.headers.get('content-type').startsWith(type), route);
    assert.match(response.headers.get('content-type'), /charset=utf-8/);
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
    '/%2e%2e%2fpackage.json']) {
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
  for (const route of ['/', '/en/']) {
    const html = await (await fetch(`${address}${route}`)).text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    assert.ok(assets.length >= 2);
    for (const asset of assets) {
      const response = await fetch(`${address}${asset}`);
      assert.equal(response.status, 200, asset);
      assert.match(response.headers.get('cache-control'), /immutable/);
    }
  }
});
