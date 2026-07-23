import { describe, expect, it } from 'vitest';
import { createPreviewToken, verifyPreviewToken } from './previewToken.js';

const SECRET = 'test-signing-secret';

describe('preview tokens', () => {
  it('a freshly minted token verifies for its own collection + entry', async () => {
    const { token } = await createPreviewToken(SECRET, 'posts', 'abc123');
    expect(await verifyPreviewToken(SECRET, 'posts', 'abc123', token)).toBe(true);
  });

  it('rejects the token for a different entry id', async () => {
    const { token } = await createPreviewToken(SECRET, 'posts', 'abc123');
    expect(await verifyPreviewToken(SECRET, 'posts', 'other-id', token)).toBe(false);
  });

  it('rejects the token for a different collection', async () => {
    const { token } = await createPreviewToken(SECRET, 'posts', 'abc123');
    expect(await verifyPreviewToken(SECRET, 'pages', 'abc123', token)).toBe(false);
  });

  it('rejects a token signed with a different secret', async () => {
    const { token } = await createPreviewToken(SECRET, 'posts', 'abc123');
    expect(await verifyPreviewToken('wrong-secret', 'posts', 'abc123', token)).toBe(false);
  });

  it('rejects a tampered signature', async () => {
    const { token } = await createPreviewToken(SECRET, 'posts', 'abc123');
    const [exp] = token.split('.');
    const tampered = `${exp}.0000000000000000000000000000000000000000000000000000000000000000`;
    expect(await verifyPreviewToken(SECRET, 'posts', 'abc123', tampered)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const { token, expiresAt } = await createPreviewToken(SECRET, 'posts', 'abc123', 60);
    expect(await verifyPreviewToken(SECRET, 'posts', 'abc123', token, expiresAt + 1)).toBe(false);
  });

  it('accepts a token exactly at its expiry second', async () => {
    const { token, expiresAt } = await createPreviewToken(SECRET, 'posts', 'abc123', 60);
    expect(await verifyPreviewToken(SECRET, 'posts', 'abc123', token, expiresAt)).toBe(true);
  });

  it('rejects malformed tokens', async () => {
    expect(await verifyPreviewToken(SECRET, 'posts', 'abc123', 'not-a-real-token')).toBe(false);
    expect(await verifyPreviewToken(SECRET, 'posts', 'abc123', '')).toBe(false);
  });

  it('respects a custom TTL', async () => {
    const { expiresAt } = await createPreviewToken(SECRET, 'posts', 'abc123', 30);
    const now = Math.floor(Date.now() / 1000);
    expect(expiresAt).toBeGreaterThanOrEqual(now + 29);
    expect(expiresAt).toBeLessThanOrEqual(now + 31);
  });
});
