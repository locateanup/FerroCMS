import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { useCollections } from '../lib/collections.js';

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

        <div className="spacer" />
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
