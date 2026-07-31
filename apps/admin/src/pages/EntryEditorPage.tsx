import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { isRtlLocale } from '@ferrocms/core';
import { api, ApiError } from '../lib/api.js';
import { useAuth } from '../lib/auth.js';
import { useCollection } from '../lib/collections.js';
import { FieldInput } from '../components/FieldInput.js';
import { RevisionHistory } from '../components/RevisionHistory.js';
import type { EntryStatus, Field, PresenceEntry, ReviewStatus } from '../lib/types.js';

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
  // Per-field messages keyed by dot-path (e.g. "pillar", "faq.0.question"),
  // parsed from the same validation response `error` summarizes — see
  // save() below. Rendered next to the actual field via FieldInput's
  // `errors` prop, instead of only as one generic string at the bottom.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState<string>('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [otherViewers, setOtherViewers] = useState<PresenceEntry[]>([]);

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

  // Presence: heartbeat while this entry is open so others editing it show up
  // (and we show up for them) — not live collaborative editing, just a "so-
  // and-so is also editing this" warning. Best-effort: a failed heartbeat
  // (e.g. offline for a beat) just means presence goes stale, nothing breaks.
  useEffect(() => {
    if (isNew || !slug || !id) return;
    let cancelled = false;
    function beat() {
      api
        .presenceHeartbeat(slug!, id!)
        .then((res) => {
          if (!cancelled) setOtherViewers(res.items.filter((v) => v.userId !== user?.id));
        })
        .catch(() => {
          /* best-effort */
        });
    }
    beat();
    const interval = setInterval(beat, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
      setOtherViewers([]);
      void api.presenceLeave(slug!, id!).catch(() => {
        /* best-effort */
      });
    };
  }, [slug, id, isNew, user?.id]);

  if (!slug) return null;

  function setField(name: string, value: unknown) {
    setData((prev) => ({ ...prev, [name]: value }));
    setDirty(true);
  }

  async function save(nextStatus: EntryStatus, nextScheduledAt?: string | null) {
    setSaving(true);
    setError(null);
    setFieldErrors({});
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
        setFieldErrors(Object.fromEntries(details.map((d) => [d.path, d.message])));
        setError('Fix the highlighted field(s) below and save again.');
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

  // Renders the *last saved draft*, not unsaved edits — the front-end that
  // owns the preview URL fetches by minted token, over HTTP, same as it
  // would for any other request; there's no live in-browser sync of
  // keystrokes without the front-end opting into a postMessage protocol
  // FerroCMS doesn't define. "Refresh" re-mints a token and reloads.
  async function openPreview() {
    if (isNew || !id || !slug || !collection?.admin.previewUrlPattern) return;
    setPreviewLoading(true);
    setError(null);
    try {
      const { token } = await api.mintPreviewToken(slug, id);
      const url = collection.admin.previewUrlPattern
        .replace(':collection', encodeURIComponent(slug))
        .replace(':id', encodeURIComponent(id))
        .replace(':token', encodeURIComponent(token));
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to open preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-header">
        <h1>
          {isNew ? 'New' : 'Edit'} {collection?.labels.singular ?? slug}
        </h1>
        <div className="spacer" />
        {!isNew && collection?.admin.previewUrlPattern && !previewUrl && (
          <button className="btn" disabled={previewLoading} onClick={openPreview}>
            {previewLoading ? 'Opening…' : 'Preview'}
          </button>
        )}
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

      {error && (
        <div className="error-text" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      {otherViewers.length > 0 && (
        <div
          className="card"
          style={{
            padding: '8px 12px',
            marginBottom: 14,
            background: 'var(--surface-2)',
            fontSize: 13,
          }}
        >
          ⚠ Also editing this right now: {otherViewers.map((v) => v.email).join(', ')} — coordinate
          to avoid overwriting each other's changes.
        </div>
      )}

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
                        background: 'var(--text)',
                        color: 'var(--surface)',
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
                      tStatus === 'complete'
                        ? '#22c55e'
                        : tStatus === 'partial'
                          ? '#eab308'
                          : '#94a3b8',
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

      {previewUrl ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div
            className="row"
            style={{
              padding: 8,
              borderBottom: '1px solid var(--border)',
              gap: 8,
              alignItems: 'center',
            }}
          >
            <button className="btn" onClick={() => setPreviewUrl(null)}>
              ← Back to editor
            </button>
            <button className="btn" disabled={previewLoading} onClick={openPreview}>
              {previewLoading ? 'Refreshing…' : 'Refresh'}
            </button>
            <span
              className="muted"
              style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {previewUrl}
            </span>
          </div>
          <iframe
            key={previewUrl}
            src={previewUrl}
            title="Live preview"
            style={{ width: '100%', height: '75vh', border: 0, display: 'block' }}
          />
        </div>
      ) : (
        <div
          className="editor-layout"
          // Keyed by entry so switching between entries (including new ->
          // the just-created one) forces every field — critically
          // BlockEditor's live Tiptap instance — to fully remount from the
          // freshly loaded data, rather than reconciling one Tiptap
          // document into another. Internal edits within the *same* entry
          // never change this key, so typing never triggers a remount.
          key={isNew ? 'new' : id}
        >
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
                    <FieldInput
                      field={field}
                      value={fieldValue}
                      onChange={handleChange}
                      formData={data}
                      errors={fieldErrors}
                    />
                  </div>
                );
              })
            ) : (
              <p className="muted">Unknown collection.</p>
            )}
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
                      <button
                        className="btn btn-danger"
                        disabled={reviewBusy}
                        onClick={() => decideReview(false)}
                      >
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
      )}
    </>
  );
}
