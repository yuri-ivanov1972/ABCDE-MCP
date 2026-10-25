// Fixed internal service address, never a caller-supplied destination.
export const internalStatsUrl = 'http://127.0.0.1:8080/api/stats';

export async function serveStats(req, res, upstream = internalStatsUrl) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  try {
    const response = await fetch(upstream, {
      signal: AbortSignal.timeout(5000), redirect: 'error',
      headers: { Accept: 'application/json' },
    });
    if (!response.headers.get('content-type')?.includes('application/json')) throw Error('Invalid stats type');
    if (!response.ok) throw Error('Stats service unavailable');
    const reader = response.body.getReader();
    let size = 0;
    const chunks = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 16384) throw Error('Stats response too large');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel(); }
    const body = Buffer.concat(chunks);
    JSON.parse(body.toString('utf8'));
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : '{"error":"Statistics unavailable"}');
  }
}
