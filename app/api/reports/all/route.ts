import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  await ensureDatabase();
  const result = await env.DB.prepare(`
    SELECT id, function_name, institution, copy_number, version, system_path,
           status, urgent, author_email, created_at, updated_at
    FROM reports
    ORDER BY updated_at DESC
    LIMIT 200
  `).all();

  return Response.json({ reports: result.results });
}
