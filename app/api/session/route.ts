import { ensureDatabase } from '@/db/client';
import {
  expiredSessionCookie,
  getRoomSession,
  getSessionToken,
  hashToken,
  isSameOrigin,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getRoomSession(request);
  return Response.json(
    session ? { authenticated: true, session } : { authenticated: false },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE(request: Request) {
  if (!isSameOrigin(request)) return Response.json({ error: 'Недопустимый запрос' }, { status: 403 });
  const token = getSessionToken(request);
  if (token) {
    const db = await ensureDatabase();
    await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await hashToken(token)).run();
  }
  return Response.json(
    { authenticated: false },
    { headers: { 'Set-Cookie': expiredSessionCookie(request), 'Cache-Control': 'no-store' } },
  );
}
