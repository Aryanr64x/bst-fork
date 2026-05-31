import { useEffect } from 'react';
import { useProductionRequestsApi } from '../api/ProductionRequests';

/**
 * Subscribes to the SSE stream and calls onUpdate whenever
 * a `request_updated` event arrives.
 */
export function useRequestsStream(onUpdate: () => void) {
  const api = useProductionRequestsApi();

  useEffect(() => {
    let es: EventSource;

    api.streamUrl().then(url => {
      console.log('🔌 Connecting SSE to:', url);
      es = new EventSource(url, { withCredentials: true });

      es.onopen = () => console.log('✅ SSE connected');
      es.onerror = (e) => console.error('❌ SSE error', e);
      
      // Log ALL events, not just request_updated
      es.onmessage = (e) => console.log('📨 SSE generic message:', e);
      
      es.addEventListener('request_updated', (e) => {
        console.log('🔔 request_updated received!', e);
        onUpdate();
      });
    });

    return () => es?.close();
  }, [api, onUpdate]);
}