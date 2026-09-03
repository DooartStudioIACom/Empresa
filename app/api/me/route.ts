import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole, teamRoleLabel } from '@/lib/report-access';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const now = Date.now();
  await env.DB.prepare('INSERT OR IGNORE INTO team_members (email,name,role,created_at,updated_at) VALUES (?,?,?,?,?)').bind(user.email.toLowerCase(), user.displayName, 'support', now, now).run();
  const role = await getTeamRole(user.email);
  return Response.json({
    displayName: user.displayName,
    email: user.email,
    role,
    roleLabel: teamRoleLabel(role),
  });
}
