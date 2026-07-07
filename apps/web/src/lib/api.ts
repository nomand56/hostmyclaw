const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? 'Request failed');
  }

  return res.json() as Promise<T>;
}

export const api = {
  auth: {
    register: (body: { email: string; password: string; name: string }) =>
      request<{ accessToken: string }>('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<{ accessToken: string }>('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request<{ user: { id: string; email: string; name: string; plan: string } }>('/auth/me'),
  },
  assistants: {
    list: () => request<{ assistants: unknown[] }>('/assistants'),
    get: (id: string) => request<unknown>(`/assistants/${id}`),
    create: (body: { name: string; templateId?: string; skills?: string[]; config?: Record<string, unknown> }) =>
      request<unknown>('/assistants', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: { name?: string; config?: Record<string, unknown> }) =>
      request<unknown>(`/assistants/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => request<void>(`/assistants/${id}`, { method: 'DELETE' }),
    deploy: (id: string) => request<{ jobId: string; status: string }>(`/assistants/${id}/deploy`, { method: 'POST' }),
    stop: (id: string) => request<{ status: string }>(`/assistants/${id}/stop`, { method: 'POST' }),
    restart: (id: string) => request<{ status: string }>(`/assistants/${id}/restart`, { method: 'POST' }),
    status: (id: string) => request<unknown>(`/assistants/${id}/status`),
    logs: (id: string, params?: { type?: string; limit?: number; cursor?: string }) => {
      const qs = new URLSearchParams(params as Record<string, string>).toString();
      return request<{ logs: unknown[]; nextCursor: string | null }>(`/assistants/${id}/logs?${qs}`);
    },
  },
  templates: {
    list: () => request<{ templates: unknown[] }>('/templates'),
    get: (id: string) => request<unknown>(`/templates/${id}`),
  },
  skills: {
    list: () => request<{ skills: unknown[] }>('/skills'),
  },
  billing: {
    checkout: (planId: string) =>
      request<{ checkoutUrl: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ planId }) }),
    subscription: () => request<{ subscription: unknown }>('/billing/subscription'),
    portal: () => request<{ portalUrl: string }>('/billing/portal', { method: 'POST' }),
    completeCheckout: (sessionId: string) =>
      request<{ success: boolean }>('/billing/checkout/success', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) }),
  },
};
