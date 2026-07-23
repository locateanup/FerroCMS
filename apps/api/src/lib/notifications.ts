/**
 * Outgoing chat notifications on key events (publish, comment submitted,
 * review requested). Slack and Discord incoming webhooks are just "POST a
 * JSON payload to a URL" — no API key to register or verify against, unlike
 * a full Slack/Discord app — so both are fully implemented here, not stubbed.
 */

export interface NotificationChannel {
  send(message: string): Promise<void>;
}

function jsonPostChannel(url: string, toPayload: (message: string) => unknown): NotificationChannel {
  return {
    async send(message) {
      await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(toPayload(message)),
      }).catch(() => {
        /* best-effort — a notification failure shouldn't fail the request that triggered it */
      });
    },
  };
}

export function slackChannel(webhookUrl: string): NotificationChannel {
  return jsonPostChannel(webhookUrl, (text) => ({ text }));
}

export function discordChannel(webhookUrl: string): NotificationChannel {
  return jsonPostChannel(webhookUrl, (content) => ({ content }));
}

/** Build every configured channel from AppConfig — none if nothing's configured. */
export function notificationChannelsFromConfig(config: {
  slackWebhookUrl?: string;
  discordWebhookUrl?: string;
}): NotificationChannel[] {
  const channels: NotificationChannel[] = [];
  if (config.slackWebhookUrl) channels.push(slackChannel(config.slackWebhookUrl));
  if (config.discordWebhookUrl) channels.push(discordChannel(config.discordWebhookUrl));
  return channels;
}

/** Fan a message out to every channel. Best-effort — never throws. */
export async function notify(channels: NotificationChannel[], message: string): Promise<void> {
  await Promise.all(channels.map((c) => c.send(message)));
}

export interface EmailSender {
  send(message: { to: string; subject: string; body: string }): Promise<void>;
}

/**
 * The one entry point every trigger (publish, comment submitted, review
 * requested) calls: fans the message out to every configured chat channel
 * and, if `notifyEmailTo` is set, emails it too. No-ops entirely if nothing
 * is configured.
 */
export async function notifyAll(
  config: { slackWebhookUrl?: string; discordWebhookUrl?: string; notifyEmailTo?: string },
  email: EmailSender,
  subject: string,
  message: string,
): Promise<void> {
  const channels = notificationChannelsFromConfig(config);
  const tasks: Promise<unknown>[] = [notify(channels, message)];
  if (config.notifyEmailTo) {
    tasks.push(email.send({ to: config.notifyEmailTo, subject, body: message }));
  }
  await Promise.all(tasks);
}
