import { Children, isValidElement, type ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import App from './App';
import { ErrorBoundary } from './components/error-boundary';
import { copyPrompts, translations, type Language } from './page-content';
import { contentNamespace, languagePaths, publicPageUrl, publishedOrigin, sitePath, verifiedMcpEndpoint } from './site-config';

const base = import.meta.env.BASE_URL;
const endpoint = verifiedMcpEndpoint;
const languages: Language[] = ['lv', 'en'];
export const pageRoutes = ['', 'en/', ...Object.values(languagePaths)];

function text(node: ReactNode): string {
  return Children.toArray(node).map((child): string => {
    if (typeof child === 'string' || typeof child === 'number') return String(child);
    if (!isValidElement<{ children?: ReactNode }>(child)) return '';
    return child.type === 'br' ? ' ' : text(child.props.children);
  }).join('');
}

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function pageLanguage(path: string): Language {
  const normalized = path.replace(/\/$/, '');
  return [sitePath(base, 'en'), sitePath(base, languagePaths.en)].includes(normalized) ? 'en' : 'lv';
}

export function renderPage(template: string, path: string): string {
  const language = pageLanguage(path);
  const content = translations[language];
  const title = language === 'lv' ? 'ABCDE MCP — pārtikas dati un iepirkumu saraksti' : 'ABCDE MCP — food data and smarter shopping lists';
  const canonical = publicPageUrl(language);
  const head = [
    `<title>${escape(title)}</title>`,
    `<meta name="description" content="${escape(content.intro)}">`,
    '<meta name="robots" content="index, follow">',
    `<meta property="og:title" content="${escape(title)}">`,
    `<meta property="og:description" content="${escape(content.intro)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:locale" content="${language === 'lv' ? 'lv_LV' : 'en_US'}">`,
    '<meta name="twitter:card" content="summary">',
    `<meta name="twitter:title" content="${escape(title)}">`,
    `<meta name="twitter:description" content="${escape(content.intro)}">`,
    `<link rel="alternate" type="text/markdown" hreflang="${language}" href="${sitePath(base, `${contentNamespace}content/${language}.md`)}" title="ABCDE MCP — Markdown">`,
    `<link rel="alternate" type="text/plain" href="${sitePath(base, `${contentNamespace}llms.txt`)}" title="AI agent content index">`,
    ...(publishedOrigin ? [
      `<link rel="canonical" href="${canonical}">`,
      `<meta property="og:url" content="${canonical}">`,
      ...languages.map((lang) => `<link rel="alternate" hreflang="${lang}" href="${publicPageUrl(lang)}">`),
      `<link rel="alternate" hreflang="x-default" href="${publicPageUrl('lv')}">`,
      `<link rel="sitemap" type="application/xml" href="${sitePath(base, `${contentNamespace}sitemap.xml`)}">`,
    ] : []),
  ].join('\n    ');
  const markup = renderToString(<ErrorBoundary><App ssrPath={path} /></ErrorBoundary>);
  return template.replace(/<html lang="[^"]*"/, `<html lang="${language}"`)
    .replace('<!--page-head-->', () => head).replace('<!--page-html-->', () => markup);
}

export function markdown(language: Language): string {
  const c = translations[language];
  return [
    '# ABCDE MCP', '', text(c.heading), '', c.eyebrow, '', c.intro, '',
    `[${c.heroLink}](${publicPageUrl(language)}#connect)`,
    '', c.visualCaption, '', `## ${c.stepsTitle}`, '', c.stepsIntro, '',
    ...c.steps.flatMap(([title, description], index) => [`${index + 1}. **${title}** — ${description}`, '']),
    `## ${c.setupTitle}`, '', c.setupIntro, '', `${c.endpointLabel}: ${endpoint || c.endpointMissing}`, '',
    ...c.stepsSetup.map((step, index) => `${index + 1}. ${text(step)}`),
    '', c.adminNote, '', `## ${c.promptsTitle}`, '', c.promptsIntro, '',
    ...copyPrompts[language].flatMap((prompt) => [`- ${prompt}`, '']),
    `## ${c.limitsTitle}`, '', ...c.limitations.map((limit) => `- ${text(limit)}`), '',
    `## ${c.usageTitle}`, '', c.toolCalls, '', c.toolCallsCaption, '', c.statsUnavailable, '',
    c.statsStaticNote,
    '', `${c.sessions}: ${c.sessionless}`, '', c.sessionsCaption, '', c.privacy, '',
    `${c.footer} · [abcde.lv](https://abcde.lv)`, '', c.footerTag, '',
    `[LV](${publicPageUrl('lv')}) · [EN](${publicPageUrl('en')}) · [llms.txt](${publishedOrigin}/${contentNamespace}llms.txt)`, '',
  ].join('\n');
}

export function agentDocuments(): Record<string, { type: string; body: string }> {
  const url = (path: string) => new URL(`${contentNamespace}${path}`, `${publishedOrigin}/`).href;
  const documents: Record<string, { type: string; body: string }> = {
    'content/lv.md': { type: 'text/markdown; charset=utf-8', body: markdown('lv') },
    'content/en.md': { type: 'text/markdown; charset=utf-8', body: markdown('en') },
    'llms.txt': {
      type: 'text/plain; charset=utf-8',
      body: [
        '# ABCDE MCP', '', `> ${translations.en.intro}`, '',
        'Independent, public, read-only project by ABCDE Open Food Data Lab. Purchases happen on retailer websites.',
        'This index follows the voluntary llms.txt discovery convention; support by any particular AI service is not guaranteed.', '',
        '## Website content', '',
        `- [Latvian page](${publicPageUrl('lv')})`,
        `- [English page](${publicPageUrl('en')})`,
        `- [Latvian content — Markdown](${url('content/lv.md')})`,
        `- [English content — Markdown](${url('content/en.md')})`,
        ...(endpoint ? ['', '## MCP connection', '', `- [Public MCP endpoint](${endpoint}): Streamable HTTP, not an HTML content page. No sign-in required.`] : []),
        '', 'Read the content documents for connection instructions, examples, limitations, independence and privacy information.',
        'No verified prices, guaranteed live stock, medical advice or allergen guarantees. No carts, orders or checkout.',
        'No queries or session IDs are stored by the application. Infrastructure operational logs may exist.', '',
      ].join('\n'),
    },
    'robots.txt': { type: 'text/plain; charset=utf-8', body: `User-agent: *\nAllow: /\n${publishedOrigin ? `Sitemap: ${url('sitemap.xml')}\n` : ''}` },
    ...(publishedOrigin ? { 'sitemap.xml': {
      type: 'application/xml; charset=utf-8',
      body: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${languages.map((lang) => `  <url><loc>${escape(publicPageUrl(lang))}</loc></url>`).join('\n')}\n</urlset>\n`,
    } } : {}),
  };
  // Legacy documents remain available on the standalone service. Only scoped paths
  // are forwarded by abcde.lv; its root discovery files belong to the main site.
  return { ...documents, ...Object.fromEntries(Object.entries(documents).map(([name, doc]) => [`${contentNamespace}${name}`, doc])) };
}
