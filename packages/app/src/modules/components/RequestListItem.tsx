import React, { useState } from 'react';
import {
  Accordion, AccordionSummary, AccordionDetails,
  Box, Button, Typography, Divider, CircularProgress,
} from '@mui/material';
import { ProductionRequest, RequestEvent } from '../interfaces';
import { StatusBadge } from './StatusBadge';
import { useProductionRequestsApi } from '../api/ProductionRequests';

export const RequestListItem = ({
  request, canApprove, canSignoff, busy, onApprove, onReject, onSignoff,
}: {
  request: ProductionRequest;
  canApprove: boolean;
  canSignoff: boolean;
  busy: boolean;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSignoff: (id: string) => void;
}) => {
  const api = useProductionRequestsApi();
  const [events, setEvents] = useState<RequestEvent[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const handleExpand = async (_e: React.SyntheticEvent, expanded: boolean) => {
    if (expanded && events === null && !loadingEvents) {
      setLoadingEvents(true);
      try {
        setEvents(await api.events(request.id));
      } catch {
        setEvents([]);
      } finally {
        setLoadingEvents(false);
      }
    }
  };

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <Accordion
      onChange={handleExpand}
      disableGutters
      sx={{
        '&:before': { display: 'none' },
        border: '1px solid #e3e6ea',
        borderRadius: 1,
        mb: 1,
      }}
    >
      <AccordionSummary expandIcon={<Box component="span" sx={{ fontSize: 18 }}>⌄</Box>}>
        <Box display="flex" alignItems="center" justifyContent="space-between" width="100%" pr={1}>
          <Box>
            <Typography variant="subtitle1">{request.title}</Typography>
            <Typography variant="caption" color="text.secondary">
              by {request.requestedBy}
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={1}>
            <StatusBadge status={request.status} />
            {canApprove && request.status === 'pending_manager_approval' && (
              <>
                <Button
                  size="small"
                  variant="contained"
                  color="success"
                  disabled={busy}
                  onClick={stop(() => onApprove(request.id))}
                  onFocus={e => e.stopPropagation()}
                >
                  Approve
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  color="error"
                  disabled={busy}
                  onClick={stop(() => onReject(request.id))}
                  onFocus={e => e.stopPropagation()}
                >
                  Reject
                </Button>
              </>
            )}

            {canSignoff && request.status === 'pending_staging_signoff' && (
              <Button
                size="small"
                variant="contained"
                color="success"
                disabled={busy}
                onClick={stop(() => onSignoff(request.id))}
                onFocus={e => e.stopPropagation()}
              >
                Sign Off
              </Button>
            )}
          </Box>
        </Box>
      </AccordionSummary>

      <AccordionDetails>
        <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
          <Button
            variant="outlined"
            size="small"
            href={request.prLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            View Code PR ↗
          </Button>

          {request.issueLink && (
            <Button
              variant="outlined"
              size="small"
              href={request.issueLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              View GitLab Issue{request.issueId ? ` #${request.issueId}` : ''} ↗
            </Button>
          )}

          {request.stagingManifestPrLink && (
            <Button
              variant="outlined"
              size="small"
              href={request.stagingManifestPrLink}
              target="_blank"
              rel="noopener noreferrer"
            >
              View Staging Manifest PR ↗
            </Button>
          )}
        </Box>

        <Typography variant="subtitle2">Description</Typography>
        <Typography variant="body2">
          {request.description || 'No description provided.'}
        </Typography>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>History</Typography>
        {loadingEvents ? (
          <CircularProgress size={18} />
        ) : events && events.length > 0 ? (
          events.map(ev => (
            <Box key={ev.id} mb={1}>
              <Typography variant="body2">
                <strong>{ev.action}</strong>
                {ev.fromStatus
                  ? ` · ${ev.fromStatus} → ${ev.toStatus}`
                  : ` · ${ev.toStatus}`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {ev.actor} · {new Date(ev.createdAt).toLocaleString()}
              </Typography>
            </Box>
          ))
        ) : (
          <Typography variant="body2" color="text.secondary">No history.</Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};