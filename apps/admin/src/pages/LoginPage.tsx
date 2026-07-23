import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

export function LoginPage() {
  const { login, register, completeTotpLogin } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'checking'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Set once the password step succeeds on a 2FA-enabled account.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

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
      if (mode === 'register') {
        await register(email, password, name || undefined);
      } else {
        const result = await login(email, password);
        if ('requiresTotp' in result) setChallengeToken(result.challengeToken);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function submitTotp(e: FormEvent) {
    e.preventDefault();
    if (!challengeToken) return;
    setError(null);
    setBusy(true);
    try {
      await completeTotpLogin(challengeToken, totpCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  if (challengeToken) {
    return (
      <div className="center-screen">
        <div className="card auth-card">
          <div className="brand" style={{ padding: 0, marginBottom: 16 }}>
            <span className="brand-mark">F</span>
            <span style={{ fontWeight: 600 }}>FerroCMS</span>
          </div>
          <h1 style={{ fontSize: 18, margin: '0 0 4px' }}>Two-factor code</h1>
          <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
            Enter the 6-digit code from your authenticator app.
          </p>
          <form onSubmit={submitTotp}>
            <div className="field">
              <label htmlFor="totp">Code</label>
              <input
                id="totp"
                inputMode="numeric"
                autoFocus
                required
                minLength={6}
                maxLength={8}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value)}
              />
            </div>
            {error && <div className="error-text">{error}</div>}
            <button
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              disabled={busy}
              type="submit"
            >
              {busy ? 'Verifying…' : 'Verify'}
            </button>
            <button
              type="button"
              className="btn"
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
              onClick={() => {
                setChallengeToken(null);
                setTotpCode('');
                setError(null);
              }}
            >
              Back to sign in
            </button>
          </form>
        </div>
      </div>
    );
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
