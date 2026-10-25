import connection from './connection.json';

// Owner-selected human website; routing in that separate project is a release prerequisite.
export const publishedOrigin = 'https://abcde.lv';
export const directMcpEndpoint = 'https://abcde-mcp.replit.app/mcp';
export const mainSiteMcpEndpoint = 'https://abcde.lv/mcp';

export function selectPrimaryEndpoint(value: unknown): string {
  if (value !== directMcpEndpoint && value !== mainSiteMcpEndpoint) {
    throw new Error('The advertised MCP address must be one of the two approved public endpoints.');
  }
  return value;
}

// Shared build-time setting for initial HTML, hydration, clipboard and AI documents.
// Promote connection.json only after the main-site MCP route is verified live.
export const verifiedMcpEndpoint = selectPrimaryEndpoint(connection.primaryEndpoint);
export const languagePaths = { lv: 'lv/mcp', en: 'en/mcp' } as const;
export const contentNamespace = 'mcp-site/';

export function publicPageUrl(language: keyof typeof languagePaths): string {
  return new URL(languagePaths[language], `${publishedOrigin}/`).href;
}

export function isIntegratedPath(path: string, base: string): boolean {
  return Object.values(languagePaths).some((route) =>
    path.replace(/\/$/, '') === sitePath(base, route));
}

export function publicEndpoint(value: string | undefined): string {
  if (!value?.trim()) return '';
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (
      url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      !/^\/mcp\/?$/.test(url.pathname) ||
      host === 'localhost' || host.endsWith('.localhost') ||
      host === '127.0.0.1' || host === '[::1]' || host.endsWith('.replit.dev')
    ) return '';
    return url.toString();
  } catch {
    return '';
  }
}

export function sitePath(base: string, path = ''): string {
  return `${base.replace(/\/?$/, '/')}${path.replace(/^\//, '')}`;
}
