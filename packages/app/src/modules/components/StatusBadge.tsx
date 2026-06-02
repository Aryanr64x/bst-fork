import React from 'react';
import { Chip } from '@mui/material';

type MuiColor =
  | 'default'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

const STATUS_META: Record<string, { label: string; color: MuiColor }> = {
  pending_manager_approval: {
    label: 'A new request has been raised. Pending Manager Approval',
    color: 'warning',
  },

  pending_pr: {
    label: 'Waiting for Application PR Merge',
    color: 'secondary',
  },

  pending_staging_ci: {
    label: 'Waiting for Staging CI to finish',
    color: 'info',
  },

  pending_staging_manifest_pr: {
    label: 'Waiting for Staging Manifest PR Merge',
    color: 'secondary',
  },

  pending_staging_cd: {
    label: 'Pending Staging CD',
    color: 'info',
  },

  pending_staging_signoff: {
    label: 'Pending Staging Sign-Off',
    color: 'warning',
  },

  pending_prod_ci: {
    label: 'Running Production CI',
    color: 'info',
  },

  pending_prod_manifest_pr: {
    label: 'Waiting for Production Manifest PR Merge',
    color: 'secondary',
  },

  pending_prod_cd: {
    label: 'Running Production CD',
    color: 'info',
  },

  completed: {
    label: 'Deployment Completed',
    color: 'success',
  },

  rejected: {
    label: 'Request Rejected',
    color: 'error',
  },
};

export const StatusBadge = ({ status }: { status: string }) => {
  const meta = STATUS_META[status] ?? {
    label: status,
    color: 'default' as MuiColor,
  };

  return (
    <Chip
      size="small"
      label={meta.label}
      color={meta.color}
    />
  );
};