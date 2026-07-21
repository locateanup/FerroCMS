import { Link } from 'react-router-dom';
import { useCollections } from '../lib/collections.js';

export function DashboardPage() {
  const { collections, loading } = useCollections();

  return (
    <>
      <div className="page-header">
        <h1>Dashboard</h1>
      </div>

      {loading ? (
        <p className="muted">Loading collections…</p>
      ) : (
        <div className="grid-cards">
          {collections.map((c) => (
            <Link key={c.slug} to={`/collections/${c.slug}`} className="card">
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{c.labels.plural}</div>
              <div className="muted" style={{ fontSize: 13 }}>
                {c.fields.length} fields
              </div>
            </Link>
          ))}
          <Link to="/media" className="card">
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Media</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Files on R2
            </div>
          </Link>
        </div>
      )}
    </>
  );
}
