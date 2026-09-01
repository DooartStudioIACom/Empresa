import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function GET() {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase();
  const result = await env.DB.prepare(`SELECT r.*, COUNT(a.id) AS attachment_count FROM reports r LEFT JOIN attachments a ON a.report_id = r.id GROUP BY r.id ORDER BY r.updated_at DESC LIMIT 100`).all();
  return Response.json({ reports: result.results });
}

export async function POST(request: Request) {
  const user = await getChatGPTUser(); if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });
  await ensureDatabase(); const data = await request.formData();
  const institution = value(data, 'institution'), functionName = value(data, 'function'), systemPath = value(data, 'path'), description = value(data, 'description');
  const backup = data.get('backup');
  if (!institution || !functionName || !systemPath || !description) return Response.json({ error: 'Campos obrigatórios ausentes' }, { status: 400 });
  if (!(backup instanceof File) || backup.size === 0 || (!backup.name.toLowerCase().endsWith('.csv') && backup.type !== 'text/csv')) return Response.json({ error: 'A cópia de segurança CSV é obrigatória' }, { status: 400 });
  if (backup.size > MAX_FILE_BYTES) return Response.json({ error: 'O CSV excede 10 MB' }, { status: 413 });
  const screenshots = data.getAll('screenshots').filter((item): item is File => item instanceof File && item.size > 0);
  if (screenshots.some((file) => !IMAGE_TYPES.has(file.type) || file.size > MAX_FILE_BYTES)) return Response.json({ error: 'Print inválido ou maior que 10 MB' }, { status: 400 });
  const now = Date.now(), id = `BUG-${new Date(now).getFullYear()}-${String(now).slice(-5)}`, storedKeys: string[] = [];
  try {
    const files = [{ file: backup, kind: 'backup' }, ...screenshots.map((file) => ({ file, kind: 'screenshot' }))];
    const rows: Array<{ id: string; key: string; file: File; kind: string }> = [];
    for (const { file, kind } of files) { const attachmentId = crypto.randomUUID(), key = `reports/${id}/${attachmentId}-${safeName(file.name)}`; await env.FILES.put(key, file.stream(), { httpMetadata: { contentType: file.type || 'application/octet-stream' } }); storedKeys.push(key); rows.push({ id: attachmentId, key, file, kind }); }
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO reports (id,institution,city,copy_number,inep,client_name,phone,function_name,version,system_path,description,school_year,urgent,beta_status,workaround,status,author_id,author_email,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id, institution, value(data,'city'), value(data,'copy'), value(data,'inep'), value(data,'clientName'), value(data,'phone'), functionName, value(data,'version'), systemPath, description, value(data,'schoolYear'), value(data,'urgent') === 'yes' ? 1 : 0, value(data,'beta') || 'Não testado', value(data,'workaround'), 'Novo report', user.userId, user.email, now, now),
      env.DB.prepare('INSERT INTO activities (id,report_id,actor_id,actor_email,action,message,created_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, user.userId, user.email, 'report_created', 'Report criado e enviado ao Desenvolvimento.', now),
      ...rows.map((row) => env.DB.prepare('INSERT INTO attachments (id,report_id,object_key,file_name,content_type,byte_size,kind,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(row.id, id, row.key, row.file.name, row.file.type || 'application/octet-stream', row.file.size, row.kind, now)),
    ]);
    return Response.json({ id }, { status: 201 });
  } catch (error) { await Promise.all(storedKeys.map((key) => env.FILES.delete(key))); console.error(error); return Response.json({ error: 'Falha ao salvar o report' }, { status: 500 }); }
}
function value(data: FormData, name: string) { const item = data.get(name); return typeof item === 'string' ? item.trim() : ''; }
function safeName(name: string) { return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(0, 120); }
