/**
 * Phase 9 — Desktop OAuth 2.0 PKCE Loopback Service (Tauri v2)
 *
 * Flow:
 * 1. Calls Rust `oauth_start_loopback` to bind a temporary HTTP listener on 127.0.0.1:<random_port>
 * 2. Builds an S256 PKCE authorization URL with redirect_uri = http://localhost:{port}/callback
 * 3. Opens the provider sign-in page in the user's system browser via `@tauri-apps/plugin-shell`
 * 4. Waits for the browser redirect on localhost:{port}/callback (validating CSRF `state`)
 * 5. Exchanges the authorization code + code_verifier for access + refresh tokens
 * 6. Stores the token bundle securely in the OS keychain via KeychainService
 * 7. Local HTTP listener shuts down immediately on callback or timeout
 */

import { invoke } from '@tauri-apps/api/core';
import { open as openExternalUrl } from '@tauri-apps/plugin-shell';
import { KeychainService, isDesktop } from './KeychainService';
import { DROPBOX_APP_KEY } from '../utils/dropboxSync';
import firebaseConfig from '../../firebase-applet-config.json';

export type DesktopOAuthProvider = 'gdrive' | 'dropbox' | 'pcloud';

export interface DesktopOAuthTokenBundle {
  provider: DesktopOAuthProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  email?: string;
  name?: string;
  accountId?: string;
}

export interface LoopbackOAuthConfig {
  provider: DesktopOAuthProvider;
  authorizeEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  scope?: string;
  extraAuthorizeParams?: Record<string, string>;
  timeoutSeconds?: number;
}

interface LoopbackStartResponse {
  sessionId: string;
  port: number;
  redirectUri: string;
}

interface LoopbackCallbackResponse {
  code: string;
  state: string;
  redirectUri: string;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generatePkceAndState(): Promise<{
  verifier: string;
  challenge: string;
  state: string;
}> {
  const verifierBytes = new Uint8Array(48);
  const stateBytes = new Uint8Array(24);
  crypto.getRandomValues(verifierBytes);
  crypto.getRandomValues(stateBytes);

  const verifier = base64UrlEncode(verifierBytes);
  const state = base64UrlEncode(stateBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));

  return { verifier, challenge, state };
}

function assertSafeHttpsUrl(rawUrl: string): void {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('OAuth URL must use HTTPS.');
  }
}

/**
 * Default desktop OAuth configurations for registered JivanOS providers.
 * Redirect URIs registered in provider consoles:
 * - Google Drive: http://localhost (Tauri matches any loopback port)
 * - Dropbox:      http://localhost:{port}/callback
 * - pCloud:       http://localhost:{port}/callback
 */
export function getProviderOAuthConfig(provider: DesktopOAuthProvider): LoopbackOAuthConfig {
  if (provider === 'dropbox') {
    return {
      provider: 'dropbox',
      authorizeEndpoint: 'https://www.dropbox.com/oauth2/authorize',
      tokenEndpoint: 'https://api.dropboxapi.com/oauth2/token',
      clientId: DROPBOX_APP_KEY,
      extraAuthorizeParams: {
        token_access_type: 'offline',
      },
    };
  }

  if (provider === 'gdrive') {
    const gdriveClientId =
      (import.meta as any).env?.VITE_GOOGLE_DESKTOP_CLIENT_ID ||
      (firebaseConfig as { oAuthClientId?: string }).oAuthClientId ||
      '';
    if (!gdriveClientId) {
      throw new Error('Google Drive desktop OAuth Client ID is not configured.');
    }
    return {
      provider: 'gdrive',
      authorizeEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenEndpoint: 'https://oauth2.googleapis.com/token',
      clientId: gdriveClientId,
      scope:
        'openid email profile https://www.googleapis.com/auth/drive.appdata',
      extraAuthorizeParams: {
        access_type: 'offline',
        prompt: 'select_account consent',
      },
    };
  }

  // pCloud (optional desktop provider)
  const pcloudClientId = (import.meta as any).env?.VITE_PCLOUD_CLIENT_ID || '';
  if (!pcloudClientId) {
    throw new Error('pCloud Client ID is not configured.');
  }
  return {
    provider: 'pcloud',
    authorizeEndpoint: 'https://my.pcloud.com/oauth2/authorize',
    tokenEndpoint: 'https://api.pcloud.com/oauth2_token',
    clientId: pcloudClientId,
  };
}

/**
 * Executes a complete OAuth 2.0 PKCE loopback login in the system browser
 * and stores the resulting tokens in the OS keychain.
 */
