import React from 'react';
import { Box, Button, Link, Typography } from '@mui/material';
import { ProductionRequest } from '../interfaces';
import { StatusBadge } from './StatusBadge';

export const RequestDetail = ({ request, onBack }: {
  request: ProductionRequest;
  onBack: () => void;
}) => (
  <Box>
    <Button onClick={onBack} size="small">← Back to list</Button>
    <Box display="flex" alignItems="center" gap={1} mt={1}>
      <Typography variant="h6">{request.title}</Typography>
      <StatusBadge status={request.status} />
    </Box>
    <Typography variant="caption" color="textSecondary" display="block" gutterBottom>
      Raised by {request.requestedBy} · {new Date(request.createdAt).toLocaleString()}
    </Typography>

    <Typography variant="subtitle2" mt={2}>PR</Typography>
    <Link href={request.prLink} target="_blank" rel="noopener">{request.prLink}</Link>

    {request.stagingManifestPrLink && (
      <>
        <Typography variant="subtitle2" mt={2}>Staging Manifest PR</Typography>
        <Link href={request.stagingManifestPrLink} target="_blank" rel="noopener">
          {request.stagingManifestPrLink}
        </Link>
      </>
    )}

    <Typography variant="subtitle2" mt={2}>Description</Typography>
    <Typography variant="body2">{request.description || 'No description provided.'}</Typography>
  </Box>
);