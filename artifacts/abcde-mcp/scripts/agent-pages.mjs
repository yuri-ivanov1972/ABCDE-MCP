import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pageRoute } from './page-routes.mjs';
import { serveStats } from './stats-response.mjs';

// Development serves exactly the same renderer and documents as the build.
export function agentPages() {
  let base = '/';
  return {
    name: 'agent-readable-pages',
    configResolved(config) { base = config.base; },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const pathname = (req.url ?? '/').split('?')[0];
        if (!pathname.startsWith(base)) return next();
        const relative = pathname.slice(base.length);
        const route = pageRoute(relative);
        if (route.redirect !== undefined) {
          const query = (req.url ?? '').includes('?') ? `?${req.url.split('?').slice(1).join('?')}` : '';
          res.writeHead(308, { Location: `${base}${route.redirect}${query}` });
          return res.end();
        }
        try {
          if (relative === 'mcp-site/stats') return serveStats(req, res);
          if (relative === 'mcp-site/favicon.svg') {
            const icon = await readFile(path.join(server.config.root, 'public/favicon.svg'));
            res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
            return res.end(req.method === 'HEAD' ? undefined : icon);
          }
          if (relative === 'mcp-site/assets/nutri-score-logo-354d7707378f.png') {
            const logo = await readFile(path.join(server.config.root, 'public', relative));
            res.writeHead(200, { 'Content-Type': 'image/png' });
            return res.end(req.method === 'HEAD' ? undefined : logo);
          }
          if (route.file) {
            const template = await readFile(path.join(server.config.root, 'index.html'), 'utf8');
            const transformed = await server.transformIndexHtml(pathname, template);
            const renderer = await server.ssrLoadModule('/src/entry-server.tsx');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(req.method === 'HEAD' ? undefined : renderer.renderPage(transformed, pathname));
          }
          if (/^(?:mcp-site\/|content\/|llms|robots|sitemap)/.test(relative) || /\.(?:md|txt|xml)$/.test(relative)) {
            const renderer = await server.ssrLoadModule('/src/entry-server.tsx');
            const document = renderer.agentDocuments()[relative];
            res.writeHead(document ? 200 : 404, {
              'Content-Type': document?.type ?? 'text/plain; charset=utf-8',
              'X-Content-Type-Options': 'nosniff',
            });
            return res.end(req.method === 'HEAD' ? undefined : document?.body ?? 'Not found\n');
          }
          return next();
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