export async function runDesktopOAuthLoopback(
  providerOrConfig: DesktopOAuthProvider | LoopbackOAuthConfig
): Promise<DesktopOAuthTokenBundle> {
  if (!isDesktop()) {
    throw new Error('Desktop OAuth loopback is only available in the JivanOS desktop app.');
  }

  const config =
    typeof providerOrConfig === 'string'
      ? getProviderOAuthConfig(providerOrConfig)
      : providerOrConfig;

  const { verifier, challenge, state } = await generatePkceAndState();

  // 1. Start temporary HTTP listener on 127.0.0.1:<random_port>
  const loopback = await invoke<LoopbackStartResponse>('oauth_start_loopback');

  try {
    // 2. Build provider authorize URL with S256 PKCE + loopback redirect_uri
    const authUrl = new URL(config.authorizeEndpoint);
    authUrl.searchParams.set('client_id', config.clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', loopback.redirectUri);
    authUrl.searchParams.set('code_challenge', challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');
    authUrl.searchParams.set('state', state);
    if (config.scope) {
      authUrl.searchParams.set('scope', config.scope);
    }
    if (config.extraAuthorizeParams) {
      for (const [k, v] of Object.entries(config.extraAuthorizeParams)) {
        authUrl.searchParams.set(k, v);
      }
    }

    const finalUrl = authUrl.toString();
    assertSafeHttpsUrl(finalUrl);

    // 3. Open authorize URL in system default browser via Tauri shell plugin
    await openExternalUrl(finalUrl);

    // 4. Wait for localhost:{port}/callback with verified CSRF state
    const callback = await invoke<LoopbackCallbackResponse>('oauth_wait_callback', {
      sessionId: loopback.sessionId,
      expectedState: state,
      timeoutSecs: config.timeoutSeconds ?? 180,
    });

    // 5. Exchange authorization code for access + refresh token
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: callback.code,
      client_id: config.clientId,
      code_verifier: verifier,
      redirect_uri: callback.redirectUri,
    });

    const tokenRes = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      throw new Error(`Token exchange failed for ${config.provider} (HTTP ${tokenRes.status}).`);
    }

    const tokenJson = await tokenRes.json();
    if (!tokenJson?.access_token) {
      throw new Error(`Provider ${config.provider} did not return an access token.`);
    }

    const expiresInSec = Number(tokenJson.expires_in || 3600);
    const bundle: DesktopOAuthTokenBundle = {
      provider: config.provider,
      accessToken: String(tokenJson.access_token),
      refreshToken: tokenJson.refresh_token ? String(tokenJson.refresh_token) : undefined,
      expiresAt: Date.now() + expiresInSec * 1000,
      scope: typeof tokenJson.scope === 'string' ? tokenJson.scope : config.scope,
      accountId: tokenJson.account_id ? String(tokenJson.account_id) : undefined,
    };

    // 6. Store token bundle in OS keychain (Windows Credential Manager / Linux libsecret)
    await KeychainService.setToken(config.provider, JSON.stringify(bundle));

    return bundle;
  } catch (err) {
    // Ensure loopback listener is closed even if browser launch or exchange fails
    await invoke('oauth_cancel_loopback', { sessionId: loopback.sessionId }).catch(() => {});
    throw err;
  }
}

/**
 * Loads a stored desktop OAuth token bundle from the OS keychain and refreshes it if near expiry.
 */
export async function getValidDesktopOAuthToken(
  provider: DesktopOAuthProvider
): Promise<DesktopOAuthTokenBundle | null> {
  const raw = await KeychainService.getToken(provider);
  if (!raw) return null;

  let bundle: DesktopOAuthTokenBundle;
  try {
    bundle = JSON.parse(raw) as DesktopOAuthTokenBundle;
  } catch {
    return null;
  }

  if (!bundle?.accessToken) return null;

  // Still valid for > 60 seconds
  if (Date.now() < (bundle.expiresAt || 0) - 60_000) {
    return bundle;
  }

  // Attempt silent refresh using refresh_token
  if (!bundle.refreshToken) {
    return bundle;
  }

  const config = getProviderOAuthConfig(provider);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: bundle.refreshToken,
    client_id: config.clientId,
  });

  const res = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    return null;
  }

  const refreshed = await res.json();
  if (!refreshed?.access_token) return null;

  const updated: DesktopOAuthTokenBundle = {
    ...bundle,
    accessToken: String(refreshed.access_token),
    refreshToken: refreshed.refresh_token ? String(refreshed.refresh_token) : bundle.refreshToken,
    expiresAt: Date.now() + Number(refreshed.expires_in || 3600) * 1000,
  };

  await KeychainService.setToken(provider, JSON.stringify(updated));
  return updated;
}

export const OAuthLoopback = {
  runDesktopOAuthLoopback,
  getValidDesktopOAuthToken,
  getProviderOAuthConfig,
};
