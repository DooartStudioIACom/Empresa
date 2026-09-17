import { env } from 'cloudflare:workers';
import { ensureDatabase } from '@/lib/db-init';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  await ensureDatabase();
  const { token } = await params;
  if (!/^[a-f0-9]{32}$/i.test(token)) return new Response('Imagem não encontrada', { status: 404 });
  const file = await env.DB.prepare("SELECT object_key,content_type,file_name FROM attachments WHERE github_share_token=? AND kind IN ('inline','screenshot')").bind(token).first<{ object_key: string; content_type: string; file_name: string }>();
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.content_type)) return new Response('Imagem não encontrada', { status: 404 });
  const object = await env.FILES.get(file.object_key, 'arrayBuffer');
  if (!object) return new Response('Imagem não encontrada', { status: 404 });
  return new Response(object, { headers: { 'content-type': file.content_type, 'content-disposition': `inline; filename="${file.file_name.replace(/["\r\n]/g, '')}"`, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
}
