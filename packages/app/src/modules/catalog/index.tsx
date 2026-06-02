import React, { useState, useEffect, useCallback } from 'react';
import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';
import { useEntity } from '@backstage/plugin-catalog-react';
import { Button, Box, Typography } from '@mui/material';
import { InfoCard } from '@backstage/core-components';

import { MockUser, ProductionRequest } from '../../interfaces';
import {
  RaiseRequestForm,
  NewRequestInput,
} from '../components/RaiseRequestForm';
import { RequestList } from '../components/RequestList';
import { useProductionRequestsApi } from '../api/ProductionRequests';
import { RequestDetail } from '../components/RequestListDetail';
import { useRequestsStream } from '../hooks/useRequestsStream';

const mockUsers: MockUser[] = [
  {
    id: 'Pramod Reddy',
    name: 'Pramod Reddy',
    email: '',
    group: 'chat-api-team',
    label: 'Pramod Reddy',
  },
  {
    id: 'Prashant Devadiga',
    name: 'Prashant Devadiga',
    email: '',
    group: 'manager-approvers',
    label: 'Prashant Devadiga',
  },
  {
    id: 'Akshit Saini',
    name: 'Akshit Saini',
    email: '',
    group: 'mlops-team',
    label: 'Akshit Saini',
  },
  {
    id: 'Hritik Kadam',
    name: 'Hritik Kadam',
    email: '',
    group: 'qa-signoff-team',
    label: 'Hritik Kadam',
  },
];

const ProductionRequestsPage = () => {
  const { entity } = useEntity();
  const api = useProductionRequestsApi();
  const apiRef = `api:default/${entity.metadata.name}`;

  const [currentUserId, setCurrentUserId] = useState(mockUsers[0].id);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [requests, setRequests] = useState<ProductionRequest[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentUser =
    mockUsers.find(u => u.id === currentUserId) ?? mockUsers[0];

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

  const selected =
    requests.find(r => r.id === selectedId) ?? null;

  return (
    <div style={{ padding: 24, width: '100%' }} >
      <h1>Production Requests</h1>

      <div style={{ marginTop: 24, marginBottom: 24 }}>
        <label>
          Current user:{' '}
          <select
            value={currentUserId}
            onChange={e => setCurrentUserId(e.target.value)}
          >
            {mockUsers.map(u => (
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
              <Button
                variant="contained"
                onClick={() => setMode('create')}
              >
                Raise New Request
              </Button>
            ))}

          <Box mt={2}>
            <InfoCard title="Requests">
              <RequestList
                requests={requests}
                canApprove={
                  currentUser.group === 'manager-approvers'
                }
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