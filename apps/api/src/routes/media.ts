import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { media } from '@ferrocms/db';
import { atLeast, authenticated } from '@ferrocms/core';
import type { AppBindings } from '../env.js';
import { enforce } from '../auth/middleware.js';
import { errors } from '../lib/errors.js';
import { randomToken } from '../lib/crypto.js';
import { detectImageDimensions } from '../lib/imageMeta.js';
import { logAudit } from '../services/audit.js';

const router = new Hono<AppBindings>();

/** Structural type for an uploaded multipart file (avoids DOM/File global quirks). */
interface UploadedFile {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
const ALLOWED_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

/** Sanitize a user-supplied folder path: lowercase segments, safe chars only. */
export function sanitizeFolder(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-z0-9-_]/g, ''))
    .filter(Boolean)
    .slice(0, 4) // cap nesting depth
    .join('/');
  return cleaned.length > 0 ? cleaned.slice(0, 200) : null;
}

// Upload a file to R2 and record it in the media library.
router.post('/', async (c) => {
  const user = enforce(c, atLeast('author'));
  const form = await c.req.formData().catch(() => {
    throw errors.badRequest('Expected multipart/form-data.');
  });
  const raw = form.get('file');
  if (!raw || typeof raw === 'string') {
    throw errors.badRequest('Expected a file in the "file" field.');
  }
  const file = raw as unknown as UploadedFile;

  const isVideo = VIDEO_TYPES.has(file.type);
  if (file.size > (isVideo ? MAX_VIDEO_SIZE : MAX_SIZE)) {
    throw errors.badRequest(
      `File is too large (max ${isVideo ? '200 MB' : '25 MB'} for this type).`,
    );
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    throw errors.badRequest(`Unsupported file type "${file.type}".`);
  }

  const folderValue = form.get('folder');
  const folder = sanitizeFolder(typeof folderValue === 'string' ? folderValue : undefined);

  const dot = file.name.lastIndexOf('.');
  const ext = dot > -1 ? file.name.slice(dot + 1).toLowerCase() : '';
  const key = `${folder ? `${folder}/` : ''}${new Date().getUTCFullYear()}/${randomToken(8)}${ext ? `.${ext}` : ''}`;

  const bytes = await file.arrayBuffer();
  await c.get('storage').put(key, bytes, { contentType: file.type });

  const dimensions = detectImageDimensions(bytes, file.type);

  const altValue = form.get('alt');
  const [row] = await c
    .get('db')
    .insert(media)
    .values({
      key,
      filename: file.name,
      mimeType: file.type,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      size: file.size,
      alt: typeof altValue === 'string' ? altValue : null,
      folder,
      uploadedById: user?.id ?? null,
    })
    .returning();
  await logAudit(c.get('db'), {
    userId: user?.id ?? null,
    action: 'media.upload',
    collection: 'media',
    entryId: row!.id,
    details: { filename: row!.filename, mimeType: row!.mimeType },
  });
  return c.json(row, 201);
});

// List media (authenticated users only), optionally filtered by folder.
router.get('/', async (c) => {
  enforce(c, authenticated);
  const limit = Math.min(Math.max(Number(c.req.query('limit') ?? 50) || 50, 1), 100);
  const folderParam = c.req.query('folder');

  const db = c.get('db');
  const rows = await (folderParam
    ? db
        .select()
        .from(media)
        .where(eq(media.folder, sanitizeFolder(folderParam) ?? folderParam))
        .orderBy(desc(media.createdAt))
        .limit(limit)
    : db.select().from(media).orderBy(desc(media.createdAt)).limit(limit));
  return c.json({ items: rows });
});

// Serve a media object publicly from storage (R2 or filesystem).
router.get('/file/:key{.+}', async (c) => {
  const key = c.req.param('key');
  const object = await c.get('storage').get(key);
  if (!object) throw errors.notFound('File');

  const headers = new Headers();
  if (object.contentType) headers.set('content-type', object.contentType);
  if (object.etag) headers.set('etag', object.etag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  return new Response(object.body as BodyInit, { headers });
});

// Delete a media item from R2 and the database.
router.delete('/:id', async (c) => {
  const user = enforce(c, atLeast('editor'));
  const id = c.req.param('id');
  const db = c.get('db');
  const [row] = await db.select().from(media).where(eq(media.id, id)).limit(1);
  if (!row) throw errors.notFound('File');

  await c.get('storage').delete(row.key);
  await db.delete(media).where(eq(media.id, id));
  await logAudit(db, {
    userId: user?.id ?? null,
    action: 'media.delete',
    collection: 'media',
    entryId: row.id,
    details: { filename: row.filename },
  });
  return c.body(null, 204);
});

export { router as mediaRouter };
