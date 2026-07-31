import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.js';
import { useCollections } from '../lib/collections.js';
import { useGlobals } from '../lib/globals.js';
import { canAccessPage, getAdminPages } from '../lib/pageRegistry.js';
import { ThemeToggle } from './ThemeToggle.js';

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
  // Off-canvas sidebar below the ~880px breakpoint (see styles.css) — a
  // fixed 220px column left no usable width for content on a narrow window.
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const content = collections.filter((c) => !c.taxonomyConfig.enabled);
  const taxonomies = collections.filter((c) => c.taxonomyConfig.enabled);

  return (
    <div className="layout">
      <button
        type="button"
        className="sidebar-toggle"
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        onClick={() => setSidebarOpen((v) => !v)}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <div className="brand">
            <span className="brand-mark">F</span>
            <span style={{ flex: 1 }}>FerroCMS</span>
            <ThemeToggle />
          </div>
        </div>

        <nav className="sidebar-nav" onClick={() => setSidebarOpen(false)}>
          <input
            type="search"
            placeholder="Search…"
            style={{ margin: '0 0 12px' }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              const q = (e.target as HTMLInputElement).value.trim();
              if (!q) return;
              setSidebarOpen(false);
              navigate(`/search?q=${encodeURIComponent(q)}`);
            }}
          />

          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <span>Dashboard</span>
          </NavLink>

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
          <NavLink
            to="/calendar"
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span>Calendar</span>
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

          {(user?.role === 'admin' || user?.role === 'editor') && (
            <NavLink
              to="/review"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
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
          {(user?.role === 'admin' || user?.role === 'editor') && (
            <NavLink
              to="/forms"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
              <span>Forms</span>
            </NavLink>
          )}
          {user?.role === 'admin' && (
            <NavLink
              to="/users"
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
            >
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
          {getAdminPages()
            .filter((page) => canAccessPage(page, user?.role))
            .map((page) => (
              <NavLink
                key={page.path}
                to={page.path}
                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              >
                <span>{page.label}</span>
              </NavLink>
            ))}
        </nav>

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
