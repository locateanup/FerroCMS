import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'checking'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // If registration is still open (no users yet), show the first-admin form.
  useEffect(() => {
    api
      .register('', '', '')
      .then(() => setMode('register'))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 422) setMode('register');
        else setMode('login');
      });
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') await register(email, password, name || undefined);
      else await login(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card auth-card">
        <div className="brand" style={{ padding: 0, marginBottom: 16 }}>
          <span className="brand-mark">F</span>
          <span style={{ fontWeight: 600 }}>FerroCMS</span>
        </div>
        <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>
          {mode === 'register' ? 'Create your admin account' : 'Sign in'}
        </h1>
        <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
          {mode === 'register'
            ? 'This is the first account, so it will be the site administrator.'
            : 'Welcome back.'}
        </p>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <div className="error-text">{error}</div>}
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={busy || mode === 'checking'}
            type="submit"
          >
            {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
