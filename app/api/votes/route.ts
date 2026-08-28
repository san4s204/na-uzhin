import { ensureDatabase } from '@/db/client';
import { getRoomSession, isSameOrigin } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403 });
  const session = await getRoomSession(request);
  if (!session) return Response.json({ error: 'Сначала войдите в свой столик' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const dishId = String(body.dishId || '');
  if (!dishId) return Response.json({ error: 'Не удалось определить блюдо' }, { status: 400 });

  const db = await ensureDatabase();
  const dish = await db.prepare(`
    SELECT 1 AS found FROM dishes
    WHERE id = ? AND (is_custom = 0 OR room_id = ?)
  `).bind(dishId, session.room.id).first();
  if (!dish) return Response.json({ error: 'Блюдо не найдено' }, { status: 404 });

  const existing = await db.prepare(`
    SELECT 1 AS found FROM room_votes WHERE room_id = ? AND dish_id = ? AND member_id = ?
  `).bind(session.room.id, dishId, session.member.id).first();
  if (existing) {
    await db.prepare('DELETE FROM room_votes WHERE room_id = ? AND dish_id = ? AND member_id = ?')
      .bind(session.room.id, dishId, session.member.id).run();
    return Response.json({ active: false });
  }

  await db.prepare(`
    INSERT OR IGNORE INTO room_votes (room_id, dish_id, member_id, created_at) VALUES (?, ?, ?, ?)
  `).bind(session.room.id, dishId, session.member.id, new Date().toISOString()).run();
  return Response.json({ active: true });
}


