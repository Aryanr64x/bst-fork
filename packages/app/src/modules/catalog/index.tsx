import React, { useState, useEffect, useCallback } from 'react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
import { useApi, identityApiRef } from '@backstage/core-plugin-api';
import { Button, Box, Typography } from '@mui/material';
import { InfoCard } from '@backstage/core-components';

import { ProductionRequest } from '../../interfaces';
import {
  RaiseRequestForm,
  NewRequestInput,
} from '../components/RaiseRequestForm';
import { RequestList } from '../components/RequestList';
import { useProductionRequestsApi } from '../api/ProductionRequests';
import { RequestDetail } from '../components/RequestListDetail';
import { useRequestsStream } from '../hooks/useRequestsStream';
import { useCatalogUsers } from '../hooks/useCatalogUsers';

const ProductionRequestsPage = () => {
  const { entity } = useEntity();
  const api = useProductionRequestsApi();
  const identityApi = useApi(identityApiRef);
  const apiRef = `api:default/${entity.metadata.name}`;

  const { users, loading } = useCatalogUsers();

  // the signed-in user's id (e.g. "pramod.reddy"), resolved from their identity
  const [signedInId, setSignedInId] = useState<string | null>(null);
  const [identityResolved, setIdentityResolved] = useState(false);

  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // resolve who's logged in, once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await identityApi.getBackstageIdentity();
        // userEntityRef looks like "user:default/pramod.reddy"
        const name = id.userEntityRef.split('/').pop() ?? null;
        if (!cancelled) setSignedInId(name);
      } catch {
        if (!cancelled) setSignedInId(null);
      } finally {
        if (!cancelled) setIdentityResolved(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [identityApi]);

  // match the signed-in id to the catalog user (gives us name + group)
  const currentUser = users.find(u => u.id === signedInId) ?? null;

  const loadRequests = useCallback(async () => {
    try {
      const data = await api.list(apiRef);
      setRequests(data);
      setError(null);
    } catch (e) {
      setError(String(e));
    }
  }, [api, apiRef]);

  useRequestsStream(loadRequests);
  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleCreate = async (input: NewRequestInput) => {
    if (!currentUser) return;
    setBusy(true);
    try {
      await api.create({
        apiRef,
        requestedBy: currentUser.name,
        ...input,
      });
      setMode('list');
      await loadRequests();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const runTransition = async (id: string, action: string) => {
    if (!currentUser) return;
    setBusy(true);
    try {
      await api.transition(id, {
        action,
        actorGroup: currentUser.group,
        actor: currentUser.name,
      });
      await loadRequests();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  // wait for both the catalog users AND the identity to resolve
  if (loading || !identityResolved) {
    return <div style={{ padding: 24 }}>Loading…</div>;
  }

  // signed in, but their identity didn't match any catalog user we loaded
  if (!currentUser) {
    return (
      <div style={{ padding: 24 }}>
        <Typography color="error">
          Signed-in user{signedInId ? ` "${signedInId}"` : ''} was not found
          among catalog users, or has no group. Production request actions are
          unavailable.
        </Typography>
      </div>
    );
  }

  const selected = requests.find(r => r.id === selectedId) ?? null;

  return (
    <div style={{ padding: 24, width: '100%' }}>
      <h1>Production Requests</h1>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <Typography>
          Logged in as <strong>{currentUser.name}</strong> (
          {currentUser.group})
        </Typography>
      </div>

      {error && (
        <Typography color="error" gutterBottom>
          {error}
        </Typography>
      )}

      {selected ? (
        <RequestDetail
          request={selected}
          onBack={() => setSelectedId(null)}
        />
      ) : (
        <>
          {currentUser.group === 'chat-api-team' &&
            (mode === 'create' ? (
              <RaiseRequestForm
                apiName={entity.metadata.name}
                requestedBy={currentUser.name}
                onSubmit={handleCreate}
                onCancel={() => setMode('list')}
              />
            ) : (
              <Button variant="contained" onClick={() => setMode('create')}>
                Raise New Request
              </Button>
            ))}

          <Box mt={2}>
            <InfoCard title="Requests">
              <RequestList
                requests={requests}
                canApprove={currentUser.group === 'manager-approvers'}
                busy={busy}
                onApprove={id => runTransition(id, 'APPROVE')}
                onReject={id => runTransition(id, 'REJECT')}
              />
            </InfoCard>
          </Box>
        </>
      )}
    </div>
  );
};

const JenkinsJobPage = () => {
  const { entity } = useEntity();
  const jobName = entity.metadata.name;

  return (
    <div style={{ height: 'calc(100vh - 200px)', padding: 8 }}>
      <iframe
        src={`http://localhost:8080/job/${jobName}/`}
        style={{ width: '100%', height: '100%', border: 'none' }}
        title="Jenkins job"
      />
    </div>
  );
};

const productionRequestsContent = EntityContentBlueprint.make({
  name: 'production-requests',
  params: {
    path: '/production-requests',
    title: 'Production Requests',
    filter: entity =>
      entity.kind.toLowerCase() === 'api' &&
      entity.metadata.name === 'chat-api',
    loader: async () => <ProductionRequestsPage />,
  },
});

const jenkinsJobContent = EntityContentBlueprint.make({
  name: 'jenkins-job',
  params: {
    path: '/jenkins',
    title: 'Jenkins',
    filter: entity =>
      entity.kind.toLowerCase() === 'api' &&
      entity.metadata.name === 'chat-api',
    loader: async () => <JenkinsJobPage />,
  },
});

export const catalogModule = createFrontendModule({
  pluginId: 'catalog',
  extensions: [productionRequestsContent, jenkinsJobContent],
});