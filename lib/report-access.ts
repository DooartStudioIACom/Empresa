import { env } from 'cloudflare:workers';

export type TeamRole = 'support' | 'manager' | 'developer';

export async function getTeamRole(email: string): Promise<TeamRole> {
  const member = await env.DB.prepare('SELECT role FROM team_members WHERE lower(email)=lower(?)').bind(email).first<{ role: string }>();
  return member?.role === 'manager' || member?.role === 'developer' ? member.role : 'support';
}

export function teamRoleLabel(role: TeamRole) {
  if (role === 'manager') return 'Gerência';
  if (role === 'developer') return 'Desenvolvimento';
  return 'Suporte';
}
