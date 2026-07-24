import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useCollections } from '../lib/collections.js';
import type { AuditLogEntry } from '../lib/types.js';

function StatTile({ label, value, to }: { label: string; value: number | string; to?: string }) {
  const inner = (
    <>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        {label}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="card">
      {inner}
    </Link>
  ) : (
    <div className="card">{inner}</div>
  );
}

export function DashboardPage() {
  const { collections, loading } = useCollections();
  const { user } = useAuth();
  const canModerate = user?.role === 'admin' || user?.role === 'editor';

  const [stats, setStats] = useState<{
    perCollection: Record<string, Record<string, number>>;
    pendingComments: number;
    pendingReviews: number;
  } | null>(null);
  const [activity, setActivity] = useState<AuditLogEntry[]>([]);

  useEffect(() => {
    api.dashboard().then(setStats).catch(() => {});
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api
      .listAuditLog({ limit: 8 })
      .then((r) => setActivity(r.items))
      .catch(() => {});
  }, [user]);

  const totalEntries = stats
    ? Object.values(stats.perCollection).reduce(
        (sum, byStatus) => sum + Object.values(byStatus).reduce((a, b) => a + b, 0),
        0,
      )
    : 0;
  const totalPublished = stats
    ? Object.values(stats.perCollection).reduce((sum, byStatus) => sum + (byStatus.published ?? 0), 0)
    : 0;

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      <div className="grid-cards" style={{ marginBottom: 20 }}>
        <StatTile label="Total entries" value={totalEntries} />
        <StatTile label="Published" value={totalPublished} />
        {canModerate && (
          <StatTile label="Pending comments" value={stats?.pendingComments ?? 0} to="/comments" />
        )}
        {canModerate && (
          <StatTile label="Awaiting review" value={stats?.pendingReviews ?? 0} to="/review" />
        )}
      </div>

      {loading ? (
        <p className="muted">Loading collections…</p>
      ) : (
        <div className="grid-cards">
          {collections.map((c) => {
            const byStatus = stats?.perCollection[c.slug] ?? {};
            const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
            return (
              <Link key={c.slug} to={`/collections/${c.slug}`} className="card">
                <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.labels.plural}</div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {total} {total === 1 ? 'entry' : 'entries'}
                  {byStatus.draft ? ` · ${byStatus.draft} draft` : ''}
                </div>
              </Link>
            );
          })}
          <Link to="/media" className="card">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Media</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Files on R2
            </div>
          </Link>
        </div>
      )}

      {user?.role === 'admin' && activity.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 14, marginBottom: 8 }}>Recent activity</h2>
          <div className="table">
            {activity.map((entry) => (
              <div key={entry.id} className="table-row" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <span className="muted" style={{ fontSize: 12 }}>
                  {new Date(entry.createdAt).toLocaleString()}
                </span>
                <span style={{ fontSize: 13 }}>
                  {entry.action}
                  {entry.collection ? ` — ${entry.collection}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
