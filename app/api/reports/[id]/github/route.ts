import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';
import { getTeamRole } from '@/lib/report-access';

export const dynamic = 'force-dynamic';

type ReportRow = {
  id: string;
  institution: string;
  city: string | null;
  copy_number: string | null;
  inep: string | null;
  client_name: string | null;
  function_name: string;
  version: string | null;
  system_path: string;
  description: string;
  school_year: string | null;
  urgent: number;
  beta_status: string;
  workaround: string | null;
  author_email: string;
  github_issue_url: string | null;
};

type AttachmentRow = {
  id: string;
  file_name: string;
  content_type: string;
  kind: string;
  github_share_token: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  if (await getTeamRole(user.email) !== 'manager') return Response.json({ error: 'Somente a gerência pode preparar o envio ao GitHub.' }, { status: 403 });

  const { id } = await params;
  const report = await env.DB.prepare('SELECT id,institution,city,copy_number,inep,client_name,function_name,version,system_path,description,school_year,urgent,beta_status,workaround,author_email,github_issue_url FROM reports WHERE id=?').bind(id).first<ReportRow>();
  if (!report) return Response.json({ error: 'Report não encontrado' }, { status: 404 });

  const payload = await request.json().catch(() => ({})) as { action?: string; issueUrl?: string };
  if (payload.action === 'save-link') return saveIssueLink(report, payload.issueUrl || '', user.userId, user.email);
  if (payload.action !== 'prepare') return Response.json({ error: 'Ação inválida' }, { status: 400 });

  const attachments = await env.DB.prepare('SELECT id,file_name,content_type,kind,github_share_token FROM attachments WHERE report_id=? ORDER BY created_at,id').bind(id).all<AttachmentRow>();
  const images = attachments.results.filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.content_type) && ['inline', 'screenshot'].includes(file.kind));
  const tokenById = new Map<string, string>();
  const updates: D1PreparedStatement[] = [];
  for (const image of images) {
    const token = image.github_share_token || crypto.randomUUID().replaceAll('-', '');
    tokenById.set(image.id, token);
    if (!image.github_share_token) updates.push(env.DB.prepare('UPDATE attachments SET github_share_token=? WHERE id=? AND github_share_token IS NULL').bind(token, image.id));
  }
  if (updates.length) await env.DB.batch(updates);

  const origin = new URL(request.url).origin;
  const imageUrl = (attachmentId: string) => {
    const token = tokenById.get(attachmentId);
    return token ? `${origin}/api/github-assets/${encodeURIComponent(token)}` : '';
  };
  const markdown = buildMarkdown(report, attachments.results, imageUrl);
  return Response.json({ title: `[BUG] ${report.function_name}`, markdown, imageCount: images.length, issueUrl: report.github_issue_url });
}

async function saveIssueLink(report: ReportRow, rawUrl: string, userId: string, userEmail: string) {
  const issueUrl = rawUrl.trim();
  if (issueUrl && !isGitHubIssueUrl(issueUrl)) return Response.json({ error: 'Cole um link válido de issue do GitHub.' }, { status: 400 });
  const now = Date.now();
  const message = issueUrl ? `Issue do GitHub vinculada: ${issueUrl}` : 'Vínculo com a issue do GitHub removido.';
  await env.DB.batch([
    env.DB.prepare('UPDATE reports SET github_issue_url=?,updated_at=? WHERE id=?').bind(issueUrl || null, now, report.id),
    env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), report.id, userId, userEmail, issueUrl ? 'github_issue_linked' : 'github_issue_unlinked', message, now),
  ]);
  return Response.json({ ok: true, issueUrl: issueUrl || null });
}

function isGitHubIssueUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname.toLowerCase() === 'github.com' && /^\/[^/]+\/[^/]+\/issues\/\d+\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function buildMarkdown(report: ReportRow, attachments: AttachmentRow[], imageUrl: (id: string) => string) {
  const lines = [
    `# [BUG] ${report.function_name}`,
    '',
    '## Contexto',
    '',
    '| Campo | Informação |',
    '| --- | --- |',
    `| Report de origem | ${tableValue(report.id)} |`,
    `| Instituição | ${tableValue(report.institution)} |`,
    `| Cidade | ${tableValue(report.city)} |`,
    `| Cópia | ${tableValue(report.copy_number)} |`,
    `| INEP | ${tableValue(report.inep)} |`,
    `| Cliente | ${tableValue(report.client_name)} |`,
    `| Versão | ${tableValue(report.version)} |`,
    `| Ano letivo | ${tableValue(report.school_year)} |`,
    `| Prioridade | ${report.urgent ? 'Alta' : 'Normal'} |`,
    `| Ambiente beta | ${tableValue(report.beta_status)} |`,
    '',
    '## Caminho no sistema',
    '',
    report.system_path || 'Não informado',
    '',
    '## Descrição e evidências',
    '',
  ];

  const inlineIds = new Set<string>();
  const parsed = parseDescription(report.description);
  if (parsed) {
    for (const block of parsed) {
      if (block.type === 'text' && block.value?.trim()) lines.push(block.value.trim(), '');
      if (block.type === 'image' && block.attachmentId) {
        const url = imageUrl(block.attachmentId);
        if (url) {
          inlineIds.add(block.attachmentId);
          lines.push(`![${markdownAlt(block.caption || 'Evidência do problema')}](${url})`, '');
          if (block.caption?.trim()) lines.push(`_${block.caption.trim()}_`, '');
        }
      }
    }
  } else {
    lines.push(report.description || 'Descrição não informada.', '');
  }

  const additionalImages = attachments.filter((file) => ['inline', 'screenshot'].includes(file.kind) && !inlineIds.has(file.id) && imageUrl(file.id));
  if (additionalImages.length) {
    lines.push('## Evidências adicionais', '');
    for (const file of additionalImages) lines.push(`![${markdownAlt(file.file_name)}](${imageUrl(file.id)})`, '');
  }
  if (report.workaround?.trim()) lines.push('## Solução alternativa', '', report.workaround.trim(), '');
  lines.push('---', '', `Reportado por: ${report.author_email}`, `Referência interna: ${report.id}`);
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseDescription(value: string) {
  try {
    const parsed = JSON.parse(value) as { blocks?: Array<{ type?: string; value?: string; attachmentId?: string; caption?: string }> };
    return Array.isArray(parsed.blocks) ? parsed.blocks : null;
  } catch {
    return null;
  }
}

function tableValue(value: string | null) { return value?.trim() ? value.replaceAll('|', '\\|').replace(/\r?\n/g, ' ') : 'Não informado'; }
function markdownAlt(value: string) { return value.replace(/[\[\]\r\n]/g, ' ').trim() || 'Evidência'; }
