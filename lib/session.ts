import { ensureDatabase } from '@/db/client';

const COOKIE_NAME = 'dinner_session';
const SESSION_DAYS = 180;

export type RoomMember = {
  id: string;
  displayName: string;
  slot: number;
  joined: boolean;
};

export type RoomSession = {
  room: { id: string; name: string };
  member: RoomMember;
  members: RoomMember[];
};

export async function hashToken(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 24) {
  const value = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = '';
  value.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function getSessionToken(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : '';
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

export async function getRoomSession(request: Request): Promise<RoomSession | null> {
  const token = getSessionToken(request);
  if (!token) return null;
  const db = await ensureDatabase();
  const tokenHash = await hashToken(token);
  const row = await db.prepare(`
    SELECT s.expires_at, m.id AS member_id, m.display_name, m.slot, m.joined_at,
      r.id AS room_id, r.name AS room_name
    FROM sessions s
    JOIN members m ON m.id = s.member_id
    JOIN rooms r ON r.id = m.room_id
    WHERE s.token_hash = ?
  `).bind(tokenHash).first<Record<string, unknown>>();

  if (!row) return null;
  if (String(row.expires_at) <= new Date().toISOString()) {
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(tokenHash).run();
    return null;
  }

  const result = await db.prepare(`
    SELECT id, display_name, slot, joined_at
    FROM members WHERE room_id = ? ORDER BY slot ASC
  `).bind(row.room_id).all<Record<string, unknown>>();
  const members = result.results.map((member) => ({
    id: String(member.id),
    displayName: String(member.display_name),
    slot: Number(member.slot),
    joined: Boolean(member.joined_at),
  }));

  return {
    room: { id: String(row.room_id), name: String(row.room_name) },
    member: {
      id: String(row.member_id),
      displayName: String(row.display_name),
      slot: Number(row.slot),
      joined: Boolean(row.joined_at),
    },
    members,
  };
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !origin || origin === new URL(request.url).origin;
}
