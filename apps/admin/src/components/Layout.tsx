import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { useCollections } from '../lib/collections.js';
import { useGlobals } from '../lib/globals.js';

function initials(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0]![0]! + (parts[1]?.[0] ?? '')).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { collections } = useCollections();
  const { globals } = useGlobals();
  const navigate = useNavigate();

  const content = collections.filter((c) => !c.taxonomyConfig.enabled);
  const taxonomies = collections.filter((c) => c.taxonomyConfig.enabled);

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">F</span>
          <span>FerroCMS</span>
        </div>

        <input
          type="search"
          placeholder="Search…"
          style={{ margin: '0 0 12px' }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const q = (e.target as HTMLInputElement).value.trim();
            if (q) navigate(`/search?q=${encodeURIComponent(q)}`);
          }}
        />

        <div className="section-label">Content</div>
        {content.map((c) => (
          <NavLink
            key={c.slug}
            to={`/collections/${c.slug}`}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>{c.labels.plural}</span>
          </NavLink>
        ))}
        <NavLink to="/media" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
          <span>Media</span>
        </NavLink>

        {taxonomies.length > 0 && (
          <>
            <div className="section-label">Taxonomies</div>
            {taxonomies.map((c) => (
              <NavLink
                key={c.slug}
                to={`/collections/${c.slug}`}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span>{c.labels.plural}</span>
              </NavLink>
            ))}
          </>
        )}

        {globals.length > 0 && (
          <>
            <div className="section-label">Globals</div>
            {globals.map((g) => (
              <NavLink
                key={g.slug}
                to={`/globals/${g.slug}`}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span>{g.label}</span>
              </NavLink>
            ))}
          </>
        )}

        <div className="spacer" />
        {(user?.role === 'admin' || user?.role === 'editor') && (
          <NavLink to="/review" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>Review queue</span>
          </NavLink>
        )}
        {(user?.role === 'admin' || user?.role === 'editor') && (
          <NavLink
            to="/comments"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>Comments</span>
          </NavLink>
        )}
        {(user?.role === 'admin' || user?.role === 'editor') && (
          <NavLink
            to="/redirects"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>Redirects</span>
          </NavLink>
        )}
        {user?.role === 'admin' && (
          <NavLink to="/users" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>Users</span>
          </NavLink>
        )}
        {user?.role === 'admin' && (
          <NavLink
            to="/audit-log"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>Audit log</span>
          </NavLink>
        )}
        <NavLink
          to="/security"
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <span>Security</span>
        </NavLink>
        <div className="user-chip">
          <div className="avatar">{user ? initials(user.name, user.email) : '?'}</div>
          <div style={{ lineHeight: 1.2, flex: 1 }}>
            <div style={{ fontSize: 13 }}>{user?.name ?? user?.email}</div>
            <div className="muted" style={{ fontSize: 11, textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>
          <button
            className="btn"
            style={{ padding: '4px 8px', fontSize: 12 }}
            onClick={async () => {
              await logout();
              navigate('/');
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}
