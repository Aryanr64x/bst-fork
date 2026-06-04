import { LoggerService } from '@backstage/backend-plugin-api';
import { Router } from 'express';
import express from 'express';
import { RequestsStore } from './database/RequestStore';
import { Action, Status, checkTransition } from './workflow';



export async function createRouter(opts: {
  logger: LoggerService;
  store: RequestsStore;
  jenkinsClient: any;
  gitlabClient: any;
  argocdClient: any;
}) {
  const { store, logger, jenkinsClient, gitlabClient, argocdClient } = opts;
  const router = Router();
  router.use(express.json());

  // moving this inside createRouter to guarantee closure
  const clients = new Set<express.Response>();

  function broadcast(event: string, data: unknown) {
  logger.info(`[SSE] broadcasting to ${clients.size} clients`);
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    client.write(payload);
    // doing force flush after broadcast
    (client as any).flush?.();  
  }
}

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });  
  });
  

 router.get('/events/stream', (req, res) => {
  console.log(' SSE client connecting...');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Content-Encoding', 'identity');
  res.flushHeaders();



  // mandatory force flush we are performing 
 const heartbeat = setInterval(() => {
  res.write(': ping\n\n');
  (res as any).flush?.(); 
}, 5_000);

  clients.add(res);
  console.log(`✅ SSE client added. Total: ${clients.size}`);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    console.log(` SSE client removed. Total: ${clients.size}`);
  });
});

  router.get('/requests', async (req, res) => {
    res.json(await store.list(req.query.apiRef as string | undefined));
  });

 router.post('/requests', async (req, res) => {
  const { apiRef, title, prLink, description, requestedBy, branch, changeType } = req.body;
  if (!apiRef || !title || !prLink || !requestedBy || !branch || !changeType) {
    res.status(400).json({
      error: 'apiRef, title, prLink, branch, changeType, requestedBy are required',
    });
    return;                            
  }

 
    let issue;
    try {
      issue = await gitlabClient.createIssue({
        title,
        description: description ?? '',
      });
    } catch (e) {
      logger.error(`Issue creation failed: ${e}`);
      res.status(502).json({ error: `Failed to create tracking issue: ${e}` });
      return;
    }

    try {
      const created = await store.insert({
        apiRef, title, prLink, branch, changeType,
        issueId: issue.iid, issueLink: issue.url,
        description, requestedBy,
      });
      res.status(201).json(created);
    } catch (e) {
      logger.error(`Insert failed after creating issue !${issue.iid}: ${e}`);
      res.status(500).json({
        error: 'Request creation failed after issue was created',
        orphanedIssueUrl: issue.url,
      });
    }
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

    // but now also run jenkins job from here as part of automation 
    const jobName = updated.apiRef.split('/').pop()!;

  jenkinsClient
  .triggerBuild(jobName, { requestId: updated.id })
  .catch((err: unknown) => {
    logger.error(
      
      `Jenkins trigger failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  });
    res.json(updated);
  });


  // ── Jenkins staging-CI callback ─────────────────────────────────
  // Jenkins runs the staging CI job (triggered from /requests/merged),
  // opens the staging manifest PR, then calls back here with the request
  // id (passed to it as a build param) plus the manifest PR link.
  // Advances pending_staging_ci → pending_staging_manifest_pr.
  router.post('/requests/jenkins/staging-callback', async (req, res) => {
    const { requestId, staging_manifest_pr_link: stagingManifestPrLink } = req.body;

    if (!requestId || !stagingManifestPrLink) {
      res.status(400).json({
        error: 'requestId and staging_manifest_pr_link are required',
      });
      return;
    }

    const existing = await store.getById(requestId);
    if (!existing) {
      res.status(404).json({ error: 'request not found' });
      return;
    }

    const result = checkTransition('RUN_STAGING_CI', existing.status as Status, 'mlops-team');
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }

    // persist the manifest PR link first so the broadcast carries it
    await store.updateManifestPrLinks(existing.id, { stagingManifestPrLink });

    const updated = await store.applyTransition(existing.id, result.to, {
      actor: 'jenkins',
      action: 'RUN_STAGING_CI',
      fromStatus: existing.status,
    });

    broadcast('request_updated', updated);
    res.json(updated);
  });

  // ── Staging manifest PR merged (GitLab webhook) ─────────────────
  // Same shape as /requests/merged, but matches on the staging manifest
  // PR link. Advances pending_staging_manifest_pr → pending_staging_cd,
  // then kicks off ArgoCD sync (the way MERGE_PR kicks off Jenkins).
  router.post('/requests/staging-manifest/merged', async (req, res) => {
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
    const match = all.find(
      r =>
        r.stagingManifestPrLink &&
        normalise(r.stagingManifestPrLink) === normalise(mergedPrUrl),
    );

    if (!match) {
      res.status(200).json({ ignored: true, reason: 'no matching request' });
      return;
    }

    if (match.status !== 'pending_staging_manifest_pr') {
      res.status(409).json({
        error: `status is ${match.status}, expected pending_staging_manifest_pr`,
      });
      return;
    }

    const result = checkTransition(
      'MERGE_STAGING_MANIFEST_PR',
      match.status as Status,
      'mlops-team',
    );
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }

    const updated = await store.applyTransition(match.id, result.to, {
      actor: object_attributes?.user?.name ?? 'gitlab-webhook',
      action: 'MERGE_STAGING_MANIFEST_PR',
      fromStatus: match.status,
    });

    broadcast('request_updated', updated);

    // kick off the ArgoCD sync, passing the request id along (fire-and-forget)
    const appName = updated.apiRef.split('/').pop()!;
    argocdClient
      .sync(appName, { requestId: updated.id })
      .catch((err: unknown) => {
        logger.error(
          `ArgoCD sync failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      });

    res.json(updated);
  });

  // ── ArgoCD staging sync-success callback ────────────────────────
  // ArgoCD reports a successful staging sync (carrying the request id we
  // passed in the sync `infos`). Advances pending_staging_cd →
  // pending_staging_signoff.
  router.post('/requests/argocd/staging-callback', async (req, res) => {
    const { requestId } = req.body;

    if (!requestId) {
      res.status(400).json({ error: 'requestId is required' });
      return;
    }

    const existing = await store.getById(requestId);
    if (!existing) {
      res.status(404).json({ error: 'request not found' });
      return;
    }

    const result = checkTransition('RUN_STAGING_CD', existing.status as Status, 'mlops-team');
    if (!result.ok) {
      res.status(409).json({ error: result.reason });
      return;
    }

    const updated = await store.applyTransition(existing.id, result.to, {
      actor: 'argocd',
      action: 'RUN_STAGING_CD',
      fromStatus: existing.status,
    });

    broadcast('request_updated', updated);
    res.json(updated);
  });

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