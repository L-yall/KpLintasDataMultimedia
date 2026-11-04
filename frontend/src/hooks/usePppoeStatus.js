import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

export default function usePppoeStatus(socket, token) {
  const [telemetry, setTelemetry] = useState({ phase: 'loading', activeUsernames: [] });

  useEffect(() => {
    let mounted = true;
    let inFlight = false;
    let revision = 0;

    function markUnavailable() {
      revision += 1;
      setTelemetry({ phase: 'unavailable', activeUsernames: [] });
    }

    async function refresh() {
      if (inFlight) return;
      inFlight = true;
      const requestRevision = ++revision;
      try {
        const response = await axios.get(API_BASE_URL + '/api/mikrotik/active', {
          headers: { Authorization: 'Bearer ' + token },
          timeout: 10000
        });
        if (!mounted || requestRevision !== revision) return;
        if (!response.data.success || !Array.isArray(response.data.data)) {
          markUnavailable();
          return;
        }
        setTelemetry({
          phase: 'ready',
          activeUsernames: response.data.data.map(connection => connection.name).filter(Boolean)
        });
      } catch (error) {
        if (mounted && requestRevision === revision) markUnavailable();
      } finally {
        inFlight = false;
      }
    }

    function handleRouterPing(status) {
      if (status.online === false) markUnavailable();
    }

    function handleSummary(summary) {
      if (summary.telemetry_available === false) {
        markUnavailable();
      } else if (Array.isArray(summary.active_usernames)) {
        revision += 1;
        setTelemetry({ phase: 'ready', activeUsernames: summary.active_usernames });
      }
    }

    refresh();
    // REST polling also keeps the indicator current when WebSocket is unavailable.
    const interval = setInterval(refresh, 30000);
    if (socket) {
      socket.on('mikrotik_ping', handleRouterPing);
      socket.on('pppoe_summary', handleSummary);
      socket.on('disconnect', markUnavailable);
      socket.on('connect', refresh);
    }

    return () => {
      mounted = false;
      revision += 1;
      clearInterval(interval);
      if (socket) {
        socket.off('mikrotik_ping', handleRouterPing);
        socket.off('pppoe_summary', handleSummary);
        socket.off('disconnect', markUnavailable);
        socket.off('connect', refresh);
      }
    };
  }, [socket, token]);

  const activeUsernames = useMemo(() => new Set(telemetry.activeUsernames), [telemetry.activeUsernames]);
  const getConnectionStatus = useCallback(username => {
    if (telemetry.phase === 'loading') return 'unknown';
    if (telemetry.phase === 'unavailable') return 'unavailable';
    return activeUsernames.has(username) ? 'active' : 'inactive';
  }, [telemetry.phase, activeUsernames]);

  return getConnectionStatus;
}
