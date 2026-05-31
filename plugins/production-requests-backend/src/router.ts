import { LoggerService } from '@backstage/backend-plugin-api';
import { Router } from 'express';
import express from 'express';
import { RequestsStore } from './database/RequestStore';
import { Action, Status, checkTransition } from './workflow';
export async function createRouter(opts: {
  logger: LoggerService;
  store: RequestsStore;
}) {
  const { store, logger } = opts;
  const router = Router();
  router.use(express.json());

  // Move INSIDE createRouter — guaranteed same closure
  const clients = new Set<express.Response>();

  function broadcast(event: string, data: unknown) {
  logger.info(`[SSE] broadcasting to ${clients.size} clients`);
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
    (client as any).flush?.();  // 👈 force flush after broadcast
  }
}

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

 router.get('/events/stream', (req, res) => {
  console.log('🔌 SSE client connecting...');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.flushHeaders();

 const heartbeat = setInterval(() => {
  res.write(': ping\n\n');
  (res as any).flush?.();  // 👈 force flush
}, 5_000);

  clients.add(res);
  console.log(`✅ SSE client added. Total: ${clients.size}`);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    console.log(`🔴 SSE client removed. Total: ${clients.size}`);
  });
});

  router.get('/requests', async (req, res) => {
    res.json(await store.list(req.query.apiRef as string | undefined));
  });

  router.post('/requests', async (req, res) => {
    const { apiRef, title, prLink, description, requestedBy } = req.body;
    if (!apiRef || !title || !prLink || !requestedBy) {
      res.status(400).json({ error: 'apiRef, title, prLink, requestedBy are required' });
      return;
    }
    const created = await store.insert({ apiRef, title, prLink, description, requestedBy });
    res.status(201).json(created);
  });

  router.post('/requests/merged', async (req, res) => {
    const { object_kind, object_attributes } = req.body;

    if (object_kind !== 'merge_request' || object_attributes?.action !== 'merge') {
      res.status(200).json({ ignored: true });
      return;
    }

    const mergedPrUrl: string = object_attributes?.url;
    if (!mergedPrUrl) {
      res.status(400).json({ error: 'No URL in payload' });
      return;
    }

    const normalise = (u: string) => u.trim().replace(/\/$/, '').toLowerCase();
    const all = await store.list();
    const match = all.find(r => normalise(r.prLink) === normalise(mergedPrUrl));

    if (!match) {
      res.status(200).json({ ignored: true, reason: 'no matching request' });
      return;
    }

    if (match.status !== 'pending_pr') {
      res.status(409).json({ error: `status is ${match.status}, expected pending_pr` });
      return;
    }

    const result = checkTransition('MERGE_PR', match.status as Status, 'mlops-team');
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }

    const updated = await store.applyTransition(match.id, result.to, {
      actor: object_attributes?.user?.name ?? 'gitlab-webhook',
      action: 'MERGE_PR',
      fromStatus: match.status,
    });

    broadcast('request_updated', updated);
    res.json(updated);
  });

  // NOTE: this must come AFTER /requests/merged to avoid :id capturing "merged"
  router.post('/requests/:id/transition', async (req, res) => {
    const { action, actorGroup, actor, comment } = req.body as {
      action: Action;
      actorGroup: string;
      actor: string;
      comment?: string;
    };

    const existing = await store.getById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'request not found' });
      return;
    }

    const result = checkTransition(action, existing.status as Status, actorGroup);
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }

    const updated = await store.applyTransition(existing.id, result.to, {
      actor,
      action,
      fromStatus: existing.status,
      comment,
    });

    res.json(updated);
  });

  router.get('/requests/:id/events', async (req, res) => {
    const existing = await store.getById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'request not found' });
      return;
    }
    res.json(await store.getEvents(existing.id));
  });

  return router;
}