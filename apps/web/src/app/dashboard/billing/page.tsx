'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Subscription {
  plan: string;
  status: string;
  assistant_limit: number;
  current_period_end: string | null;
}

export default function BillingPage() {
  const [sub, setSub] = useState<Subscription | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');

    const loadSubscription = () => {
      api.billing.subscription().then((r) => setSub(r.subscription as Subscription));
    };

    if (sessionId) {
      api.billing.completeCheckout(sessionId).then(() => {
        loadSubscription();
        const next = new URL(window.location.href);
        next.searchParams.delete('session_id');
        window.history.replaceState({}, '', next.toString());
      });
    } else {
      loadSubscription();
    }
  }, []);

  async function upgrade(planId: string) {
    const { checkoutUrl } = await api.billing.checkout(planId);
    window.location.href = checkoutUrl;
  }

  async function managePortal() {
    const { portalUrl } = await api.billing.portal();
    window.location.href = portalUrl;
  }

  return (
    <main style={{ maxWidth: 600, margin: '40px auto', padding: 24 }}>
      <a href="/dashboard">← Back</a>
      <h1>Billing</h1>
      {sub && (
        <div>
          <p>Plan: <strong>{sub.plan}</strong></p>
          <p>Status: {sub.status}</p>
          <p>Assistant limit: {sub.assistant_limit}</p>
          {sub.current_period_end && <p>Renews: {new Date(sub.current_period_end).toLocaleDateString()}</p>}
        </div>
      )}
      <h2>Upgrade</h2>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => upgrade('starter')}>Starter — $29/mo</button>
        <button onClick={() => upgrade('growth')}>Growth — $79/mo</button>
        <button onClick={() => upgrade('pro')}>Pro — $199/mo</button>
      </div>
      <hr />
      <button onClick={managePortal}>Manage billing portal</button>
    </main>
  );
}
