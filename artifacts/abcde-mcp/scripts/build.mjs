import { build, createServer } from 'vite';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await build({ root });
// A middleware-only Vite instance transforms TSX for prerendering; it opens no HTTP port.
const server = await createServer({ root, mode: 'production', server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom' });
try {
  const renderer = await server.ssrLoadModule('/src/entry-server.tsx');
  const directory = path.join(root, 'dist/public');
  await mkdir(path.join(directory, 'mcp-site'), { recursive: true });
  await copyFile(path.join(root, 'public/favicon.svg'), path.join(directory, 'mcp-site/favicon.svg'));
  const template = await readFile(path.join(directory, 'index.html'), 'utf8');
  for (const route of renderer.pageRoutes) {
    const destination = path.join(directory, route, 'index.html');
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, renderer.renderPage(template, `${server.config.base}${route}`));
  }
  for (const [name, document] of Object.entries(renderer.agentDocuments())) {
    const destination = path.join(directory, name);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, document.body);
  }
  console.log('Prerendered Latvian/English pages, Markdown, llms.txt, robots.txt and sitemap.');
} finally {
  await server.close();
}
