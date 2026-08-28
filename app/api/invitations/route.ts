import { ensureDatabase } from '@/db/client';
import {
  getRoomSession,
  hashToken,
  isSameOrigin,
  randomToken,
  sessionCookie,
  sessionExpiry,
  type RoomSession,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

function cleanName(value: unknown, fallback = '') {
  return String(value || fallback).trim().replace(/\s+/g, ' ').slice(0, 32);
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action || 'join');
  const db = await ensureDatabase();

  if (action === 'rotate') {
    const session = await getRoomSession(request);
    if (!session || session.member.slot !== 1) {
      return Response.json({ error: 'Только создатель столика может пригласить партнёра' }, { status: 403 });
    }
    const partner = session.members.find((member) => member.slot === 2);
    if (partner?.joined) return Response.json({ error: 'Партнёр уже присоединился' }, { status: 409 });
    const inviteToken = randomToken();
    await db.prepare('UPDATE rooms SET invite_hash = ? WHERE id = ?')
      .bind(await hashToken(inviteToken), session.room.id).run();
    return Response.json({
      inviteUrl: `${new URL(request.url).origin}/?invite=${encodeURIComponent(inviteToken)}`,
    }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (await getRoomSession(request)) {
    return Response.json({ error: 'Сначала выйдите из текущего столика' }, { status: 409 });
  }
  const inviteToken = String(body.invite || '').trim();
  if (inviteToken.length < 20) return Response.json({ error: 'Ссылка-приглашение повреждена' }, { status: 400 });

  const room = await db.prepare('SELECT id, name FROM rooms WHERE invite_hash = ?')
    .bind(await hashToken(inviteToken)).first<Record<string, unknown>>();
  if (!room) return Response.json({ error: 'Приглашение недействительно или уже использовано' }, { status: 404 });
  const partner = await db.prepare(`
    SELECT id, display_name, joined_at FROM members WHERE room_id = ? AND slot = 2
  `).bind(room.id).first<Record<string, unknown>>();
  if (!partner || partner.joined_at) {
    return Response.json({ error: 'Партнёр уже присоединился' }, { status: 409 });
  }

  const displayName = cleanName(body.displayName, String(partner.display_name));
  if (displayName.length < 2) return Response.json({ error: 'Укажите ваше имя' }, { status: 400 });
  const now = new Date().toISOString();
  const sessionToken = randomToken(32);
  const sessionHash = await hashToken(sessionToken);
  const [claim] = await db.batch([
    db.prepare('UPDATE members SET display_name = ?, joined_at = ? WHERE id = ? AND joined_at IS NULL')
      .bind(displayName, now, partner.id),
    db.prepare('UPDATE rooms SET invite_hash = NULL WHERE id = ?').bind(room.id),
    db.prepare('INSERT INTO sessions (token_hash, member_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(sessionHash, partner.id, sessionExpiry(), now),
  ]);
  if (!claim.meta.changes) return Response.json({ error: 'Приглашение уже использовано' }, { status: 409 });

  const owner = await db.prepare(`
    SELECT id, display_name, joined_at FROM members WHERE room_id = ? AND slot = 1
  `).bind(room.id).first<Record<string, unknown>>();
  const session: RoomSession = {
    room: { id: String(room.id), name: String(room.name) },
    member: { id: String(partner.id), displayName, slot: 2, joined: true },
    members: [
      { id: String(owner?.id), displayName: String(owner?.display_name), slot: 1, joined: Boolean(owner?.joined_at) },
      { id: String(partner.id), displayName, slot: 2, joined: true },
    ],
  };
  return Response.json(
    { session },
    { headers: { 'Set-Cookie': sessionCookie(request, sessionToken), 'Cache-Control': 'no-store' } },
  );
}
