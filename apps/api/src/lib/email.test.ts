import { describe, expect, it, vi } from 'vitest';
import { consoleEmailProvider } from './email.js';

describe('consoleEmailProvider', () => {
  it('logs instead of sending, and never throws', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const provider = consoleEmailProvider();

    await expect(
      provider.send({ to: 'a@example.com', subject: 'Hi', body: 'Body text' }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('a@example.com'));
    logSpy.mockRestore();
  });
});
