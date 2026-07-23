import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  discordChannel,
  notify,
  notifyAll,
  notificationChannelsFromConfig,
  slackChannel,
} from './notifications.js';

describe('slackChannel / discordChannel', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('POSTs a Slack-shaped payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await slackChannel('https://hooks.slack.test/abc').send('hello');

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://hooks.slack.test/abc');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'hello' });
  });

  it('POSTs a Discord-shaped payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await discordChannel('https://discord.test/abc').send('hello');

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init.body as string)).toEqual({ content: 'hello' });
  });

  it('swallows delivery failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    await expect(slackChannel('https://hooks.slack.test/abc').send('hi')).resolves.toBeUndefined();
  });
});

describe('notificationChannelsFromConfig', () => {
  it('builds no channels when nothing is configured', () => {
    expect(notificationChannelsFromConfig({})).toHaveLength(0);
  });

  it('builds one channel per configured webhook', () => {
    const channels = notificationChannelsFromConfig({
      slackWebhookUrl: 'https://hooks.slack.test/x',
      discordWebhookUrl: 'https://discord.test/y',
    });
    expect(channels).toHaveLength(2);
  });
});

describe('notify', () => {
  it('sends to every channel', async () => {
    const a = { send: vi.fn().mockResolvedValue(undefined) };
    const b = { send: vi.fn().mockResolvedValue(undefined) };
    await notify([a, b], 'hi');
    expect(a.send).toHaveBeenCalledWith('hi');
    expect(b.send).toHaveBeenCalledWith('hi');
  });
});

describe('notifyAll', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('no-ops when nothing is configured', async () => {
    const email = { send: vi.fn() };
    await notifyAll({}, email, 'subject', 'message');
    expect(email.send).not.toHaveBeenCalled();
  });

  it('sends chat notifications when webhooks are configured', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const email = { send: vi.fn() };

    await notifyAll({ slackWebhookUrl: 'https://hooks.slack.test/x' }, email, 'subject', 'message');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('emails when notifyEmailTo is set', async () => {
    const email = { send: vi.fn().mockResolvedValue(undefined) };
    await notifyAll({ notifyEmailTo: 'admin@example.com' }, email, 'subject', 'message');
    expect(email.send).toHaveBeenCalledWith({
      to: 'admin@example.com',
      subject: 'subject',
      body: 'message',
    });
  });
});
