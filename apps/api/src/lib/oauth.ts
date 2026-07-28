/**
 * SSO/OAuth — the same adapter pattern as StorageAdapter/EmailProvider: a
 * small interface plus concrete implementations, so the rest of the app
 * never depends on a specific provider's API shape.
 *
 * The `*Endpoint`/`*Url` options on each factory are overridable purely for
 * testing (pointing at a local mock OAuth2 server) — production code never
 * sets them, so it always talks to the real Google/GitHub endpoints below.
 */

import type { AppConfig } from '../platform/types.js';

export interface OAuthUserInfo {
  /** The provider's own stable id for this account (Google `sub`, GitHub numeric id) — never the email. */
  providerAccountId: string;
  email: string;
  name?: string;
}

export interface OAuthProvider {
  id: string;
  label: string;
  /** Where to send the browser to start the flow. */
  authorizeUrl(state: string, redirectUri: string): string;
  /** Exchange the callback's `code` for the user's identity. */
  exchangeCode(code: string, redirectUri: string): Promise<OAuthUserInfo>;
}

async function fetchJson<T>(url: string, init: RequestInit, what: string): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    throw new Error(`${what} failed (HTTP ${res.status}): ${await res.text().catch(() => '')}`);
  }
  return res.json() as Promise<T>;
}

export interface GoogleProviderOptions {
  clientId: string;
  clientSecret: string;
  authorizeEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
}

export function googleOAuthProvider(opts: GoogleProviderOptions): OAuthProvider {
  const authorizeEndpoint =
    opts.authorizeEndpoint ?? 'https://accounts.google.com/o/oauth2/v2/auth';
  const tokenEndpoint = opts.tokenEndpoint ?? 'https://oauth2.googleapis.com/token';
  const userinfoEndpoint =
    opts.userinfoEndpoint ?? 'https://openidconnect.googleapis.com/v1/userinfo';

  return {
    id: 'google',
    label: 'Google',
    authorizeUrl(state, redirectUri) {
      const url = new URL(authorizeEndpoint);
      url.searchParams.set('client_id', opts.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', 'openid email profile');
      url.searchParams.set('state', state);
      return url.toString();
    },
    async exchangeCode(code, redirectUri) {
      const token = await fetchJson<{ access_token: string }>(
        tokenEndpoint,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: opts.clientId,
            client_secret: opts.clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        },
        'Google token exchange',
      );
      const info = await fetchJson<{ sub: string; email: string; name?: string }>(
        userinfoEndpoint,
        { headers: { authorization: `Bearer ${token.access_token}` } },
        'Google userinfo fetch',
      );
      return { providerAccountId: info.sub, email: info.email, name: info.name };
    },
  };
}

export interface GitHubProviderOptions {
  clientId: string;
  clientSecret: string;
  authorizeEndpoint?: string;
  tokenEndpoint?: string;
  userEndpoint?: string;
  emailsEndpoint?: string;
}

export function githubOAuthProvider(opts: GitHubProviderOptions): OAuthProvider {
  const authorizeEndpoint = opts.authorizeEndpoint ?? 'https://github.com/login/oauth/authorize';
  const tokenEndpoint = opts.tokenEndpoint ?? 'https://github.com/login/oauth/access_token';
  const userEndpoint = opts.userEndpoint ?? 'https://api.github.com/user';
  const emailsEndpoint = opts.emailsEndpoint ?? 'https://api.github.com/user/emails';

  return {
    id: 'github',
    label: 'GitHub',
    authorizeUrl(state, redirectUri) {
      const url = new URL(authorizeEndpoint);
      url.searchParams.set('client_id', opts.clientId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('scope', 'read:user user:email');
      url.searchParams.set('state', state);
      return url.toString();
    },
    async exchangeCode(code, redirectUri) {
      const token = await fetchJson<{ access_token?: string; error?: string }>(
        tokenEndpoint,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            accept: 'application/json',
          },
          body: new URLSearchParams({
            code,
            client_id: opts.clientId,
            client_secret: opts.clientSecret,
            redirect_uri: redirectUri,
          }),
        },
        'GitHub token exchange',
      );
      if (!token.access_token) {
        throw new Error(
          `GitHub token exchange failed: ${token.error ?? 'no access_token returned'}`,
        );
      }
      const headers = {
        authorization: `Bearer ${token.access_token}`,
        'user-agent': 'FerroCMS',
      };
      const user = await fetchJson<{
        id: number;
        name: string | null;
        login: string;
        email: string | null;
      }>(userEndpoint, { headers }, 'GitHub user fetch');
      // GitHub's /user only includes `email` if the user made it public;
      // otherwise look it up from /user/emails (needs the user:email scope).
      let email = user.email;
      if (!email) {
        const emails = await fetchJson<
          Array<{ email: string; primary: boolean; verified: boolean }>
        >(emailsEndpoint, { headers }, 'GitHub email fetch');
        email =
          emails.find((e) => e.primary && e.verified)?.email ??
          emails.find((e) => e.verified)?.email ??
          null;
      }
      if (!email) throw new Error('GitHub account has no accessible verified email.');
      return { providerAccountId: String(user.id), email, name: user.name ?? user.login };
    },
  };
}

/** Only a provider whose id *and* secret are both configured is offered. */
export function oauthProvidersFromConfig(config: AppConfig): OAuthProvider[] {
  const providers: OAuthProvider[] = [];
  if (config.googleClientId && config.googleClientSecret) {
    providers.push(
      googleOAuthProvider({
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
      }),
    );
  }
  if (config.githubClientId && config.githubClientSecret) {
    providers.push(
      githubOAuthProvider({
        clientId: config.githubClientId,
        clientSecret: config.githubClientSecret,
      }),
    );
  }
  return providers;
}
