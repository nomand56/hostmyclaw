'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface AssistantStatus {
  assistantId: string;
  status: string;
  url: string | null;
  healthStatus: string;
  error: string | null;
}

interface Log {
  id: string;
  type: string;
  level: string;
  message: string;
  timestamp: string;
}

export default function AssistantDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [status, setStatus] = useState<AssistantStatus | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    api.assistants.status(id).then((s) => setStatus(s as AssistantStatus));
    api.assistants.logs(id).then((r) => setLogs(r.logs as Log[]));

    const interval = setInterval(() => {
      api.assistants.status(id).then((s) => setStatus(s as AssistantStatus));
    }, 10_000);

    return () => clearInterval(interval);
  }, [id]);

  async function deploy() {
    await api.assistants.deploy(id);
    setStatus((s) => s ? { ...s, status: 'queued' } : s);
  }

  async function stop() {
    await api.assistants.stop(id);
    setStatus((s) => s ? { ...s, status: 'stopping' } : s);
  }

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <a href="/dashboard">← Back</a>
      <h1>Assistant</h1>
      {status && (
        <div>
          <p>Status: <strong>{status.status}</strong></p>
          {status.url && <p>URL: <a href={status.url} target="_blank">{status.url}</a></p>}
          {status.healthStatus && <p>Health: {status.healthStatus}</p>}
          {status.error && <p style={{ color: 'red' }}>Error: {status.error}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            {['draft', 'stopped', 'failed'].includes(status.status) && (
              <button onClick={deploy}>Deploy</button>
            )}
            {status.status === 'running' && (
              <button onClick={stop}>Stop</button>
            )}
          </div>
        </div>
      )}
      <h2>Logs</h2>
      <div style={{ fontFamily: 'monospace', fontSize: 12, background: '#111', color: '#eee', padding: 16, maxHeight: 400, overflowY: 'auto' }}>
        {logs.map((log) => (
          <div key={log.id} style={{ color: log.level === 'error' ? '#f88' : '#eee' }}>
            [{log.timestamp}] [{log.type}] {log.message}
          </div>
        ))}
        {logs.length === 0 && <div>No logs yet.</div>}
      </div>
    </main>
  );
}
