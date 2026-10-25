// Paths relative to the artifact base. Public language pages use no trailing slash.
export function pageRoute(relative) {
  if (['lv/mcp/', 'lv/mcp/index.html', 'en/mcp/', 'en/mcp/index.html'].includes(relative)) {
    return { redirect: relative.startsWith('lv/') ? 'lv/mcp' : 'en/mcp' };
  }
  if (['en', 'index.html', 'en/index.html'].includes(relative)) {
    return { redirect: relative.startsWith('en') ? 'en/' : '' };
  }
  if (['', 'en/', 'lv/mcp', 'en/mcp'].includes(relative)) {
    return { file: `${relative.replace(/\/$/, '')}${relative ? '/' : ''}index.html` };
  }
  return {};
}
