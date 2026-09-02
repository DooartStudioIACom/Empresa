import { createDemoSession } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { email } = await request.json<{ email?: string }>();
  const session = await createDemoSession(String(email || ''));
  if (!session) return Response.json({ error: 'Use um e-mail @geha.com.br ou @horario.com.br' }, { status: 400 });
  const response = Response.json({ ok: true });
  response.headers.append('set-cookie', `geha_demo_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`);
  return response;
}
