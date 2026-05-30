'use client';

import { useState } from 'react';
import { Button } from './button';

export function AuthPanel({ mode = 'admin' }: { mode?: 'admin' | 'user' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    setPending(true);
    setStatus(null);
    try {
      const response = await fetch('/api/auth/sign-in', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await response.json() as { message?: string };
      if (!response.ok) setStatus(payload.message ?? 'Sign-in could not be completed.');
      else window.location.href = mode === 'admin' ? '/en/admin' : '/en/dashboard';
    } catch {
      setStatus('Network error. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="glass mx-auto w-full max-w-md rounded-[2rem] p-6 shadow-glow">
      <h1 className="text-3xl font-black tracking-[-0.03em] text-white">{mode === 'admin' ? 'Admin CMS login' : 'Account login'}</h1>
      <p className="mt-3 text-sm leading-6 text-white/60">Use your approved Supabase account. Admin access requires an approved role in the admin profile table.</p>
      <div className="mt-6 space-y-4">
        <label className="block"><span className="input-label">Email</span><input className="input-field" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="block"><span className="input-label">Password</span><input className="input-field" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <Button className="w-full" disabled={pending || !email || !password} onClick={submit}>{pending ? 'Signing in…' : 'Sign in securely'}</Button>
        {status ? <p className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">{status}</p> : null}
      </div>
    </div>
  );
}
