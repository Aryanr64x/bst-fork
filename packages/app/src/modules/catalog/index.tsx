import React, { useState, useEffect, useCallback } from 'react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
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
  const apiRef = `api:default/${entity.metadata.name}`;

  const { users, loading } = useCatalogUsers();

  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pick a sensible default once the catalog users load
  useEffect(() => {
    if (!currentUserId && users.length > 0) {
      setCurrentUserId(users[0].id);
    }
  }, [users, currentUserId]);

  const currentUser = users.find(u => u.id === currentUserId) ?? users[0];

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

  // guard the first paint: currentUser is undefined until the catalog responds
  if (loading || !currentUser) {
    return <div style={{ padding: 24 }}>Loading users…</div>;
  }

  const selected = requests.find(r => r.id === selectedId) ?? null;

  return (
    <div style={{ padding: 24, width: '100%' }}>
      <h1>Production Requests</h1>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <label>
          Current user:{' '}
          <select
            value={currentUserId}
            onChange={e => setCurrentUserId(e.target.value)}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        </label>

        <p>
          Logged in as <strong>{currentUser.name}</strong> (
          {currentUser.group})
        </p>
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
  const jobName = entity.metadata.name; // "chat-api" → /job/chat-api/

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