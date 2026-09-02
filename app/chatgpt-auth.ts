import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { env } from 'cloudflare:workers';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const USER_ID_HEADER = 'oai-authenticated-user-id';
const USER_EMAIL_HEADER = 'oai-authenticated-user-email';
const USER_FULL_NAME_HEADER = 'oai-authenticated-user-full-name';
const USER_FULL_NAME_ENCODING_HEADER =
  'oai-authenticated-user-full-name-encoding';
const PERCENT_ENCODED_UTF8 = 'percent-encoded-utf-8';
const SIGN_IN_PATH = '/signin-with-chatgpt';
const SIGN_OUT_PATH = '/signout-with-chatgpt';
const CALLBACK_PATH = '/callback';

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const requestHeaders = await headers();
  if (env.APP_AUTH_PROVIDER === 'demo-cookie') {
    return getDemoCookieUser();
  }
  if (env.APP_AUTH_PROVIDER === 'cloudflare-access') {
    return getCloudflareAccessUser(requestHeaders);
  }

  const userId = requestHeaders.get(USER_ID_HEADER);
  const email = requestHeaders.get(USER_EMAIL_HEADER);
  if (!email) return null;

  const encodedFullName = requestHeaders.get(USER_FULL_NAME_HEADER);
  const fullName =
    encodedFullName &&
    requestHeaders.get(USER_FULL_NAME_ENCODING_HEADER) === PERCENT_ENCODED_UTF8
      ? safeDecodeURIComponent(encodedFullName)
      : null;

  return {
    userId: userId ?? `email:${email.toLowerCase()}`,
    displayName: fullName ?? email,
    email,
    fullName,
  };
}

async function getDemoCookieUser(): Promise<ChatGPTUser | null> {
  const secret = env.DEMO_SESSION_SECRET;
  const token = (await cookies()).get('geha_demo_session')?.value;
  if (!secret || !token) return null;
  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) return null;
  const expected = await signDemoPayload(encodedPayload, secret);
  if (!timingSafeEqual(expected, encodedSignature)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload))) as { email?: string; exp?: number };
    const email = String(payload.email || '').toLowerCase();
    if (!isAllowedCompanyEmail(email) || !payload.exp || payload.exp < Date.now()) return null;
    const displayName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    return { userId: `demo:${email}`, displayName, email, fullName: null };
  } catch { return null; }
}

export async function createDemoSession(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  const secret = env.DEMO_SESSION_SECRET;
  if (!secret || !isAllowedCompanyEmail(normalized)) return null;
  const encodedPayload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ email: normalized, exp: Date.now() + 8 * 60 * 60 * 1000 })));
  return `${encodedPayload}.${await signDemoPayload(encodedPayload, secret)}`;
}

async function signDemoPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64UrlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))));
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = ''; for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}
function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0; for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}

async function getCloudflareAccessUser(requestHeaders: Headers): Promise<ChatGPTUser | null> {
  const token = requestHeaders.get('cf-access-jwt-assertion');
  const teamDomain = env.CLOUDFLARE_ACCESS_TEAM_DOMAIN?.replace(/\/$/, '');
  const audience = env.CLOUDFLARE_ACCESS_AUD;
  if (!token || !teamDomain || !audience) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`)),
      { issuer: teamDomain, audience },
    );
    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    if (!isAllowedCompanyEmail(email)) return null;
    const displayName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
    return {
      userId: typeof payload.sub === 'string' ? payload.sub : `email:${email}`,
      displayName,
      email,
      fullName: null,
    };
  } catch (error) {
    console.error(JSON.stringify({ message: 'Cloudflare Access token rejected', error: error instanceof Error ? error.message : String(error) }));
    return null;
  }
}

function isAllowedCompanyEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1);
  const allowedDomains = (env.ALLOWED_EMAIL_DOMAINS || 'geha.com.br,horario.com.br')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
  return email.includes('@') && allowedDomains.includes(domain);
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;

  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

export function chatGPTSignOutPath(returnTo = '/'): string {
  const safeReturnTo = safeRelativeReturnPath(returnTo);
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeReturnTo)}`;
}

function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';

  let url: URL;
  try {
    url = new URL(value, 'https://app.local');
  } catch {
    return '/';
  }
  if (url.origin !== 'https://app.local') return '/';
  if (isReservedAuthPath(url.pathname)) return '/';

  return `${url.pathname}${url.search}${url.hash}`;
}

function isReservedAuthPath(pathname: string): boolean {
  return (
    pathname === SIGN_IN_PATH ||
    pathname === SIGN_OUT_PATH ||
    pathname === CALLBACK_PATH
  );
}

function safeDecodeURIComponent(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
