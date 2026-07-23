/**
 * Pluggable email — same "provider interface + safe default" pattern as the
 * storage/cache/KV adapters. No live email API key is available in this
 * environment to verify a real provider against, so the shipped default just
 * logs; swap in a real EmailProvider (Resend, Postmark, SES, ...) by
 * implementing this interface and passing it into createApp's context.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export function consoleEmailProvider(): EmailProvider {
  return {
    async send(message) {
      console.log(`[email] to=${message.to} subject="${message.subject}"\n${message.body}`);
    },
  };
}
