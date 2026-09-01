import { getChatGPTUser } from '@/app/chatgpt-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  return Response.json({
    displayName: user.displayName,
    email: user.email,
  });
}
