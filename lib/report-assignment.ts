// Uses the existing audit log as the source of truth; old reports remain unassigned.
export const claimCorrectionSql = `INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at)
  SELECT ?,r.id,?,?,'correction_claimed','Assumiu a responsabilidade pela correção.',? FROM reports r
  WHERE r.id=? AND r.status=? AND NOT EXISTS (SELECT 1 FROM activities WHERE report_id=r.id AND action='correction_claimed')`;

export const assignmentColumns = `
  (SELECT actor_email FROM activities WHERE report_id=r.id AND action='correction_claimed' ORDER BY created_at DESC, id DESC LIMIT 1) AS developer_email,
  (SELECT actor_email FROM activities WHERE report_id=r.id AND action='report_validated' ORDER BY created_at DESC, id DESC LIMIT 1) AS validator_email
`;

export function responsibleEmail(report: Record<string, unknown>) {
  const status = String(report.status || '');
  if (['Com Desenvolvimento', 'Em análise', 'Em correção', 'Em teste', 'Ainda ocorre'].includes(status)) return String(report.developer_email || '');
  if (['Finalizado', 'Corrigido'].includes(status)) return String(report.validator_email || '');
  return String(report.author_email || '');
}
