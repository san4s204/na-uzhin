import { ensureDatabase } from '@/db/client';
import { getRoomSession, isSameOrigin } from '@/lib/session';

export const dynamic = 'force-dynamic';

function mapDish(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    meta: row.meta,
    minutes: row.minutes,
    category: row.category,
    note: row.note,
    image: row.image,
    color: row.color,
    priceBand: row.price_band,
    createdBy: row.created_by,
    isCustom: Boolean(row.is_custom),
    createdAt: row.created_at,
    votes: Number(row.votes || 0),
    voters: typeof row.voters === 'string' && row.voters ? row.voters.split(',') : [],
    voterIds: typeof row.voter_ids === 'string' && row.voter_ids ? row.voter_ids.split(',') : [],
  };
}

export async function GET(request: Request) {
  const session = await getRoomSession(request);
  if (!session) return Response.json({ error: 'Сначала войдите в свой столик' }, { status: 401 });
  const db = await ensureDatabase();
  const result = await db.prepare(`
    SELECT d.*,
      COUNT(rv.member_id) AS votes,
      GROUP_CONCAT(m.display_name, ',') AS voters,
      GROUP_CONCAT(rv.member_id, ',') AS voter_ids
    FROM dishes d
    LEFT JOIN room_votes rv ON rv.dish_id = d.id AND rv.room_id = ?
    LEFT JOIN members m ON m.id = rv.member_id
    WHERE d.is_custom = 0 OR d.room_id = ?
    GROUP BY d.id
    ORDER BY d.is_custom ASC, d.created_at ASC
  `).bind(session.room.id, session.room.id).all();

  return Response.json({ dishes: result.results.map((row) => mapDish(row as Record<string, unknown>)) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403 });
  const session = await getRoomSession(request);
  if (!session) return Response.json({ error: 'Сначала войдите в свой столик' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name || '').trim().slice(0, 80);
  const minutes = Math.max(5, Math.min(240, Number(body.minutes) || 30));
  const category = ['Быстро', 'Уютно', 'Полегче'].includes(String(body.category)) ? String(body.category) : 'Уютно';
  const note = String(body.note || 'Наш новый фаворит').trim().slice(0, 100);
  const image = String(body.image || 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=1000&q=86').trim().slice(0, 500);
  const priceBand = ['₽', '₽₽', '₽₽₽'].includes(String(body.priceBand)) ? String(body.priceBand) : '₽₽';
  const createdBy = session.member.displayName;

  if (name.length < 2) return Response.json({ error: 'Добавьте название блюда' }, { status: 400 });
  if (!image.startsWith('https://')) return Response.json({ error: 'Ссылка на фото должна начинаться с https://' }, { status: 400 });

  const dish = {
    id: crypto.randomUUID(),
    name,
    meta: `${minutes} минут · своё блюдо`,
    minutes,
    category,
    note,
    image,
    color: category === 'Полегче' ? '#79935a' : category === 'Быстро' ? '#c88a27' : '#ee5837',
    priceBand,
    createdBy,
    isCustom: true,
    roomId: session.room.id,
    creatorMemberId: session.member.id,
    createdAt: new Date().toISOString(),
  };

  const db = await ensureDatabase();
  await db.prepare(`
    INSERT INTO dishes
    (id, name, meta, minutes, category, note, image, color, price_band, created_by, is_custom, room_id, creator_member_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
  `).bind(dish.id, dish.name, dish.meta, dish.minutes, dish.category, dish.note, dish.image, dish.color, dish.priceBand, dish.createdBy, dish.roomId, dish.creatorMemberId, dish.createdAt).run();

  return Response.json({ dish: { ...dish, votes: 0, voters: [], voterIds: [] } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403 });
  const session = await getRoomSession(request);
  if (!session) return Response.json({ error: 'Сначала войдите в свой столик' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = String(body.id || '');
  const name = String(body.name || '').trim().slice(0, 80);
  const minutes = Math.max(5, Math.min(240, Number(body.minutes) || 30));
  const category = ['Быстро', 'Уютно', 'Полегче'].includes(String(body.category)) ? String(body.category) : 'Уютно';
  const note = String(body.note || 'Наш новый фаворит').trim().slice(0, 100);
  const image = String(body.image || '').trim().slice(0, 500);
  const priceBand = ['₽', '₽₽', '₽₽₽'].includes(String(body.priceBand)) ? String(body.priceBand) : '₽₽';

  if (!id || name.length < 2 || !image.startsWith('https://')) return Response.json({ error: 'Проверьте данные блюда' }, { status: 400 });

  const db = await ensureDatabase();
  const result = await db.prepare(`
    UPDATE dishes
    SET name = ?, meta = ?, minutes = ?, category = ?, note = ?, image = ?, color = ?, price_band = ?
    WHERE id = ? AND is_custom = 1 AND room_id = ?
  `).bind(name, `${minutes} минут · своё блюдо`, minutes, category, note, image, category === 'Полегче' ? '#79935a' : category === 'Быстро' ? '#c88a27' : '#ee5837', priceBand, id, session.room.id).run();

  if (!result.meta.changes) return Response.json({ error: 'Блюдо не найдено' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403 });
  const session = await getRoomSession(request);
  if (!session) return Response.json({ error: 'Сначала войдите в свой столик' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Не указано блюдо' }, { status: 400 });
  const db = await ensureDatabase();
  const result = await db.prepare('DELETE FROM dishes WHERE id = ? AND is_custom = 1 AND room_id = ?').bind(id, session.room.id).run();
  return Response.json({ ok: Boolean(result.meta.changes) });
}


