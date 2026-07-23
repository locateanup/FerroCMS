import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CollectionListPage } from './pages/CollectionListPage.js';
import { EntryEditorPage } from './pages/EntryEditorPage.js';
import { MediaPage } from './pages/MediaPage.js';
import { SecurityPage } from './pages/SecurityPage.js';
import { UsersPage } from './pages/UsersPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { GlobalEditorPage } from './pages/GlobalEditorPage.js';
import { RedirectsPage } from './pages/RedirectsPage.js';

export function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="center-screen muted">Loading…</div>;
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/collections/:slug" element={<CollectionListPage />} />
        <Route path="/collections/:slug/new" element={<EntryEditorPage />} />
        <Route path="/collections/:slug/:id" element={<EntryEditorPage />} />
        <Route path="/media" element={<MediaPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/globals/:slug" element={<GlobalEditorPage />} />
        {(user.role === 'admin' || user.role === 'editor') && (
          <Route path="/redirects" element={<RedirectsPage />} />
        )}
        <Route path="/security" element={<SecurityPage />} />
        {user.role === 'admin' && <Route path="/users" element={<UsersPage />} />}
        {user.role === 'admin' && <Route path="/audit-log" element={<AuditLogPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
