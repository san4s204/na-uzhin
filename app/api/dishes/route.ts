import { ensureDatabase } from '@/db/client';
import { hasRoomAccess } from '@/lib/access';

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
  };
}

export async function GET(request: Request) {
  if (!(await hasRoomAccess(request))) return Response.json({ error: 'Требуется код доступа' }, { status: 401 });
  const db = await ensureDatabase();
  const result = await db.prepare(`
    SELECT d.*,
      COUNT(v.voter) AS votes,
      GROUP_CONCAT(v.voter, ',') AS voters
    FROM dishes d
    LEFT JOIN votes v ON v.dish_id = d.id
    GROUP BY d.id
    ORDER BY d.is_custom ASC, d.created_at ASC
  `).all();

  return Response.json({ dishes: result.results.map((row) => mapDish(row as Record<string, unknown>)) }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: Request) {
  if (!(await hasRoomAccess(request))) return Response.json({ error: 'Требуется код доступа' }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const name = String(body.name || '').trim().slice(0, 80);
  const minutes = Math.max(5, Math.min(240, Number(body.minutes) || 30));
  const category = ['Быстро', 'Уютно', 'Полегче'].includes(String(body.category)) ? String(body.category) : 'Уютно';
  const note = String(body.note || 'Наш новый фаворит').trim().slice(0, 100);
  const image = String(body.image || 'https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&fit=crop&w=1000&q=86').trim().slice(0, 500);
  const priceBand = ['₽', '₽₽', '₽₽₽'].includes(String(body.priceBand)) ? String(body.priceBand) : '₽₽';
  const createdBy = ['Я', 'Она'].includes(String(body.createdBy)) ? String(body.createdBy) : 'Вместе';

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
    createdAt: new Date().toISOString(),
  };

  const db = await ensureDatabase();
  await db.prepare(`
    INSERT INTO dishes
    (id, name, meta, minutes, category, note, image, color, price_band, created_by, is_custom, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).bind(dish.id, dish.name, dish.meta, dish.minutes, dish.category, dish.note, dish.image, dish.color, dish.priceBand, dish.createdBy, dish.createdAt).run();

  return Response.json({ dish: { ...dish, votes: 0, voters: [] } }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await hasRoomAccess(request))) return Response.json({ error: 'Требуется код доступа' }, { status: 401 });
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
    WHERE id = ? AND is_custom = 1
  `).bind(name, `${minutes} минут · своё блюдо`, minutes, category, note, image, category === 'Полегче' ? '#79935a' : category === 'Быстро' ? '#c88a27' : '#ee5837', priceBand, id).run();

  if (!result.meta.changes) return Response.json({ error: 'Блюдо не найдено' }, { status: 404 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await hasRoomAccess(request))) return Response.json({ error: 'Требуется код доступа' }, { status: 401 });
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return Response.json({ error: 'Не указано блюдо' }, { status: 400 });
  const db = await ensureDatabase();
  const result = await db.prepare('DELETE FROM dishes WHERE id = ? AND is_custom = 1').bind(id).run();
  return Response.json({ ok: Boolean(result.meta.changes) });
}


