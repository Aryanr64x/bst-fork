import React from 'react';
import { Typography } from '@mui/material';
import { ProductionRequest } from '../interfaces';
import { RequestListItem } from './RequestListItem';

export const RequestList = ({
  requests, canApprove, canSignoff, busy, onApprove, onReject, onSignoff,
}: {
  requests: ProductionRequest[];
  canApprove: boolean;
  canSignoff: boolean;
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSignoff: (id: string) => void;
}) => {
  if (requests.length === 0) {
    return <Typography color="textSecondary">No requests yet.</Typography>;
  }
  return (
    <>
      {requests.map(req => (
        <RequestListItem
          key={req.id} request={req} canApprove={canApprove} canSignoff={canSignoff} busy={busy}
          onApprove={onApprove} onReject={onReject} onSignoff={onSignoff}
        />
      ))}
    </>
  );
};