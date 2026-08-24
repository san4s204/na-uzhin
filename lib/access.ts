import { env } from 'cloudflare:workers';

const COOKIE_NAME = 'dinner_access';
const SESSION_CONTEXT = 'na-uzhin-room-v1';

function getRoomCode() {
  return String((env as unknown as { DINNER_ROOM_CODE?: string }).DINNER_ROOM_CODE || 'local-dinner-room');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function getAccessToken() {
  return sha256(`${SESSION_CONTEXT}:${getRoomCode()}`);
}

export async function verifyRoomCode(candidate: string) {
  const expected = await sha256(getRoomCode().trim().toLowerCase());
  const actual = await sha256(candidate.trim().toLowerCase());
  if (expected.length !== actual.length) return false;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) difference |= expected.charCodeAt(index) ^ actual.charCodeAt(index);
  return difference === 0;
}

export async function hasRoomAccess(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  return decodeURIComponent(match[1]) === await getAccessToken();
}

export async function accessCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(await getAccessToken())}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${secure}`;
}

export function expiredAccessCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
