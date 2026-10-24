import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/public');
const types = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.md': 'text/markdown', '.txt': 'text/plain', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json',
};

// Serve generated files, not runtime SSR. Explicit MIME types and real missing-file
// responses prevent agents from receiving SPA HTML at a Markdown/document URL.
export function createProductionServer({ root = defaultRoot, basePath = '/' } = {}) {
  const directory = path.resolve(root);
  const base = `/${basePath.replace(/^\/|\/$/g, '')}`.replace(/\/?$/, '/');
  return createServer(async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
      res.end(req.method === 'HEAD' ? undefined : body);
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.setHeader('Allow', 'GET, HEAD');
      return send(405, 'Method not allowed\n');
    }
    let pathname;
    try { pathname = decodeURIComponent((req.url ?? '/').split('?')[0]); }
    catch { return send(400, 'Invalid URL\n'); }
    if (!pathname.startsWith(base) || pathname.includes('\0') || pathname.includes('\\')) return send(404, 'Not found\n');
    let relative = pathname.slice(base.length);
    if (['en', 'index.html', 'en/index.html'].includes(relative)) {
      res.writeHead(308, { Location: `${base}${relative.startsWith('en') ? 'en/' : ''}` });
      return res.end();
    }
    if (relative === '' || relative.endsWith('/')) relative += 'index.html';
    const filename = path.resolve(directory, relative);
    if (!filename.startsWith(`${directory}${path.sep}`)) return send(404, 'Not found\n');
    try {
      if (!(await stat(filename)).isFile()) return send(404, 'Not found\n');
      const data = await readFile(filename);
      const extension = path.extname(filename);
      const type = types[extension] ?? 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': `${type}${/^(text\/|application\/(?:xml|json))/.test(type) ? '; charset=utf-8' : ''}`,
        'Content-Length': data.length,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return send(404, 'Not found\n');
      console.error('Static file read failed:', error.code ?? 'unknown');
      return send(500, 'Unable to read content\n');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw Error('A valid PORT is required');
  const server = createProductionServer({ basePath: process.env.BASE_PATH ?? '/' });
  server.listen(port, '0.0.0.0', () => console.log(`Prerendered website listening on port ${port}`));
  for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => server.close());
}
