/**
 * Local API dev server (no `vercel login` required).
 * Mirrors /api/* routes for Vite hot-reload workflow.
 */
import 'dotenv/config';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { runPersonA } from '../api/run-a';
import * as statusRoute from '../api/status';
import * as storiesRoute from '../api/stories';
import { drainQueue } from '../generation/pipeline';

const PORT = Number(process.env.API_PORT ?? 3000);

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

async function serveLocalAsset(url: URL, res: ServerResponse) {
  const storyId = url.searchParams.get('storyId') ?? '';
  const file = url.searchParams.get('file') ?? '';
  if (!storyId || !file || storyId.includes('..') || file.includes('..')) {
    return sendJson(res, 400, { error: 'invalid_path' });
  }
  const path = join(process.cwd(), 'output', storyId, file);
  const mime: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.png': 'image/png',
    '.mp3': 'audio/mpeg',
  };
  try {
    await access(path);
    res.writeHead(200, {
      'content-type': mime[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=60',
    });
    createReadStream(path).pipe(res);
  } catch {
    sendJson(res, 404, { error: 'not_found' });
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  try {
    if (path === '/api/status' && req.method === 'GET') {
      const response = await statusRoute.GET();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(await response.text());
      return;
    }

    if (path === '/api/stories' && req.method === 'GET') {
      const response = await storiesRoute.GET();
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(await response.text());
      return;
    }

    if (path === '/api/local-asset' && req.method === 'GET') {
      await serveLocalAsset(url, res);
      return;
    }

    if (path === '/api/run-a' && (req.method === 'GET' || req.method === 'POST')) {
      const dry =
        url.searchParams.get('dry') === '1' ||
        (req.method === 'POST' && (await readBody(req)).includes('"dry":true'));
      const result = await runPersonA(dry);
      return sendJson(res, 200, result);
    }

    if (path === '/api/run-b' && (req.method === 'GET' || req.method === 'POST')) {
      sendJson(res, 202, { ok: true, route: '/api/run-b', message: 'generation pipeline accepted' });
      drainQueue()
        .then(({ summary }) => console.log('[run-b] ok', summary))
        .catch((err) => console.error('[run-b] error', err));
      return;
    }

    sendJson(res, 404, { error: 'not_found', path });
  } catch (error) {
    console.error('[dev-api]', error);
    sendJson(res, 500, {
      error: error instanceof Error ? error.message : 'internal_error',
    });
  }
});

server.listen(PORT, () => {
  console.log(`▶ DailyNews dev API → http://127.0.0.1:${PORT}`);
  console.log('  Routes: /api/status /api/stories /api/run-a /api/run-b /api/local-asset');
});