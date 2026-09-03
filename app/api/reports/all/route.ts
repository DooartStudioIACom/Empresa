import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

  await ensureDatabase();
  const result = await env.DB.prepare(`
    SELECT id, function_name, institution, copy_number, version, system_path, description,
           status, urgent, author_email, created_at, updated_at
    FROM reports
    ORDER BY updated_at DESC
    LIMIT 200
  `).all();

  const imageResult = await env.DB.prepare(`
    SELECT id, report_id, file_name, kind
    FROM attachments
    WHERE kind IN ('inline', 'screenshot') AND content_type LIKE 'image/%'
    ORDER BY created_at ASC
  `).all<{ id: string; report_id: string; file_name: string; kind: string }>();
  const imagesByReport = new Map<string, Array<{ id: string; file_name: string; kind: string }>>();
  for (const image of imageResult.results) imagesByReport.set(image.report_id, [...(imagesByReport.get(image.report_id) || []), { id: image.id, file_name: image.file_name, kind: image.kind }]);

  return Response.json({ reports: result.results.map((report) => ({ ...report, images: imagesByReport.get(String(report.id)) || [] })) });
}
