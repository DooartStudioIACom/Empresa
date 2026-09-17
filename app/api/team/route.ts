import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';

export const dynamic = 'force-dynamic';
const ROLES = new Set(['support', 'manager', 'developer']);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const role = await getTeamRole(user.email);
  const members = await env.DB.prepare('SELECT email,name,role,updated_at FROM team_members ORDER BY CASE role WHEN \'manager\' THEN 1 WHEN \'developer\' THEN 2 ELSE 3 END,name').all();
  const rows = members.results as Array<{ email: string; name: string; role: string; updated_at: number }>;
  if (!rows.some((member) => member.email.toLowerCase() === user.email.toLowerCase())) rows.push({ email: user.email, name: user.fullName || user.displayName || user.email.split('@')[0], role, updated_at: Date.now() });
  return Response.json({ members: rows, currentRole: role });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const body = await request.json().catch(() => null) as { email?: string; name?: string; role?: string } | null;
  const email = String(body?.email || '').trim().toLowerCase();
  const role = String(body?.role || '').trim();
  const domain = email.slice(email.lastIndexOf('@') + 1);
  if (!email.includes('@') || !['geha.com.br', 'horario.com.br'].includes(domain)) return Response.json({ error: 'Use um e-mail corporativo válido' }, { status: 400 });
  if (!ROLES.has(role)) return Response.json({ error: 'Selecione uma função válida' }, { status: 400 });
  const fallbackName = email.split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const name = String(body?.name || '').trim() || fallbackName;
  const now = Date.now();
  await env.DB.prepare(`INSERT INTO team_members (email,name,role,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,role=excluded.role,updated_at=excluded.updated_at`).bind(email, name, role, now, now).run();
  return Response.json({ member: { email, name, role, updated_at: now } });
}
