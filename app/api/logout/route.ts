export const dynamic = 'force-dynamic';

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.append(
    'set-cookie',
    'geha_demo_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT'
  );
  return response;
}
