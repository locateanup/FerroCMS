import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api.js';
import type { CalendarItem } from '../lib/types.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Every day cell for a 6-week grid covering the month, starting on a Sunday. */
function buildGrid(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const grid = useMemo(() => buildGrid(cursor), [cursor]);

  useEffect(() => {
    const from = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);
    setLoading(true);
    api
      .calendar(from, to)
      .then((r) => setItems(r.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load the calendar.'))
      .finally(() => setLoading(false));
  }, [cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of items) {
      const key = dayKey(new Date(item.date));
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return map;
  }, [items]);

  const today = new Date();

  return (
    <>
      <div className="page-header">
        <h1>Content calendar</h1>
        <div className="spacer" />
        <button
          className="btn"
          onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
        >
          ← Prev
        </button>
        <span style={{ minWidth: 140, textAlign: 'center', fontWeight: 500 }}>{monthLabel}</span>
        <button
          className="btn"
          onClick={() => setCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
        >
          Next →
        </button>
        <button className="btn" onClick={() => setCursor(new Date())}>
          Today
        </button>
      </div>

      {error && (
        <div className="error-text" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 1,
            background: 'var(--border)',
            border: '1px solid var(--border)',
          }}
        >
          {WEEKDAYS.map((w) => (
            <div
              key={w}
              className="muted"
              style={{ background: 'var(--surface-1)', padding: '6px 8px', fontSize: 11, textAlign: 'center' }}
            >
              {w}
            </div>
          ))}
          {grid.map((day) => {
            const inMonth = day.getMonth() === cursor.getMonth();
            const isToday = dayKey(day) === dayKey(today);
            const dayItems = byDay.get(dayKey(day)) ?? [];
            return (
              <div
                key={day.toISOString()}
                style={{
                  background: 'var(--surface-2)',
                  minHeight: 90,
                  padding: 6,
                  opacity: inMonth ? 1 : 0.4,
                }}
              >
                <div
                  className="muted"
                  style={{
                    fontSize: 11,
                    fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--text-primary)' : undefined,
                  }}
                >
                  {day.getDate()}
                </div>
                {dayItems.map((item) => (
                  <Link
                    key={item.id}
                    to={`/collections/${item.collection}/${item.id}`}
                    style={{
                      display: 'block',
                      fontSize: 11,
                      padding: '2px 4px',
                      marginTop: 2,
                      borderRadius: 3,
                      background: item.status === 'published' ? 'var(--surface-1)' : 'transparent',
                      border: '1px solid var(--border)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={item.title}
                  >
                    <span className={`badge badge-${item.status}`} style={{ marginRight: 4 }}>
                      {item.status === 'scheduled' ? 'sched' : 'pub'}
                    </span>
                    {item.title}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
