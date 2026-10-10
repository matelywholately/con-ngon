import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createRelayHandler } from './handler.ts';

const handle = createRelayHandler(process.env.ZALO_GRAPH_RELAY_KEY ?? '');
createServer({ requestTimeout: 15000, headersTimeout: 10000 }, async (incoming, outgoing) => {
  try {
    const request = new Request(new URL(incoming.url ?? '/', 'http://localhost'), { method: incoming.method,
      headers: incoming.headers, ...(incoming.method === 'POST' ? { body: Readable.toWeb(incoming), duplex: 'half' } : {}) });
    const response = await handle(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(503, { 'Cache-Control': 'no-store' }); outgoing.end(); }
}).listen(8787, '127.0.0.1', () => console.info('Zalo verification relay listening on loopback'));
