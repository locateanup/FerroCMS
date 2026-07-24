import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isRtlLocale } from '@ferrocms/core';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useCollection } from '../lib/collections.js';
import { FieldInput } from '../components/FieldInput.js';
import { RevisionHistory } from '../components/RevisionHistory.js';
import type { EntryStatus, Field, ReviewStatus } from '../lib/types.js';

/** Whether a localized field has any content for a given locale. */
function hasTranslation(data: Record<string, unknown>, field: Field, locale: string): boolean {
  const value = (data[field.name] as Record<string, unknown> | undefined)?.[locale];
  if (value === undefined || value === null || value === '') return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** 'complete' | 'partial' | 'empty' translation status for one locale. */
function translationStatus(
  data: Record<string, unknown>,
  localizedFields: Field[],
  locale: string,
): 'complete' | 'partial' | 'empty' {
  if (localizedFields.length === 0) return 'complete';
  const done = localizedFields.filter((f) => hasTranslation(data, f, locale)).length;
  if (done === 0) return 'empty';
  return done === localizedFields.length ? 'complete' : 'partial';
}

/** ISO string -> the local-time value a `datetime-local` input expects. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EntryEditorPage() {
  const { slug, id } = useParams<{ slug: string; id?: string }>();
  const collection = useCollection(slug);
  const navigate = useNavigate();
  const { user } = useAuth();
  const canReview = user?.role === 'admin' || user?.role === 'editor';

  const isNew = !id || id === 'new';
  const [data, setData] = useState<Record<string, unknown>>({});
  const [status, setStatus] = useState<EntryStatus>('draft');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(null);
  const [reviewNote, setReviewNote] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  // The datetime-local input's own draft value, kept separate from the saved
  // `scheduledAt` so picking a date doesn't schedule anything until you click.
  const [scheduleInput, setScheduleInput] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<string>('');

  const localizedFields = collection?.fields.filter((f) => f.localized === true) ?? [];

  function copyFromDefaultLocale() {
    const defaultLocale = collection?.defaultLocale;
    if (!defaultLocale || locale === defaultLocale) return;
    setData((prev) => {
      const next = { ...prev };
      for (const field of localizedFields) {
        const record = (prev[field.name] as Record<string, unknown> | undefined) ?? {};
        if (hasTranslation(prev, field, locale)) continue; // don't clobber existing work
        const sourceValue = record[defaultLocale];
        if (sourceValue === undefined) continue;
        next[field.name] = { ...record, [locale]: sourceValue };
      }
      return next;
    });
    setDirty(true);
  }

  useEffect(() => {
    if (!collection || collection.locales.length === 0 || locale) return;
    setLocale(collection.defaultLocale ?? collection.locales[0]!);
  }, [collection, locale]);

  useEffect(() => {
    if (isNew || !slug || !id) return;
    setLoading(true);
    api
      .getEntry(slug, id)
      .then((entry) => {
        setData(entry.data);
        setStatus(entry.status);
        setScheduledAt(entry.scheduledAt);
        setReviewStatus(entry.reviewStatus);
        setReviewNote(entry.reviewNote);
        if (entry.scheduledAt) setScheduleInput(toLocalInputValue(entry.scheduledAt));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load.'))
      .finally(() => setLoading(false));
  }, [slug, id, isNew]);

  if (!slug) return null;

  function setField(name: string, value: unknown) {
    setData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  }

  async function save(nextStatus: EntryStatus, nextScheduledAt?: string | null) {
    setSaving(true);
    setError(null);
    try {
      if (isNew) {
        const created = await api.createEntry(slug!, data, nextStatus, nextScheduledAt);
        navigate(`/collections/${slug}/${created.id}`, { replace: true });
      } else {
        await api.updateEntry(slug!, id!, data, nextStatus, nextScheduledAt);
        setStatus(nextStatus);
        setScheduledAt(nextScheduledAt ?? null);
      }
      setDirty(false);
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        const details = err.details as { path: string; message: string }[];
        setError(details.map((d) => `${d.path}: ${d.message}`).join(', '));
      } else {
        setError(err instanceof ApiError ? err.message : 'Failed to save.');
      }
    } finally {
      setSaving(false);
    }
  }

  function schedule() {
    if (!scheduleInput) return;
    save('scheduled', new Date(scheduleInput).toISOString());
  }

  async function submitForReview() {
    if (isNew || !id) return;
    setReviewBusy(true);
    setError(null);
    try {
      const entry = await api.submitForReview(slug!, id);
      setReviewStatus(entry.reviewStatus);
      setReviewNote(entry.reviewNote);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to submit for review.');
    } finally {
      setReviewBusy(false);
    }
  }

  async function decideReview(approved: boolean) {
    if (isNew || !id) return;
    setReviewBusy(true);
    setError(null);
    try {
      const entry = await api.reviewEntry(slug!, id, approved, approved ? undefined : rejectNote);
      setReviewStatus(entry.reviewStatus);
      setReviewNote(entry.reviewNote);
      setStatus(entry.status);
      setRejectNote('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to record the review decision.');
    } finally {
      setReviewBusy(false);
    }
  }

  async function remove() {
    if (isNew || !confirm('Delete this entry? This cannot be undone.')) return;
    await api.deleteEntry(slug!, id!);
    navigate(`/collections/${slug}`);
  }

  async function clone() {
    if (isNew) return;
    const cloned = await api.cloneEntry(slug!, id!);
    navigate(`/collections/${slug}/${cloned.id}`);
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-header">
        <h1>
          {isNew ? 'New' : 'Edit'} {collection?.labels.singular ?? slug}
        </h1>
        <div className="spacer" />
        {!isNew && (
          <button className="btn" onClick={clone}>
            Clone
          </button>
        )}
        {!isNew && (
          <button className="btn btn-danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>

      {collection && collection.locales.length > 0 && (
        <div className="row" style={{ gap: 6, marginBottom: 14, alignItems: 'center' }}>
          <span className="muted" style={{ fontSize: 12, marginRight: 4 }}>
            Language:
          </span>
          {collection.locales.map((l) => {
            const tStatus = translationStatus(data, localizedFields, l);
            return (
              <button
                key={l}
                type="button"
                className="btn"
                style={
                  l === locale
                    ? {
                        padding: '4px 12px',
                        fontSize: 12,
                        background: 'var(--text-primary)',
                        color: 'var(--surface-2)',
                      }
                    : { padding: '4px 12px', fontSize: 12 }
                }
                onClick={() => setLocale(l)}
                title={`Translation: ${tStatus}`}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    marginRight: 6,
                    background:
                      tStatus === 'complete' ? '#22c55e' : tStatus === 'partial' ? '#eab308' : '#94a3b8',
                  }}
                />
                {l.toUpperCase()}
                {isRtlLocale(l) && (
                  <span className="muted" style={{ marginLeft: 4, fontSize: 10 }}>
                    RTL
                  </span>
                )}
              </button>
            );
          })}
          {collection.defaultLocale && locale !== collection.defaultLocale && (
            <button
              type="button"
              className="btn"
              style={{ padding: '4px 12px', fontSize: 12 }}
              onClick={copyFromDefaultLocale}
              title={`Fill empty fields from ${collection.defaultLocale.toUpperCase()}`}
            >
              Copy from {collection.defaultLocale.toUpperCase()}
            </button>
          )}
        </div>
      )}

      <div className="editor-layout">
        <div className="card" dir={isRtlLocale(locale) ? 'rtl' : 'ltr'}>
          {collection ? (
            collection.fields.map((field, i) => {
              const group = field.admin?.group;
              const prevGroup = i > 0 ? collection.fields[i - 1]?.admin?.group : undefined;
              const showHeader = group && group !== prevGroup;
              const isLocalized = field.localized === true && collection.locales.length > 0;
              const fieldValue = isLocalized
                ? (data[field.name] as Record<string, unknown> | undefined)?.[locale]
                : data[field.name];
              const handleChange = (v: unknown) => {
                if (isLocalized) {
                  setData((prev) => ({
                    ...prev,
                    [field.name]: {
                      ...(prev[field.name] as Record<string, unknown> | undefined),
                      [locale]: v,
                    },
                  }));
                  setDirty(true);
                } else {
                  setField(field.name, v);
                }
              };
              return (
                <div key={field.name}>
                  {showHeader && (
                    <div
                      style={{
                        margin: '8px 0 12px',
                        paddingTop: 16,
                        borderTop: '1px solid var(--border)',
                        fontSize: 12,
                        fontWeight: 600,
                        color: 'var(--text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      {group}
                    </div>
                  )}
                  <FieldInput field={field} value={fieldValue} onChange={handleChange} formData={data} />
                </div>
              );
            })
          ) : (
            <p className="muted">Unknown collection.</p>
          )}
          {error && <div className="error-text">{error}</div>}
        </div>

        <aside className="card" style={{ alignSelf: 'start' }}>
          <label>Status</label>
          <div style={{ marginBottom: 12 }}>
            <span className={`badge badge-${status}`}>{status}</span>
            {status === 'scheduled' && scheduledAt && (
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                for {new Date(scheduledAt).toLocaleString()}
              </span>
            )}
            {dirty && (
              <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>
                unsaved
              </span>
            )}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            disabled={saving}
            onClick={() => save('published')}
          >
            {saving ? 'Saving…' : 'Publish'}
          </button>
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
            disabled={saving}
            onClick={() => save('draft')}
          >
            Save draft
          </button>

          <label htmlFor="schedule-at">Schedule for later</label>
          <input
            id="schedule-at"
            type="datetime-local"
            value={scheduleInput}
            onChange={(e) => setScheduleInput(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <button
            className="btn"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={saving || !scheduleInput}
            onClick={schedule}
          >
            Schedule
          </button>

          {!isNew && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
              <label>Editorial review</label>
              {reviewStatus && (
                <div style={{ marginBottom: 8 }}>
                  <span
                    className={`badge ${
                      reviewStatus === 'approved'
                        ? 'badge-published'
                        : reviewStatus === 'rejected'
                          ? 'badge-archived'
                          : 'badge-draft'
                    }`}
                  >
                    {reviewStatus}
                  </span>
                  {reviewNote && (
                    <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                      &quot;{reviewNote}&quot;
                    </div>
                  )}
                </div>
              )}

              {reviewStatus === 'pending' && canReview ? (
                <>
                  <textarea
                    placeholder="Note for the author (only sent if you reject)"
                    rows={2}
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    style={{ marginBottom: 8 }}
                  />
                  <div className="row" style={{ gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      disabled={reviewBusy}
                      onClick={() => decideReview(true)}
                    >
                      Approve &amp; publish
                    </button>
                    <button className="btn btn-danger" disabled={reviewBusy} onClick={() => decideReview(false)}>
                      Reject
                    </button>
                  </div>
                </>
              ) : (
                status !== 'published' && (
                  <button
                    className="btn"
                    style={{ width: '100%', justifyContent: 'center' }}
                    disabled={reviewBusy || reviewStatus === 'pending'}
                    onClick={submitForReview}
                  >
                    {reviewStatus === 'pending' ? 'Awaiting review…' : 'Submit for review'}
                  </button>
                )
              )}
            </div>
          )}

          {!isNew && id && (
            <RevisionHistory
              slug={slug}
              id={id}
              onRestored={(entry) => {
                setData(entry.data);
                setStatus(entry.status);
                setDirty(false);
              }}
            />
          )}
        </aside>
      </div>
    </>
  );
}
