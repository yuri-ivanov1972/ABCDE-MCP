// Verified through deployment metadata on 2026-10-24. Never derive this from a dev host.
export const publishedOrigin = 'https://abcde-mcp.replit.app';
export const verifiedMcpEndpoint = `${publishedOrigin}/mcp`;

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
