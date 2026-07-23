import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  generateTotp,
  generateTotpSecret,
  totpProvisioningUri,
  verifyTotp,
} from './totp.js';

describe('base32 (RFC 4648 test vectors)', () => {
  it('encodes without padding, matching the RFC vectors up to the pad chars', () => {
    const enc = new TextEncoder();
    expect(base32Encode(enc.encode('f'))).toBe('MY');
    expect(base32Encode(enc.encode('fo'))).toBe('MZXQ');
    expect(base32Encode(enc.encode('foo'))).toBe('MZXW6');
    expect(base32Encode(enc.encode('foob'))).toBe('MZXW6YQ');
    expect(base32Encode(enc.encode('fooba'))).toBe('MZXW6YTB');
    expect(base32Encode(enc.encode('foobar'))).toBe('MZXW6YTBOI');
  });

  it('decodes the padded RFC vectors back to the original bytes', () => {
    const dec = new TextDecoder();
    expect(dec.decode(base32Decode('MY======'))).toBe('f');
    expect(dec.decode(base32Decode('MZXQ===='))).toBe('fo');
    expect(dec.decode(base32Decode('MZXW6YTBOI======'))).toBe('foobar');
  });

  it('round-trips arbitrary byte sequences', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(20));
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });
});

describe('TOTP (RFC 6238 Appendix B test vectors, SHA1, 30s step)', () => {
  // The RFC's ASCII secret "12345678901234567890" (20 bytes), carried as base32
  // the way a real secret is shared/stored — this exercises the same
  // base32Decode path a stored user secret would go through.
  const secret = base32Encode(new TextEncoder().encode('12345678901234567890'));

  const vectors: [seconds: number, code8: string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
  ];

  it.each(vectors)('matches the published 8-digit code at T=%i', async (seconds, code8) => {
    const code = await generateTotp(secret, seconds * 1000, { digits: 8 });
    expect(code).toBe(code8);
  });

  it.each(vectors)(
    'the 6-digit code is the last 6 digits of the 8-digit code at T=%i',
    async (seconds, code8) => {
      const code = await generateTotp(secret, seconds * 1000, { digits: 6 });
      expect(code).toBe(code8.slice(-6));
    },
  );
});

describe('verifyTotp', () => {
  const secret = generateTotpSecret();
  const T0 = 1_700_000_000_000; // arbitrary fixed instant, ms

  it('accepts the correct current code', async () => {
    const code = await generateTotp(secret, T0);
    expect(await verifyTotp(secret, code, T0)).toBe(true);
  });

  it('rejects an incorrect code', async () => {
    expect(await verifyTotp(secret, '000000', T0)).toBe(false);
  });

  it('tolerates one step of clock drift in either direction', async () => {
    const prevStepCode = await generateTotp(secret, T0 - 30_000);
    const nextStepCode = await generateTotp(secret, T0 + 30_000);
    expect(await verifyTotp(secret, prevStepCode, T0)).toBe(true);
    expect(await verifyTotp(secret, nextStepCode, T0)).toBe(true);
  });

  it('rejects a code two steps away', async () => {
    const farCode = await generateTotp(secret, T0 - 60_000);
    expect(await verifyTotp(secret, farCode, T0)).toBe(false);
  });
});

describe('generateTotpSecret', () => {
  it('returns a base32 string with no padding characters', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]+$/);
  });

  it('produces different secrets on each call', () => {
    expect(generateTotpSecret()).not.toBe(generateTotpSecret());
  });
});

describe('totpProvisioningUri', () => {
  it('builds a well-formed otpauth:// URI', () => {
    const uri = totpProvisioningUri({
      secret: 'JBSWY3DPEHPK3PXP',
      accountName: 'me@example.com',
      issuer: 'FerroCMS',
    });
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('secret=JBSWY3DPEHPK3PXP');
    expect(uri).toContain('issuer=FerroCMS');
    expect(uri).toContain('algorithm=SHA1');
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
