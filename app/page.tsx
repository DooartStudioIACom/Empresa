'use client';

import { useState, type FormEvent } from 'react';
import { AlertTriangle, Bell, Bug, CalendarDays, Check, ChevronRight, CircleCheck, Clock3, FileArchive, FileImage, FlaskConical, LayoutDashboard, ListChecks, LoaderCircle, MessageSquareText, MoreHorizontal, Paperclip, Plus, Search, UploadCloud, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const reports = [
  { id: 'BUG-2026-014', title: 'Integração SEED-PR', client: 'Colégio Estadual Ivo Leão', copy: '109279', version: 'U+ 009/26', status: 'Novo report', tone: 'red', owner: 'JD', updated: 'há 18 min', attachments: 2 },
  { id: 'TST-2026-009-03', title: 'Super Revisor — validação geral', client: 'Rodada interna de testes', copy: 'Horários grandes', version: 'U+ 009/26', status: 'Em teste', tone: 'blue', owner: 'BL', updated: 'há 42 min', attachments: 1 },
  { id: 'BUG-2026-012', title: 'Perfis de acesso — acesso total', client: 'Rodada interna de testes', copy: 'Gerenciar usuários', version: 'U+ 009/26', status: 'Aguardando reteste', tone: 'amber', owner: 'GM', updated: 'ontem, 17:46', attachments: 3 },
  { id: 'BUG-2026-008', title: 'Aviso de salas disponíveis', client: 'Controles · Recursos', copy: 'Validação do aviso', version: 'U+ 008/26', status: 'Corrigido', tone: 'green', owner: 'LS', updated: '30 jul, 14:20', attachments: 2 },
];

const stats = [
  { label: 'Novos reports', value: '3', note: '1 urgente', icon: AlertTriangle, tone: 'red' },
  { label: 'Em andamento', value: '7', note: '2 com DEV', icon: Clock3, tone: 'blue' },
  { label: 'Para retestar', value: '4', note: 'aguardando equipe', icon: FlaskConical, tone: 'amber' },
  { label: 'Corrigidos', value: '18', note: 'neste ciclo', icon: CircleCheck, tone: 'green' },
];

const nav = [
  { label: 'Visão geral', icon: LayoutDashboard, active: true },
  { label: 'Reports', icon: Bug },
  { label: 'Rodadas de testes', icon: ListChecks },
  { label: 'Versões', icon: FileArchive },
  { label: 'Equipe', icon: Users },
];

export default function Home() {
  const [reportItems, setReportItems] = useState(reports);
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<(typeof reports)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const response = await fetch('/api/reports', { method: 'POST', body: data });
      if (!response.ok) throw new Error('Não foi possível registrar o report.');
      const created = await response.json() as { id: string };
      setReportItems((current) => [{
        id: created.id,
        title: String(data.get('function') || 'Novo report'),
        client: String(data.get('institution') || 'Cliente não informado'),
        copy: String(data.get('copy') || 'Sem cópia'),
        version: String(data.get('version') || 'Sem versão'),
        status: 'Novo report', tone: 'red', owner: 'BD', updated: 'agora',
        attachments: 1 + (data.getAll('screenshots').filter((file) => file instanceof File && file.size > 0).length),
      }, ...current]);
      setSaved(true);
      form.reset();
      window.setTimeout(() => { setNewReportOpen(false); setSaved(false); }, 900);
    } catch {
      alert('Não foi possível salvar o report. Confira o CSV e tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-[#16231d]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col border-r border-[#dce5df] bg-[#10271d] text-white lg:flex">
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <div className="grid size-9 place-items-center rounded-xl bg-[#d7ff66] text-[#163220]"><Bug className="size-5" strokeWidth={2.5} /></div>
          <div><p className="text-[15px] font-semibold tracking-tight">GEHA Resolve</p><p className="text-[11px] text-white/48">Qualidade & produto</p></div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6" aria-label="Navegação principal">
          {nav.map((item) => { const Icon = item.icon; return (
            <button key={item.label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${item.active ? 'bg-white/12 font-medium text-white' : 'text-white/60 hover:bg-white/7 hover:text-white'}`}>
              <Icon className="size-[17px]" />{item.label}
            </button>
          ); })}
        </nav>
        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#d7ff66]">Rodada ativa</p><p className="mt-2 text-sm font-semibold">Testes U+ — 009/26</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[62%] rounded-full bg-[#d7ff66]" /></div>
          <div className="mt-2 flex justify-between text-[11px] text-white/50"><span>5 itens</span><span>62%</span></div>
        </div>
        <button className="flex items-center gap-3 border-t border-white/10 px-5 py-5 text-left">
          <span className="grid size-8 place-items-center rounded-full bg-[#e7b68d] text-xs font-semibold text-[#4a2a14]">BD</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">Brian Duarte</span><span className="block text-[10px] text-white/45">Qualidade</span></span><MoreHorizontal className="size-4 text-white/40" />
        </button>
      </aside>

      <main className="lg:ml-[238px]">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-[#dce5df] bg-[#f4f7f5]/90 px-5 backdrop-blur-xl sm:px-8">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607168]">Segunda-feira, 3 de agosto</p><h1 className="mt-1 text-xl font-semibold tracking-[-0.025em]">Bom dia, Brian</h1></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Notificações" className="relative size-9 rounded-xl bg-white"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef6a5b] ring-2 ring-white" /></Button>
            <Button onClick={() => setNewReportOpen(true)} className="h-9 rounded-xl bg-[#173e2c] px-4 text-white shadow-sm hover:bg-[#24573f]"><Plus className="size-4" /> Novo report</Button>
          </div>
        </header>

        <div className="mx-auto max-w-[1420px] px-5 py-7 sm:px-8">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos chamados">
            {stats.map((stat) => { const Icon = stat.icon; return (
              <article key={stat.label} className="rounded-2xl border border-[#dce5df] bg-white p-4 shadow-[0_1px_2px_rgb(16_39_29/3%)]">
                <div className="flex items-start justify-between"><div><p className="text-xs font-medium text-[#64736b]">{stat.label}</p><p className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.04em]">{stat.value}</p></div><span className={`stat-icon stat-${stat.tone}`}><Icon className="size-[17px]" /></span></div>
                <p className="mt-3 text-[11px] text-[#7b8981]">{stat.note}</p>
              </article>
            ); })}
          </section>

          <section className="mt-7 overflow-hidden rounded-2xl border border-[#dce5df] bg-white shadow-[0_3px_16px_rgb(16_39_29/4%)]">
            <div className="flex flex-col gap-4 border-b border-[#e4ebe7] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 className="text-[15px] font-semibold">Atividade recente</h2><p className="mt-1 text-xs text-[#718078]">Reports e testes que precisam da sua atenção</p></div>
              <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1 sm:w-[230px]"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input aria-label="Buscar reports" placeholder="Buscar report..." className="h-9 rounded-xl border-[#dce5df] bg-[#f8faf9] pl-8" /></div><Button variant="outline" className="h-9 rounded-xl bg-white text-xs">Todos os status</Button></div>
            </div>
            <div className="divide-y divide-[#e9eeeb]">
              {reportItems.map((report) => (
                <button onClick={() => setSelectedReport(report)} key={report.id} className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-[#f8faf9] md:grid-cols-[minmax(270px,1.45fr)_minmax(140px,.7fr)_130px_110px_24px]">
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-[#7b8981]">{report.id}</span>{report.id === 'BUG-2026-014' && <Badge className="h-[18px] bg-[#fff0ed] px-1.5 text-[9px] font-semibold text-[#b64738]">URGENTE</Badge>}</div><p className="mt-1 truncate text-[13px] font-semibold text-[#1d2e25]">{report.title}</p><p className="mt-1 truncate text-[11px] text-[#75847c]">{report.client} · {report.copy}</p></div>
                  <div className="hidden md:block"><p className="text-[11px] font-medium text-[#3f5148]">{report.version}</p><div className="mt-1 flex items-center gap-1 text-[10px] text-[#849088]"><Paperclip className="size-3" />{report.attachments} anexos</div></div>
                  <div className="hidden md:block"><span className={`status status-${report.tone}`}><span />{report.status}</span></div>
                  <div className="flex items-center justify-end gap-2 md:justify-start"><span className="grid size-7 place-items-center rounded-full bg-[#e6ece8] text-[9px] font-semibold text-[#385144]">{report.owner}</span><span className="hidden text-[10px] text-[#849088] xl:block">{report.updated}</span></div>
                  <ChevronRight className="hidden size-4 text-[#a1ada6] transition group-hover:translate-x-0.5 group-hover:text-[#426653] md:block" />
                </button>
              ))}
            </div>
            <div className="border-t border-[#e4ebe7] bg-[#fafcfb] px-5 py-3 text-center"><button className="text-[11px] font-semibold text-[#386349] hover:text-[#173e2c]">Ver todos os reports</button></div>
          </section>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <section className="rounded-2xl border border-[#dce5df] bg-white p-5">
              <div className="flex items-center justify-between"><div><h2 className="text-[15px] font-semibold">Testes U+ — 009/26</h2><p className="mt-1 text-xs text-[#718078]">Prazo: sexta-feira, 07/08</p></div><Badge variant="outline" className="border-[#b9d1c3] bg-[#f3faf5] text-[#306043]"><CalendarDays /> Em andamento</Badge></div>
              <div className="mt-5 grid grid-cols-5 gap-1.5" aria-label="Progresso: três de cinco itens concluídos">{[true, true, true, false, false].map((done, index) => <span key={index} className={`h-2 rounded-full ${done ? 'bg-[#3e8a5e]' : 'bg-[#e4eae6]'}`} />)}</div>
              <div className="mt-3 flex justify-between text-[11px] text-[#718078]"><span>3 de 5 itens concluídos</span><span className="font-semibold text-[#3e5b4b]">60%</span></div>
            </section>
            <section className="rounded-2xl border border-[#dce5df] bg-[#173e2c] p-5 text-white"><FileArchive className="size-5 text-[#d7ff66]" /><h2 className="mt-4 text-[15px] font-semibold">Backup obrigatório</h2><p className="mt-1.5 text-xs leading-5 text-white/60">Todo novo report exige uma cópia de segurança em formato CSV.</p></section>
          </div>
        </div>
      </main>

      <Dialog open={newReportOpen} onOpenChange={setNewReportOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          <form onSubmit={createReport}>
            <DialogHeader className="border-b border-[#e4ebe7] px-6 py-5">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#246142]"><Bug className="size-4" /></span><div><DialogTitle className="text-lg">Novo report técnico</DialogTitle><DialogDescription className="mt-1">Registre o problema com os dados necessários para o Desenvolvimento.</DialogDescription></div></div>
            </DialogHeader>
            <div className="space-y-6 px-6 py-5">
              <FormSection title="Dados do cliente" description="Preencha quando o problema estiver ligado a uma instituição.">
                <Field label="Instituição"><Input name="institution" required placeholder="Ex.: Colégio Estadual Ivo Leão" /></Field>
                <div className="grid gap-4 sm:grid-cols-3"><Field label="Cidade/UF"><Input name="city" placeholder="Curitiba/PR" /></Field><Field label="Cópia"><Input name="copy" placeholder="109279" /></Field><Field label="INEP"><Input name="inep" placeholder="41129970" /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do cliente"><Input name="clientName" /></Field><Field label="Telefone"><Input name="phone" /></Field></div>
              </FormSection>
              <FormSection title="Diagnóstico" description="Informe exatamente onde e como o erro acontece.">
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Função"><Input name="function" required placeholder="Integração SEED-PR" /></Field><Field label="Versão / rodada"><Input name="version" placeholder="U+ 009/26" /></Field></div>
                <Field label="Caminho no sistema"><Input name="path" required placeholder="Sua Conta > Integração > SEED-PR" /></Field>
                <Field label="Descrição do erro"><Textarea name="description" required className="min-h-28" placeholder="Descreva o que foi feito, o resultado encontrado e a mensagem exibida..." /></Field>
                <div className="grid gap-4 sm:grid-cols-3"><Field label="Ano letivo"><Input name="schoolYear" placeholder="2026" /></Field><Field label="Urgência"><select name="urgent" className="form-select"><option value="yes">Sim</option><option value="no">Não</option></select></Field><Field label="Ocorre no beta?"><select name="beta" className="form-select"><option>Não testado</option><option>Sim</option><option>Não</option></select></Field></div>
                <Field label="Contorno encontrado"><Textarea name="workaround" placeholder="Não consegui fazer a reversão." /></Field>
              </FormSection>
              <FormSection title="Anexos" description="A cópia de segurança CSV é obrigatória. Adicione também prints que ajudem o diagnóstico.">
                <label className="upload-zone border-[#d5e2da] bg-[#f8fbf9]"><UploadCloud className="size-5 text-[#3b7755]" /><span><strong>Cópia de segurança (.csv) *</strong><small>Arquivo obrigatório para enviar o report</small></span><Input name="backup" type="file" accept=".csv,text/csv" required className="file-input" /></label>
                <label className="upload-zone"><FileImage className="size-5 text-[#6b7d73]" /><span><strong>Prints do erro</strong><small>PNG, JPG ou WEBP · você pode selecionar vários</small></span><Input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple className="file-input" /></label>
              </FormSection>
              <label className="flex items-start gap-3 rounded-xl border border-[#dfe8e2] bg-[#f8fbf9] p-4 text-xs leading-5 text-[#52655a]"><input required type="checkbox" className="mt-1 accent-[#296444]" /><span>Confirmo que anexei a cópia de segurança e incluí as informações necessárias para reproduzir o problema.</span></label>
            </div>
            <DialogFooter className="mx-0 mb-0 px-6"><Button type="button" variant="outline" onClick={() => setNewReportOpen(false)}>Cancelar</Button><Button disabled={saving || saved} className="bg-[#173e2c] text-white hover:bg-[#24573f]">{saving ? <><LoaderCircle className="animate-spin" /> Salvando...</> : saved ? <><Check /> Report criado</> : 'Enviar para Desenvolvimento'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          {selectedReport && <>
            <DialogHeader className="border-b border-[#e4ebe7] px-6 py-5">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] font-semibold text-[#75847c]">{selectedReport.id}</span><span className={`status status-${selectedReport.tone}`}><span />{selectedReport.status}</span></div>
              <DialogTitle className="mt-2 text-xl">{selectedReport.title}</DialogTitle><DialogDescription>{selectedReport.client} · Cópia {selectedReport.copy} · {selectedReport.version}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 px-6 py-5 md:grid-cols-[1fr_220px]">
              <div className="space-y-5">
                <div><p className="detail-label">Descrição do erro</p><p className="mt-2 text-sm leading-6 text-[#3d4e45]">Cliente tenta realizar a exportação para o RCO com todos os turnos e o sistema apresenta uma mensagem de erro, impedindo a conclusão.</p></div>
                <div><p className="detail-label">Caminho</p><p className="mt-2 rounded-lg bg-[#f4f7f5] px-3 py-2 font-mono text-xs text-[#405449]">Sua Conta › Integração › Integração com a SEED-PR (RCO)</p></div>
                <div><p className="detail-label">Linha do tempo</p><div className="mt-3 space-y-4 border-l border-[#dce5df] pl-5">
                  <Timeline name="Jhoni Duarte" role="Suporte" time="Hoje, 16:35" text="Reportou o problema e anexou a cópia de segurança e o print do erro." />
                  {selectedReport.status === 'Aguardando reteste' && <Timeline name="George Martins" role="Desenvolvimento" time="Hoje, 17:46" text="Fiz alterações referentes ao bug. Testem para verificar se foi corrigido." highlighted />}
                </div></div>
                <div className="rounded-xl border border-[#dce5df] p-3"><Textarea placeholder="Escreva uma resposta ou o resultado do reteste..." className="min-h-20 border-0 p-1 shadow-none focus-visible:ring-0" /><div className="mt-2 flex justify-between border-t border-[#edf1ef] pt-3"><Button variant="ghost" size="sm"><Paperclip /> Anexar</Button><Button size="sm" className="bg-[#173e2c] text-white"><MessageSquareText /> Responder</Button></div></div>
              </div>
              <aside className="space-y-4"><InfoCard label="Responsável" value="Desenvolvimento" /><InfoCard label="Urgência" value={selectedReport.id === 'BUG-2026-014' ? 'Sim — cliente bloqueado' : 'Normal'} /><InfoCard label="Ambiente beta" value="Não testado" /><div><p className="detail-label">Anexos</p><div className="mt-2 space-y-2"><Attachment name="backup-109279.csv" size="2,4 MB" csv /><Attachment name="erro-rco.png" size="184 KB" /></div></div></aside>
            </div>
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="space-y-4"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[#78867e]">{description}</p></div>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-xs font-medium text-[#43564b]"><span>{label}</span>{children}</label>; }
function Timeline({ name, role, time, text, highlighted = false }: { name: string; role: string; time: string; text: string; highlighted?: boolean }) { return <div className="relative"><span className={`absolute -left-[25px] top-1 size-2 rounded-full ring-4 ring-white ${highlighted ? 'bg-[#d79a27]' : 'bg-[#4b8b65]'}`} /><div className={highlighted ? 'rounded-xl border border-[#f0d69d] bg-[#fff9ed] p-3' : ''}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">{name} <span className="font-normal text-[#849088]">· {role}</span></p><time className="text-[10px] text-[#8a968f]">{time}</time></div><p className="mt-1.5 text-xs leading-5 text-[#596960]">{text}</p></div></div>; }
function InfoCard({ label, value }: { label: string; value: string }) { return <div><p className="detail-label">{label}</p><p className="mt-1.5 text-xs font-medium text-[#405248]">{value}</p></div>; }
function Attachment({ name, size, csv = false }: { name: string; size: string; csv?: boolean }) { return <button className="flex w-full items-center gap-2 rounded-lg border border-[#e1e8e4] p-2 text-left hover:bg-[#f7faf8]"><span className={`grid size-8 place-items-center rounded-lg ${csv ? 'bg-[#eaf5ed] text-[#347850]' : 'bg-[#eef3f9] text-[#4b7097]'}`}>{csv ? <FileArchive className="size-4" /> : <FileImage className="size-4" />}</span><span className="min-w-0"><span className="block truncate text-[10px] font-semibold">{name}</span><span className="block text-[9px] text-[#8b978f]">{size}</span></span></button>; }
function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) { if (!open) return null; return <div className="fixed inset-0 z-50 grid place-items-center p-4"><button type="button" aria-label="Fechar janela" className="absolute inset-0 bg-[#0d1f17]/35 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} /><div className="relative z-10 contents">{children}</div></div>; }
function DialogContent({ className = '', children }: { className?: string; children: React.ReactNode }) { return <div role="dialog" aria-modal="true" className={`relative w-full rounded-2xl bg-white text-[#16231d] shadow-[0_25px_80px_rgb(5_20_12/28%)] ring-1 ring-black/5 ${className}`}>{children}</div>; }
function DialogHeader({ className = '', children }: { className?: string; children: React.ReactNode }) { return <div className={className}>{children}</div>; }
function DialogTitle({ className = '', children }: { className?: string; children: React.ReactNode }) { return <h2 className={`font-semibold tracking-[-0.02em] ${className}`}>{children}</h2>; }
function DialogDescription({ className = '', children }: { className?: string; children: React.ReactNode }) { return <p className={`text-sm text-[#718078] ${className}`}>{children}</p>; }
function DialogFooter({ className = '', children }: { className?: string; children: React.ReactNode }) { return <div className={`flex flex-col-reverse gap-2 border-t border-[#e4ebe7] bg-[#f8faf9] py-4 sm:flex-row sm:justify-end ${className}`}>{children}</div>; }
