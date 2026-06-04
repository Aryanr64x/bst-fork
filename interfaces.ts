export interface MockUser{
    id: string;
    name: string;
    email: string;
    group: 'mlops-team' | 'qa-signoff-team' | 'manager-approvers' | 'chat-api-team';
    label: string;
};  


export interface  ProductionRequest{
  id: string;
  apiRef: string;
  title: string;
  prLink: string;
  stagingManifestPrLink?: string | null;
  prodManifestPrLink?: string | null;
  description: string;
  requestedBy: string;
  status: string;
  createdAt: string;
};



export type RequestEvent = {
  id: number;
  actor: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  comment: string | null;
  createdAt: string;
};