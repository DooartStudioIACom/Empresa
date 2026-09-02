import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getChatGPTUser(); if (!user) return new Response('Não autenticado', { status: 401 });
  await ensureDatabase(); const { id } = await params;
  const row = await env.DB.prepare('SELECT object_key, file_name, content_type FROM attachments WHERE id = ?').bind(id).first<{ object_key: string; file_name: string; content_type: string }>();
  if (!row) return new Response('Anexo não encontrado', { status: 404 });
  const object = await env.FILES.get(row.object_key, 'arrayBuffer'); if (!object) return new Response('Arquivo não encontrado', { status: 404 });
  const headers = new Headers(); headers.set('content-type', row.content_type); headers.set('content-disposition', `attachment; filename="${row.file_name.replace(/["\r\n]/g, '')}"`); headers.set('cache-control', 'private, no-store');
  return new Response(object, { headers });
}
