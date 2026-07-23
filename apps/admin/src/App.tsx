import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth.js';
import { Layout } from './components/Layout.js';
import { LoginPage } from './pages/LoginPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { CollectionListPage } from './pages/CollectionListPage.js';
import { EntryEditorPage } from './pages/EntryEditorPage.js';
import { MediaPage } from './pages/MediaPage.js';
import { SecurityPage } from './pages/SecurityPage.js';

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
        <Route path="/security" element={<SecurityPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
