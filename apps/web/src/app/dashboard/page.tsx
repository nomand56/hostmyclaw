'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Assistant {
  id: string;
  name: string;
  status: string;
  subdomain: string | null;
}

export default function DashboardPage() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);

  useEffect(() => {
    api.assistants.list().then((r) => setAssistants(r.assistants as Assistant[]));
  }, []);

  return (
    <main style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Assistants</h1>
        <a href="/dashboard/assistants/new">
          <button>+ New assistant</button>
        </a>
      </div>
      {assistants.length === 0 ? (
        <p>No assistants yet. Create your first one.</p>
      ) : (
        <ul>
          {assistants.map((a) => (
            <li key={a.id} style={{ marginBottom: 12 }}>
              <a href={`/dashboard/assistants/${a.id}`}>
                <strong>{a.name}</strong>
              </a>{' '}
              — <span>{a.status}</span>
            </li>
          ))}
        </ul>
      )}
      <hr />
      <a href="/dashboard/billing">Billing</a>
    </main>
  );
}
