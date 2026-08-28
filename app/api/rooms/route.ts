import { ensureDatabase } from '@/db/client';
import { hasRoomAccess } from '@/lib/access';
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
  if (await getRoomSession(request)) return Response.json({ error: 'Вы уже состоите в паре' }, { status: 409 });

  const body = await request.json() as Record<string, unknown>;
  const ownerName = cleanName(body.ownerName);
  const partnerName = cleanName(body.partnerName);
  const roomName = cleanName(body.roomName, ownerName && partnerName ? `${ownerName} + ${partnerName}` : 'Наш столик');
  if (ownerName.length < 2 || partnerName.length < 2) {
    return Response.json({ error: 'Укажите оба имени' }, { status: 400 });
  }

  const db = await ensureDatabase();
  const now = new Date().toISOString();
  const roomId = crypto.randomUUID();
  const ownerId = crypto.randomUUID();
  const partnerId = crypto.randomUUID();
  const inviteToken = randomToken();
  const inviteHash = await hashToken(inviteToken);
  const sessionToken = randomToken(32);
  const sessionHash = await hashToken(sessionToken);
  const legacyClaim = await db.prepare('SELECT room_id FROM legacy_imports WHERE id = 1').first();
  const importLegacy = !legacyClaim && await hasRoomAccess(request);

  const statements = [
    db.prepare('INSERT INTO rooms (id, name, invite_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(roomId, roomName, inviteHash, now),
    db.prepare(`INSERT INTO members (id, room_id, display_name, slot, joined_at, created_at)
      VALUES (?, ?, ?, 1, ?, ?)`).bind(ownerId, roomId, ownerName, now, now),
    db.prepare(`INSERT INTO members (id, room_id, display_name, slot, joined_at, created_at)
      VALUES (?, ?, ?, 2, NULL, ?)`).bind(partnerId, roomId, partnerName, now),
    db.prepare('INSERT INTO sessions (token_hash, member_id, expires_at, created_at) VALUES (?, ?, ?, ?)')
      .bind(sessionHash, ownerId, sessionExpiry(), now),
  ];

  if (importLegacy) {
    statements.push(
      db.prepare('INSERT OR IGNORE INTO legacy_imports (id, room_id, imported_at) VALUES (1, ?, ?)')
        .bind(roomId, now),
      db.prepare(`UPDATE dishes
        SET room_id = ?,
          creator_member_id = CASE created_by WHEN 'Она' THEN ? ELSE ? END,
          created_by = CASE created_by WHEN 'Она' THEN ? WHEN 'Я' THEN ? ELSE created_by END
        WHERE is_custom = 1 AND room_id IS NULL`)
        .bind(roomId, partnerId, ownerId, partnerName, ownerName),
      db.prepare(`INSERT OR IGNORE INTO room_votes (room_id, dish_id, member_id, created_at)
        SELECT ?, dish_id, CASE voter WHEN 'Она' THEN ? ELSE ? END, created_at
        FROM votes WHERE voter IN ('Я', 'Она')`).bind(roomId, partnerId, ownerId),
    );
  }

  await db.batch(statements);
  const session: RoomSession = {
    room: { id: roomId, name: roomName },
    member: { id: ownerId, displayName: ownerName, slot: 1, joined: true },
    members: [
      { id: ownerId, displayName: ownerName, slot: 1, joined: true },
      { id: partnerId, displayName: partnerName, slot: 2, joined: false },
    ],
  };
  const inviteUrl = `${new URL(request.url).origin}/?invite=${encodeURIComponent(inviteToken)}`;
  return Response.json(
    { session, inviteUrl, imported: importLegacy },
    { status: 201, headers: { 'Set-Cookie': sessionCookie(request, sessionToken), 'Cache-Control': 'no-store' } },
  );
}
