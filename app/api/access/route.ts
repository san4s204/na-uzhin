import { accessCookie, expiredAccessCookie, hasRoomAccess, verifyRoomCode } from '@/lib/access';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return Response.json({ authenticated: await hasRoomAccess(request) }, { headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request) {
  const body = await request.json() as { code?: string };
  if (!body.code || !(await verifyRoomCode(body.code))) {
    return Response.json({ error: 'Код не подошёл' }, { status: 401 });
  }
  return Response.json({ authenticated: true }, { headers: { 'Set-Cookie': await accessCookie(request) } });
}

export async function DELETE(request: Request) {
  return Response.json({ authenticated: false }, { headers: { 'Set-Cookie': expiredAccessCookie(request) } });
}
