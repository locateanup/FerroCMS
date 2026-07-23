import { useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';

export function SecurityPage() {
  const { user, refresh } = useAuth();
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setError(null);
    setBusy(true);
    try {
      setSetup(await api.setup2fa());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to start setup.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmSetup() {
    setError(null);
    setBusy(true);
    try {
      await api.verify2fa(code);
      setSetup(null);
      setCode('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setError(null);
    setBusy(true);
    try {
      await api.disable2fa(code);
      setCode('');
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid code.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Security</h1>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div style={{ fontWeight: 500, marginBottom: 4 }}>Two-factor authentication</div>
        <p className="muted" style={{ fontSize: 13, marginTop: 0 }}>
          Require a code from an authenticator app (Google Authenticator, Authy, 1Password, ...) in
          addition to your password when signing in.
        </p>

        {user?.totpEnabled ? (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-published">Enabled</span>
            </div>
            <label htmlFor="disable-code">Enter a current code to disable</label>
            <input
              id="disable-code"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            {error && <div className="error-text">{error}</div>}
            <button className="btn btn-danger" disabled={busy || !code} onClick={disable}>
              {busy ? 'Please wait…' : 'Disable 2FA'}
            </button>
          </>
        ) : setup ? (
          <>
            <p style={{ fontSize: 13 }}>
              Scan this into your authenticator app, or enter it manually:
            </p>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: 13,
                background: 'var(--surface-1)',
                padding: '8px 10px',
                borderRadius: 'var(--radius)',
                wordBreak: 'break-all',
                marginBottom: 10,
              }}
            >
              {setup.secret}
            </div>
            <p className="muted" style={{ fontSize: 12 }}>
              Provisioning URI: <span style={{ wordBreak: 'break-all' }}>{setup.otpauthUrl}</span>
            </p>
            <label htmlFor="verify-code">Enter the 6-digit code to confirm</label>
            <input
              id="verify-code"
              inputMode="numeric"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            {error && <div className="error-text">{error}</div>}
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-primary" disabled={busy || !code} onClick={confirmSetup}>
                {busy ? 'Verifying…' : 'Verify & enable'}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSetup(null);
                  setCode('');
                  setError(null);
                }}
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <span className="badge badge-archived">Disabled</span>
            </div>
            <button className="btn btn-primary" disabled={busy} onClick={startSetup}>
              {busy ? 'Please wait…' : 'Enable 2FA'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
