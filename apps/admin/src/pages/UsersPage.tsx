import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import type { AdminUser, Role } from '../lib/types.js';

const ROLES: Role[] = ['admin', 'editor', 'author', 'viewer'];

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('author');
  const [busy, setBusy] = useState(false);

  function refresh() {
    setLoading(true);
    api
      .listUsers()
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load users.'))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function invite() {
    setError(null);
    setBusy(true);
    try {
      await api.createUser(email, password, role);
      setEmail('');
      setPassword('');
      setRole('author');
      setShowInvite(false);
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create user.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(u: AdminUser, next: Role) {
    setError(null);
    try {
      await api.updateUser(u.id, { role: next });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update role.');
    }
  }

  async function toggleActive(u: AdminUser) {
    setError(null);
    try {
      await api.updateUser(u.id, { active: !u.active });
      refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update user.');
    }
  }

  return (
    <>
      <div className="page-header">
        <h1>Users</h1>
        <span className="muted">{items.length} users</span>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setShowInvite((v) => !v)}>
          {showInvite ? 'Cancel' : '+ Invite user'}
        </button>
      </div>

      {showInvite && (
        <div className="card" style={{ maxWidth: 480, marginBottom: 16 }}>
          <label htmlFor="invite-email">Email</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <label htmlFor="invite-password">Temporary password</label>
          <input
            id="invite-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
            Share this password with them directly — there's no email delivery yet.
          </p>
          <label htmlFor="invite-role">Role</label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            style={{ marginBottom: 8 }}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {error && <div className="error-text">{error}</div>}
          <button
            className="btn btn-primary"
            disabled={busy || !email || !password}
            onClick={invite}
          >
            {busy ? 'Creating…' : 'Create user'}
          </button>
        </div>
      )}

      {!showInvite && error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div className="table">
          <div className="table-row table-head">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>2FA</span>
            <span>Status</span>
            <span></span>
          </div>
          {items.map((u) => (
            <div key={u.id} className="table-row">
              <span style={{ fontWeight: 500 }}>{u.name ?? '—'}</span>
              <span className="muted">{u.email}</span>
              <span>
                <select
                  value={u.role}
                  disabled={u.id === currentUser?.id}
                  onChange={(e) => changeRole(u, e.target.value as Role)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </span>
              <span className="muted">{u.totpEnabled ? 'Enabled' : '—'}</span>
              <span>
                <span className={`badge ${u.active ? 'badge-published' : 'badge-archived'}`}>
                  {u.active ? 'Active' : 'Deactivated'}
                </span>
              </span>
              <span>
                <button
                  className={`btn ${u.active ? 'btn-danger' : ''}`}
                  style={{ padding: '4px 8px', fontSize: 12 }}
                  disabled={u.id === currentUser?.id}
                  onClick={() => toggleActive(u)}
                >
                  {u.active ? 'Deactivate' : 'Reactivate'}
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
