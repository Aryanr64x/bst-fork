import {
  DiscoveryApi,
  FetchApi,
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';
import { useMemo } from 'react';
import { ProductionRequest, RequestEvent } from '../../interfaces';

export type CreateRequestPayload = {
  apiRef: string;
  title: string;
  prLink: string;
  branch: string;
  changeType: string;
  description?: string;
  requestedBy: string;
};


export type TransitionPayload = {
  action: string;
  actorGroup: string;
  actor: string;
  comment?: string;
};

export class ProductionRequestsApi {
  constructor(
    private readonly discovery: DiscoveryApi,
    private readonly fetchApi: FetchApi,
  ) {}

  private async base() {
    return this.discovery.getBaseUrl('production-requests');
  }

  // ✅ NEW: SSE stream URL
  async streamUrl(): Promise<string> {
    return `${await this.base()}/events/stream`;
  }

  async list(apiRef: string): Promise<ProductionRequest[]> {
    const res = await this.fetchApi.fetch(
      `${await this.base()}/requests?apiRef=${encodeURIComponent(apiRef)}`,
    );

    if (!res.ok) {
      throw new Error(`Failed to load requests (${res.status})`);
    }

    return res.json();
  }

  async create(payload: CreateRequestPayload): Promise<ProductionRequest> {
    const res = await this.fetchApi.fetch(`${await this.base()}/requests`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Failed to create request (${res.status})`);
    }

    return res.json();
  }

  async transition(
    id: string,
    payload: TransitionPayload,
  ): Promise<ProductionRequest> {
    const res = await this.fetchApi.fetch(
      `${await this.base()}/requests/${id}/transition`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `Transition failed (${res.status})`);
    }

    return res.json();
  }

  async events(id: string): Promise<RequestEvent[]> {
    const res = await this.fetchApi.fetch(
      `${await this.base()}/requests/${id}/events`,
    );

    if (!res.ok) {
      throw new Error(`Failed to load history (${res.status})`);
    }

    return res.json();
  }
}

export function useProductionRequestsApi() {
  const discovery = useApi(discoveryApiRef);
  const fetchApi = useApi(fetchApiRef);

  return useMemo(
    () => new ProductionRequestsApi(discovery, fetchApi),
    [discovery, fetchApi],
  );
}