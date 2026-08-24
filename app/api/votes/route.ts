import { ensureDatabase } from '@/db/client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const dishId = String(body.dishId || '');
  const voter = String(body.voter || '');
  if (!dishId || !['Я', 'Она'].includes(voter)) {
    return Response.json({ error: 'Не удалось определить голос' }, { status: 400 });
  }

  const db = await ensureDatabase();
  const existing = await db.prepare('SELECT 1 AS found FROM votes WHERE dish_id = ? AND voter = ?').bind(dishId, voter).first();
  if (existing) {
    await db.prepare('DELETE FROM votes WHERE dish_id = ? AND voter = ?').bind(dishId, voter).run();
    return Response.json({ active: false });
  }

  await db.prepare('INSERT OR IGNORE INTO votes (dish_id, voter, created_at) VALUES (?, ?, ?)').bind(dishId, voter, new Date().toISOString()).run();
  return Response.json({ active: true });
}
