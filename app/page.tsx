'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Activity, AlertTriangle, Bell, Bug, Building2, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, CircleCheck, Clock3, Code2, FileArchive, FileImage, FlaskConical, LayoutDashboard, ListChecks, LoaderCircle, MessageSquareText, MoreHorizontal, PackageCheck, Paperclip, PlayCircle, Plus, Search, Share2, ShieldCheck, Sparkles, UploadCloud, UserPlus, Users, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ReportItem = { id: string; title: string; client: string; copy: string; version: string; status: string; tone: string; owner: string; updated: string; attachments: number; urgent?: boolean; canEdit?: boolean; isOwner?: boolean };
const initialReports: ReportItem[] = [];
type ReportDetail = {
  report: Record<string, string | number | null>;
  attachments: Array<{ id: string; file_name: string; content_type: string; byte_size: number; kind: string; created_at: number }>;
  activities: Array<{ id: string; actor_email: string; action: string; message: string | null; created_at: number }>;
  permissions?: { isOwner: boolean; canEdit: boolean };
  shares?: Array<{ user_email: string; permission: string; created_at: number }>;
};
type ReportEditorBlock = { key: number; type: 'text'; value: string } | { key: number; type: 'image'; file: File; preview: string; caption: string };
type TestRoundItem = { id: string; round_id: string; position: number; title: string; path: string | null; description: string | null; status: string; tester_email: string | null; tester_name?: string | null; result_note: string | null; updated_at: number; response_updated_at?: number | null };
type RoundParticipant = { round_id: string; user_id: string; user_email: string; user_name: string; total_items: number; done_items: number; bug_items: number; progress: number; completed_at: number | null; is_current: boolean };
type TestRound = { id: string; title: string; version: string; deadline: string; description: string | null; status: string; author_email: string; created_at: number; updated_at: number; items: TestRoundItem[]; participants?: RoundParticipant[] };

const qualityTips = [
  'Antes de reportar, registre o caminho exato e tente repetir o erro uma segunda vez.',
  'Ao retestar, confira também o fluxo vizinho: uma correção pode afetar telas relacionadas.',
  'Prints com contexto e uma cópia atualizada reduzem o tempo de análise do Desenvolvimento.',
];

const nav = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'reports', label: 'Reports', icon: Bug },
  { id: 'rounds', label: 'Rodadas de testes', icon: ListChecks },
  { id: 'versions', label: 'Versões', icon: FileArchive },
  { id: 'team', label: 'Equipe', icon: Users },
] as const;

type SectionId = (typeof nav)[number]['id'];

export default function Home() {
  const [reportItems, setReportItems] = useState<ReportItem[]>(initialReports);
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ displayName: string; email: string } | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [hasBackup, setHasBackup] = useState(true);
  const [hasAttachments, setHasAttachments] = useState(true);
  const [fromTestRound, setFromTestRound] = useState(false);
  const [reportRounds, setReportRounds] = useState<TestRound[]>([]);
  const [linkedRoundId, setLinkedRoundId] = useState('');
  const [linkedItemId, setLinkedItemId] = useState('');
  const [reportBlocks, setReportBlocks] = useState<ReportEditorBlock[]>([{ key: 1, type: 'text', value: '' }]);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyNotice, setReplyNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [reportTab, setReportTab] = useState<'summary' | 'activity' | 'files'>('summary');
  const [formError, setFormError] = useState<string | null>(null);
  const [overviewRound, setOverviewRound] = useState<TestRound | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    fetch('/api/me')
      .then(async (response) => response.ok ? await response.json() as { displayName: string; email: string } : null)
      .then((user) => user && setCurrentUser(user))
      .catch(() => undefined)
      .finally(() => setAuthReady(true));
    const syncDashboard = async () => {
      const [reportResponse, roundResponse] = await Promise.allSettled([fetch('/api/reports'), fetch('/api/rounds')]);
      let synced = false;
      if (reportResponse.status === 'fulfilled' && reportResponse.value.ok) { const payload = await reportResponse.value.json() as { reports?: Array<Record<string, unknown>> }; setReportItems((payload.reports || []).map(apiReportToItem)); synced = true; }
      if (roundResponse.status === 'fulfilled' && roundResponse.value.ok) { const payload = await roundResponse.value.json() as { rounds?: TestRound[] }; const loadedRounds = payload.rounds || []; setReportRounds(loadedRounds); setOverviewRound(loadedRounds.find((round) => round.status === 'Em andamento') || loadedRounds[0] || null); synced = true; }
      if (synced) setLastSync(new Date());
    };
    void syncDashboard();
    const syncTimer = window.setInterval(syncDashboard, 15000);
    const tipTimer = window.setInterval(() => setTipIndex((current) => (current + 1) % qualityTips.length), 7000);
    return () => { window.clearInterval(syncTimer); window.clearInterval(tipTimer); };
  }, []);

  useEffect(() => {
    if (!newReportOpen) return;
    fetch('/api/rounds').then(async (response) => response.ok ? await response.json() as { rounds?: TestRound[] } : null).then((payload) => payload?.rounds && setReportRounds(payload.rounds)).catch(() => undefined);
  }, [newReportOpen]);

  if (!authReady) return <AccessGate loading />;
  if (!currentUser) return <AccessGate />;

  const userName = friendlyName(currentUser?.displayName, currentUser?.email);
  const userInitials = initials(userName);
  const activeNavItem = nav.find((item) => item.id === activeSection);
  const ActiveHeaderIcon = activeNavItem?.icon || LayoutDashboard;
  const pageTitle = activeSection === 'overview' ? `Olá, ${userName}` : activeNavItem?.label;
  const pageContext = activeSection === 'overview' ? 'Seu espaço de qualidade está pronto' : activeSection === 'reports' ? 'Central de chamados' : activeSection === 'rounds' ? 'Planejamento e execução' : activeSection === 'versions' ? 'Histórico de entregas' : 'Pessoas e responsabilidades';
  const dashboardStats = [
    { label: 'Novos reports', value: String(reportItems.filter((item) => item.status === 'Novo report').length), note: `${reportItems.filter((item) => item.status === 'Novo report' && item.id.startsWith('BUG')).length} aguardando triagem`, icon: AlertTriangle, tone: 'red' },
    { label: 'Em andamento', value: String(reportItems.filter((item) => ['Em análise', 'Em correção', 'Em teste'].includes(item.status)).length), note: 'análise e correção', icon: Clock3, tone: 'blue' },
    { label: 'Para retestar', value: String(reportItems.filter((item) => item.status === 'Aguardando reteste').length), note: 'aguardando qualidade', icon: FlaskConical, tone: 'amber' },
    { label: 'Corrigidos', value: String(reportItems.filter((item) => item.status === 'Corrigido').length), note: 'histórico confirmado', icon: CircleCheck, tone: 'green' },
  ];
  const overviewTested = overviewRound?.items.filter((item) => ['Aprovado', 'Com bug'].includes(item.status)).length || 0;
  const overviewProgress = overviewRound?.items.length ? Math.round((overviewTested / overviewRound.items.length) * 100) : 0;
  const linkedRound = reportRounds.find((round) => round.id === linkedRoundId) || null;

  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFormError(null);
    if (!reportBlocks.some((block) => block.type === 'image' || block.value.trim())) {
      setFormError('Escreva a descrição do erro ou insira uma imagem no texto.');
      return;
    }
    if (!form.checkValidity()) {
      const firstInvalid = form.querySelector<HTMLElement>(':invalid');
      firstInvalid?.focus();
      setFormError('Revise os campos obrigatórios destacados antes de enviar.');
      return;
    }
    setSaving(true);
    setSaved(false);
    const data = new FormData(form);
    let inlineIndex = 0;
    data.set('description', JSON.stringify({ version: 1, blocks: reportBlocks.map((block) => block.type === 'text' ? { type: 'text', value: block.value } : { type: 'image', fileIndex: inlineIndex++, caption: block.caption, fileName: block.file.name }) }));
    reportBlocks.forEach((block) => { if (block.type === 'image') data.append('inlineImages', block.file); });
    try {
      const response = await fetch('/api/reports', { method: 'POST', body: data });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({ error: 'Não foi possível registrar o report.' })) as { error?: string };
        throw new Error(failure.error || 'Não foi possível registrar o report.');
      }
      const created = await response.json() as { id: string };
      setReportItems((current) => [{
        id: created.id,
        title: String(data.get('function') || 'Novo report'),
        client: String(data.get('institution') || 'Cliente não informado'),
        copy: String(data.get('copy') || 'Sem cópia'),
        version: String(data.get('version') || 'Sem versão'),
        status: 'Novo report', tone: 'red', owner: userInitials, updated: 'agora',
        attachments: (hasBackup ? 1 : 0) + (hasAttachments ? data.getAll('screenshots').filter((file) => file instanceof File && file.size > 0).length : 0) + data.getAll('inlineImages').filter((file) => file instanceof File && file.size > 0).length,
        canEdit: true, isOwner: true,
      }, ...current]);
      setSaved(true);
      form.reset();
      setHasBackup(true);
      setHasAttachments(true);
      setFromTestRound(false);
      setLinkedRoundId('');
      setLinkedItemId('');
      reportBlocks.forEach((block) => { if (block.type === 'image') URL.revokeObjectURL(block.preview); });
      setReportBlocks([{ key: Date.now(), type: 'text', value: '' }]);
      window.setTimeout(() => { setNewReportOpen(false); setSaved(false); }, 900);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Não foi possível salvar o report. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  async function openReport(report: ReportItem) {
    setSelectedReport(report);
    setReportTab('summary');
    setReportDetail(null);
    setReplyNotice(null);
    setShareNotice(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}`);
      if (response.ok) setReportDetail(await response.json());
    } finally {
      setDetailLoading(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReport) return;
    setReplyNotice(null);
    setReplying(true);
    const form = event.currentTarget;
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}`, { method: 'POST', body: new FormData(form) });
      if (!response.ok) {
        const failure = await response.json().catch(() => ({ error: 'Não foi possível enviar a resposta.' })) as { error?: string };
        throw new Error(failure.error || 'Não foi possível enviar a resposta.');
      }
      const payload = await response.json() as { status: string };
      setReportItems((items) => items.map((item) => item.id === selectedReport.id ? { ...item, status: payload.status, tone: statusTone(payload.status), updated: 'agora' } : item));
      setSelectedReport((current) => current ? { ...current, status: payload.status, tone: statusTone(payload.status), updated: 'agora' } : current);
      form.reset();
      const detailResponse = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}`);
      if (detailResponse.ok) setReportDetail(await detailResponse.json());
      setReplyNotice({ tone: 'success', message: `Resposta registrada. Status atual: ${payload.status}.` });
    } catch (error) {
      setReplyNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível enviar a resposta. Tente novamente.' });
    } finally {
      setReplying(false);
    }
  }

  async function updateShare(email: string, action: 'add' | 'remove' = 'add') {
    if (!selectedReport) return;
    setSharing(true); setShareNotice(null);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}/share`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, action }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível alterar o compartilhamento.');
      const detailResponse = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}`);
      if (detailResponse.ok) setReportDetail(await detailResponse.json());
      setShareNotice({ tone: 'success', message: action === 'remove' ? 'Permissão removida.' : 'Edição compartilhada com sucesso.' });
    } catch (error) { setShareNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível compartilhar.' }); }
    finally { setSharing(false); }
  }

  async function shareReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), email = String(data.get('shareEmail') || '').trim();
    await updateShare(email);
    if (email) form.reset();
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
            <button onClick={() => setActiveSection(item.id)} key={item.label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${activeSection === item.id ? 'bg-white/12 font-medium text-white' : 'text-white/60 hover:bg-white/7 hover:text-white'}`}>
              <Icon className="size-[17px]" />{item.label}
            </button>
          ); })}
        </nav>
        <div className="mx-3 mb-3 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#d7ff66]">Rodada ativa</p><p className="mt-2 text-sm font-semibold">{overviewRound?.title || 'Nenhuma rodada criada'}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div style={{ width: `${overviewProgress}%` }} className="h-full rounded-full bg-[#d7ff66] transition-all" /></div>
          <div className="mt-2 flex justify-between text-[11px] text-white/50"><span>{overviewRound?.items.length || 0} itens</span><span>{overviewProgress}%</span></div>
        </div>
        <button className="flex items-center gap-3 border-t border-white/10 px-5 py-5 text-left">
          <span className="grid size-8 place-items-center rounded-full bg-[#e7b68d] text-xs font-semibold text-[#4a2a14]">{userInitials}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{currentUser?.displayName || 'Usuário conectado'}</span><span className="block text-[10px] text-white/45">Membro da equipe</span></span><MoreHorizontal className="size-4 text-white/40" />
        </button>
      </aside>

      <main className="lg:ml-[238px]">
        <header className="sticky top-0 z-10 border-b border-[#dbe5df] bg-[#f4f7f5]/95 px-3 py-2.5 backdrop-blur-xl sm:px-5">
          <div className="relative isolate flex min-h-[76px] w-full items-center justify-between overflow-hidden rounded-[22px] border border-[#c8d8ce] bg-[linear-gradient(105deg,#fdfefd_0%,#f4f9f5_44%,#e8f2eb_100%)] px-4 shadow-[inset_0_1px_0_white,0_12px_34px_-28px_#173e2c] sm:px-5">
            <div className="pointer-events-none absolute inset-[4px] rounded-[17px] border border-white/75" />
            <div className="pointer-events-none absolute inset-y-0 right-[145px] hidden w-[500px] opacity-[.22] lg:block"><img src="/header/quality-flow.png" alt="" aria-hidden="true" className="h-full w-full object-contain object-right" /></div>
            <div className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[linear-gradient(180deg,#173e2c,#7daf88,#d7ff66)]" />
            <div className="relative z-[1] flex min-w-0 items-center gap-3.5">
              <span className="grid size-11 shrink-0 place-items-center rounded-[15px] bg-[#173e2c] text-[#d7ff66] shadow-[0_10px_24px_-17px_#173e2c] ring-1 ring-white/70"><ActiveHeaderIcon className="size-[18px]" /></span>
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[9px] font-bold uppercase tracking-[0.17em] text-[#477058]">GEHA Resolve</p><span className="size-1 rounded-full bg-[#9ab2a2]" /><p className="hidden truncate text-[9px] font-semibold uppercase tracking-[.1em] text-[#7f9187] sm:block">{pageContext}</p></div><h1 className="mt-1 truncate text-[19px] font-semibold tracking-[-0.03em] text-[#1b3025]">{pageTitle}</h1></div>
            </div>
            <div className="relative z-[2] ml-4 flex shrink-0 items-center gap-2 border-l border-[#cddbd2] pl-3 sm:pl-4">
              <Button variant="outline" size="icon" aria-label="Notificações" className="relative size-9 rounded-xl border-[#d5e0d9] bg-white/90 shadow-sm hover:bg-white"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef6a5b] ring-2 ring-white" /></Button>
              <Button onClick={() => setNewReportOpen(true)} className="h-9 rounded-xl bg-[#173e2c] px-3.5 text-white shadow-[0_8px_20px_-14px_#173e2c] hover:bg-[#24573f] sm:px-4"><Plus className="size-4" /><span className="hidden sm:inline">Novo report</span><span className="sm:hidden">Report</span></Button>
            </div>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-[#dce5df] bg-white px-4 py-2 lg:hidden" aria-label="Navegação principal móvel">
          {nav.map((item) => { const Icon = item.icon; return <button onClick={() => setActiveSection(item.id)} key={item.id} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${activeSection === item.id ? 'bg-[#eaf3ed] text-[#245b3d]' : 'text-[#6f7f76]'}`}><Icon className="size-3.5" />{item.label}</button>; })}
        </nav>

        <div className="mx-auto max-w-[1420px] px-5 py-7 sm:px-8">
          {activeSection === 'overview' ? <>
          <section className="relative mb-5 min-h-[250px] overflow-hidden rounded-[26px] bg-[#0d281c] text-white shadow-[0_20px_55px_rgb(13_40_28/18%)]">
            <img src="/dashboard/quality-hero.png" alt="Ilustração de testes, análise de bugs e entregas" className="absolute inset-0 h-full w-full object-cover object-right opacity-90" />
            <div className="absolute inset-0 bg-[linear-gradient(90deg,#0d281c_0%,#0d281c_f2_38%,#0d281c66_72%,transparent_100%)]" />
            <div className="relative z-[1] flex min-h-[250px] max-w-[690px] flex-col justify-center px-6 py-8 sm:px-9">
              <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-white/80"><span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-[#d7ff66] opacity-60" /><span className="relative inline-flex size-2 rounded-full bg-[#d7ff66]" /></span> Painel ao vivo</span>{lastSync && <span className="text-[10px] text-white/45">Atualizado às {lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}</div>
              <h2 className="mt-5 max-w-lg text-3xl font-semibold leading-[1.08] tracking-[-.045em] sm:text-[38px]">Qualidade em movimento, sem perder nenhum detalhe.</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/62">Reports, testes e correções conectados em um único fluxo para a equipe agir mais rápido.</p>
              <div className="mt-6 flex flex-wrap gap-2"><Button type="button" onClick={() => setNewReportOpen(true)} className="h-10 rounded-xl bg-[#d7ff66] px-4 text-[#173e2c] hover:bg-[#e2ff91]"><Plus /> Registrar problema</Button><Button type="button" onClick={() => setActiveSection('rounds')} variant="outline" className="h-10 rounded-xl border-white/18 bg-white/8 px-4 text-white hover:bg-white/15 hover:text-white"><PlayCircle /> Acompanhar rodada</Button></div>
            </div>
          </section>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos chamados">
            {dashboardStats.map((stat) => { const Icon = stat.icon; return (
              <article key={stat.label} className="group relative overflow-hidden rounded-2xl border border-[#dce5df] bg-white p-4 shadow-[0_4px_18px_rgb(16_39_29/4%)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgb(16_39_29/9%)]">
                <div className={`absolute inset-x-0 top-0 h-1 stat-${stat.tone}`} /><div className="flex items-start justify-between"><div><p className="text-xs font-medium text-[#64736b]">{stat.label}</p><p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.05em]">{stat.value}</p></div><span className={`stat-icon stat-${stat.tone} transition-transform group-hover:scale-110`}><Icon className="size-[17px]" /></span></div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-[#7b8981]"><span className={`size-1.5 rounded-full stat-${stat.tone}`} />{stat.note}</div>
              </article>
            ); })}
          </section>

          <section className="mt-7 overflow-hidden rounded-2xl border border-[#dce5df] bg-white shadow-[0_3px_16px_rgb(16_39_29/4%)]">
            <div className="flex flex-col gap-4 border-b border-[#e4ebe7] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div><div className="flex items-center gap-2"><h2 className="text-[15px] font-semibold">Atividade recente</h2><span className="inline-flex items-center gap-1.5 rounded-full bg-[#edf8f0] px-2 py-1 text-[9px] font-semibold uppercase tracking-wide text-[#347951]"><span className="size-1.5 animate-pulse rounded-full bg-[#42a56d]" /> Tempo real</span></div><p className="mt-1 text-xs text-[#718078]">Reports e testes que precisam da sua atenção</p></div>
              <div className="flex items-center gap-2"><div className="relative min-w-0 flex-1 sm:w-[230px]"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input aria-label="Buscar reports" placeholder="Buscar report..." className="h-9 rounded-xl border-[#dce5df] bg-[#f8faf9] pl-8" /></div><Button variant="outline" className="h-9 rounded-xl bg-white text-xs">Todos os status</Button></div>
            </div>
            <div className="divide-y divide-[#e9eeeb]">
              {reportItems.map((report) => (
                <button onClick={() => openReport(report)} key={report.id} className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left transition hover:bg-[#f8faf9] md:grid-cols-[minmax(270px,1.45fr)_minmax(140px,.7fr)_130px_110px_24px]">
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-[#7b8981]">{report.id}</span>{report.urgent && <Badge className="h-[18px] bg-[#fff0ed] px-1.5 text-[9px] font-semibold text-[#b64738]">URGENTE</Badge>}</div><p className="mt-1 truncate text-[13px] font-semibold text-[#1d2e25]">{report.title}</p><p className="mt-1 truncate text-[11px] text-[#75847c]">{report.client} · {report.copy}</p></div>
                  <div className="hidden md:block"><p className="text-[11px] font-medium text-[#3f5148]">{report.version}</p><div className="mt-1 flex items-center gap-1 text-[10px] text-[#849088]"><Paperclip className="size-3" />{report.attachments} anexos</div></div>
                  <div className="hidden md:block"><span className={`status status-${report.tone}`}><span />{report.status}</span></div>
                  <div className="flex items-center justify-end gap-2 md:justify-start"><span className="grid size-7 place-items-center rounded-full bg-[#e6ece8] text-[9px] font-semibold text-[#385144]">{report.owner}</span><span className="hidden text-[10px] text-[#849088] xl:block">{report.updated}</span></div>
                  <ChevronRight className="hidden size-4 text-[#a1ada6] transition group-hover:translate-x-0.5 group-hover:text-[#426653] md:block" />
                </button>
              ))}
              {reportItems.length === 0 && <div className="px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef5f0] text-[#397657]"><Sparkles className="size-5" /></span><p className="mt-4 text-sm font-semibold text-[#263a2f]">Tudo pronto para começar</p><p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[#7a8880]">Ainda não há atividade. O primeiro report ou a primeira rodada aparecerá aqui para toda a equipe.</p></div>}
            </div>
            <div className="border-t border-[#e4ebe7] bg-[#fafcfb] px-5 py-3 text-center"><button onClick={() => setActiveSection('reports')} className="text-[11px] font-semibold text-[#386349] hover:text-[#173e2c]">Ver todos os reports</button></div>
          </section>

          <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
            <section className="group rounded-2xl border border-[#dce5df] bg-white p-5 shadow-[0_4px_18px_rgb(16_39_29/4%)]">
              <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><ListChecks className="size-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#56806a]">Rodada ativa</p><h2 className="mt-1 text-[15px] font-semibold">{overviewRound?.title || 'Nenhuma rodada ativa'}</h2></div></div><p className="mt-3 text-xs text-[#718078]">{overviewRound ? `${overviewRound.version} · prazo ${formatRoundDate(overviewRound.deadline)}` : 'Crie uma rodada para começar o acompanhamento.'}</p></div><Badge variant="outline" className="border-[#b9d1c3] bg-[#f3faf5] text-[#306043]"><CalendarDays /> {overviewRound?.status || 'Aguardando'}</Badge></div>
              <div className="mt-5 h-2.5 overflow-hidden rounded-full bg-[#e8eee9]"><div style={{ width: `${overviewProgress}%` }} className="h-full rounded-full bg-[linear-gradient(90deg,#347951,#d7ff66)] transition-all duration-700" /></div>
              <div className="mt-3 flex justify-between text-[11px] text-[#718078]"><span>{overviewRound ? `${overviewTested} de ${overviewRound.items.length} itens testados` : 'Sem itens cadastrados'}</span><span className="font-semibold text-[#3e5b4b]">{overviewProgress}%</span></div><button onClick={() => setActiveSection('rounds')} className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#386349]">Abrir rodada <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" /></button>
            </section>
            <section className="relative min-h-[190px] overflow-hidden rounded-2xl border border-[#dce5df] bg-[linear-gradient(145deg,#fffdf5,#f0f8f3)] p-5 shadow-[0_4px_18px_rgb(16_39_29/4%)]"><div className="relative z-[1] max-w-[62%]"><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#7b6b35]">Dica da vez</p><h2 className="mt-3 text-[15px] font-semibold">Teste com contexto</h2><p className="mt-2 text-xs leading-5 text-[#66766d]">{qualityTips[tipIndex]}</p><div className="mt-4 flex gap-1">{qualityTips.map((_, index) => <span key={index} className={`h-1.5 rounded-full transition-all ${index === tipIndex ? 'w-5 bg-[#6d8f48]' : 'w-1.5 bg-[#d7dfd8]'}`} />)}</div></div><img src="/dashboard/quality-tip.png" alt="Ilustração de dica de qualidade" className="absolute -bottom-8 -right-9 h-[190px] w-[190px] object-contain drop-shadow-[0_14px_24px_rgb(23_62_44/18%)]" /></section>
          </div>
          </> : activeSection === 'reports' ? <ReportsView reports={reportItems} onSelect={openReport} /> : activeSection === 'rounds' ? <RoundsView /> : activeSection === 'versions' ? <VersionsView /> : <TeamView currentUserName={currentUser?.displayName || userName} currentUserInitials={userInitials} />}
        </div>
      </main>

      <Dialog open={newReportOpen} onOpenChange={setNewReportOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          <form onSubmit={createReport} noValidate>
            <DialogHeader className="border-b border-[#e4ebe7] px-6 py-5">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eaf4ed] text-[#246142]"><Bug className="size-4" /></span><div><DialogTitle className="text-lg">Novo report técnico</DialogTitle><DialogDescription className="mt-1">Registre o problema com os dados necessários para o Desenvolvimento.</DialogDescription></div></div>
            </DialogHeader>
            {formError && <div role="alert" className="mx-6 mt-5 flex items-start gap-2 rounded-xl border border-[#efc3bb] bg-[#fff2ef] p-3 text-xs leading-5 text-[#9e3e31]"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><span>{formError}</span></div>}
            <div className="space-y-6 px-6 py-5">
              <FormSection title="Origem do report" description="Informe se este problema foi encontrado durante uma rodada de testes.">
                <input type="hidden" name="fromTestRound" value={fromTestRound ? 'yes' : 'no'} />
                <label className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${fromTestRound ? 'border-[#83ad91] bg-[#f0f8f2] shadow-[0_8px_24px_-22px_#173e2c]' : 'border-[#dfe7e2] bg-[#fafcfb] hover:border-[#b9ccbf]'}`}><input type="checkbox" checked={fromTestRound} onChange={(event) => { setFromTestRound(event.target.checked); if (!event.target.checked) { setLinkedRoundId(''); setLinkedItemId(''); } }} className="mt-1 size-4 accent-[#296444]" /><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#397657] shadow-sm"><ListChecks className="size-4" /></span><span><strong className="block text-xs font-semibold text-[#34483d]">Bug encontrado em uma rodada de testes</strong><small className="mt-1 block text-[10px] leading-4 text-[#75847c]">Marque para relacionar este report à rodada e ao teste onde o problema apareceu.</small></span></label>
                {fromTestRound && <div className="rounded-2xl border border-[#cfe0d5] bg-white p-4"><div className="flex items-center gap-2 border-b border-[#edf1ef] pb-3"><span className="grid size-7 place-items-center rounded-lg bg-[#d7ff66] text-[#244c35]"><PackageCheck className="size-3.5" /></span><div><p className="text-xs font-semibold">Vincular à rodada</p><p className="text-[9px] text-[#849088]">Essas informações aparecerão no histórico do report.</p></div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Nome da rodada"><select name="testRoundId" required value={linkedRoundId} onChange={(event) => { setLinkedRoundId(event.target.value); setLinkedItemId(''); }} className="form-select"><option value="">Selecione a rodada</option>{reportRounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}</select></Field><Field label="Número / versão"><Input value={linkedRound?.version || ''} readOnly placeholder="Preenchido pela rodada" className="bg-[#f5f8f6]" /></Field></div><div className="mt-4"><Field label="Nome do teste onde encontrou o bug"><select name="testItemId" required value={linkedItemId} onChange={(event) => setLinkedItemId(event.target.value)} disabled={!linkedRound} className="form-select"><option value="">{linkedRound ? 'Selecione o teste' : 'Primeiro selecione a rodada'}</option>{linkedRound?.items.map((item) => <option key={item.id} value={item.id}>{item.position}. {item.title}</option>)}</select></Field></div>{reportRounds.length === 0 && <p className="mt-3 rounded-lg bg-[#fff7e4] px-3 py-2 text-[10px] text-[#8a641b]">Nenhuma rodada está disponível. Cadastre uma rodada antes de vincular o report.</p>}</div>}
              </FormSection>
              <FormSection title="Dados do cliente" description="Preencha quando o problema estiver ligado a uma instituição.">
                <Field label={fromTestRound ? 'Instituição (opcional para rodada interna)' : 'Instituição'}><Input name="institution" required={!fromTestRound} placeholder={fromTestRound ? 'Será identificado como Rodada interna de testes' : 'Ex.: Colégio Estadual Ivo Leão'} /></Field>
                <div className="grid gap-4 sm:grid-cols-3"><Field label="Cidade/UF"><Input name="city" placeholder="Curitiba/PR" /></Field><Field label="Cópia"><Input name="copy" placeholder="109279" /></Field><Field label="INEP"><Input name="inep" placeholder="41129970" /></Field></div>
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Nome do cliente"><Input name="clientName" /></Field><Field label="Telefone"><Input name="phone" /></Field></div>
              </FormSection>
              <FormSection title="Diagnóstico" description="Informe exatamente onde e como o erro acontece.">
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Função"><Input name="function" required placeholder="Integração SEED-PR" /></Field><Field label="Versão / rodada"><Input name="version" placeholder="U+ 009/26" /></Field></div>
                <Field label="Caminho no sistema"><Input name="path" required placeholder="Sua Conta > Integração > SEED-PR" /></Field>
                <Field label="Descrição do erro"><InlineReportEditor blocks={reportBlocks} onChange={setReportBlocks} /></Field>
                <div className="grid gap-4 sm:grid-cols-3"><Field label="Ano letivo"><Input name="schoolYear" placeholder="2026" /></Field><Field label="Urgência"><select name="urgent" className="form-select"><option value="yes">Sim</option><option value="no">Não</option></select></Field><Field label="Ocorre no beta?"><select name="beta" className="form-select"><option>Não testado</option><option>Sim</option><option>Não</option></select></Field></div>
                <Field label="Contorno encontrado"><Textarea name="workaround" placeholder="Não consegui fazer a reversão." /></Field>
              </FormSection>
              <FormSection title="Arquivos do report" description="Indique o que acompanha este chamado. As duas opções começam marcadas como Sim.">
                <input type="hidden" name="hasBackup" value={hasBackup ? 'yes' : 'no'} />
                <input type="hidden" name="hasAttachments" value={hasAttachments ? 'yes' : 'no'} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <OptionToggle checked={hasBackup} onChange={setHasBackup} icon={FileArchive} title="Possui cópia de segurança?" description="Arquivo CSV do cliente" />
                  <OptionToggle checked={hasAttachments} onChange={setHasAttachments} icon={FileImage} title="Possui anexos?" description="Prints ou imagens do erro" />
                </div>
                {hasBackup && <label className="upload-zone border-[#d5e2da] bg-[#f8fbf9]"><UploadCloud className="size-5 text-[#3b7755]" /><span><strong>Cópia de segurança (.csv) *</strong><small>Obrigatória enquanto “Possui cópia” estiver em Sim</small></span><Input name="backup" type="file" accept=".csv,text/csv" required className="file-input" /></label>}
                {hasAttachments && <label className="upload-zone"><FileImage className="size-5 text-[#6b7d73]" /><span><strong>Outros prints do erro</strong><small>Opcional quando já houver imagem inserida no texto</small></span><Input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple required={!reportBlocks.some((block) => block.type === 'image')} className="file-input" /></label>}
              </FormSection>
              <label className="flex items-start gap-3 rounded-xl border border-[#dfe8e2] bg-[#f8fbf9] p-4 text-xs leading-5 text-[#52655a]"><input required type="checkbox" className="mt-1 accent-[#296444]" /><span>Confirmo que as informações acima representam corretamente o que acompanha este report.</span></label>
            </div>
            <DialogFooter className="mx-0 mb-0 px-6"><Button type="button" variant="outline" onClick={() => setNewReportOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving || saved} className="bg-[#173e2c] text-white hover:bg-[#24573f]">{saving ? <><LoaderCircle className="animate-spin" /> Salvando...</> : saved ? <><Check /> Report criado</> : 'Enviar para Desenvolvimento'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedReport)} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-h-[94vh] overflow-y-auto border border-white/80 bg-[#f4f6f3] p-0 shadow-[0_32px_100px_rgb(10_34_22/32%)] ring-1 ring-[#173e2c]/15 sm:max-w-5xl">
          {selectedReport && <>
            <DialogHeader className="relative overflow-hidden border-b border-[#d9e2dc] bg-[#fbfcfa] px-6 py-6 sm:px-8 sm:py-7">
              <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#173e2c_0%,#4f8a63_58%,#d7ff66_100%)]" />
              <div className="absolute right-0 top-0 h-full w-[220px] bg-[radial-gradient(circle_at_center,#e9f3ec_0%,transparent_68%)]" />
              <button type="button" onClick={() => setSelectedReport(null)} aria-label="Fechar report" className="absolute right-4 top-4 z-20 grid size-9 place-items-center rounded-xl border border-[#d8e1db] bg-white text-[#6e7c74] shadow-sm transition hover:border-[#9fb5a7] hover:text-[#173e2c]"><X className="size-4" /></button>
              <div className="relative z-[1] grid items-center gap-4 pr-10 sm:grid-cols-[minmax(0,1fr)_160px] sm:pr-0"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg border border-[#d9e2dc] bg-white px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-[#63736a] shadow-sm">{selectedReport.id}</span><span className={`status status-${selectedReport.tone} border border-white shadow-sm`}><span />{selectedReport.status}</span>{reportDetail?.permissions && <Badge className={reportDetail.permissions.canEdit ? 'border border-[#b8d2c1] bg-[#eaf5ed] text-[#347951]' : 'border border-[#dde3df] bg-[#f0f2f1] text-[#69776f]'}>{reportDetail.permissions.isOwner ? 'SEU REPORT' : reportDetail.permissions.canEdit ? 'EDIÇÃO COMPARTILHADA' : 'SOMENTE LEITURA'}</Badge>}</div>
              <div className="mt-5 flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl border border-[#cadecf] bg-[#edf5f0] text-[#397657] shadow-[0_10px_25px_-20px_#173e2c]"><Bug className="size-5" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#6c8375]">Diagnóstico técnico</p><DialogTitle className="mt-1.5 text-2xl text-[#172a20] sm:text-[29px]">{selectedReport.title}</DialogTitle><DialogDescription className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#718078]"><span className="inline-flex items-center gap-1.5"><Building2 className="size-3.5 text-[#5e7e6b]" />{String(reportDetail?.report.institution || selectedReport.client)}</span><span className="text-[#c2ccc6]">•</span><span>Cópia {String(reportDetail?.report.copy_number || selectedReport.copy)}</span><span className="text-[#c2ccc6]">•</span><span>{String(reportDetail?.report.version || selectedReport.version)}</span></DialogDescription></div></div></div>
              <div className="relative hidden h-[150px] items-center justify-center sm:flex"><div className="absolute size-[130px] rounded-full border border-[#d8e5dc] bg-white/65" /><img src="/reports/quality-inspector.png" alt="Inspeção visual de qualidade" className="relative z-[1] h-[155px] w-[155px] object-contain drop-shadow-[0_18px_22px_rgb(23_62_44/18%)]" /></div></div>
            </DialogHeader>
            <nav className="sticky top-0 z-20 flex items-center gap-1 border-b border-[#dce5df] bg-white/95 px-5 py-2.5 backdrop-blur-xl sm:px-7" aria-label="Seções do report">{[
              { id: 'summary', label: 'Visão geral', icon: LayoutDashboard },
              { id: 'activity', label: 'Histórico e resposta', icon: Activity },
              { id: 'files', label: 'Arquivos e acesso', icon: Paperclip },
            ].map((tab) => { const Icon = tab.icon; return <button type="button" key={tab.id} onClick={() => setReportTab(tab.id as typeof reportTab)} className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-semibold transition ${reportTab === tab.id ? 'bg-[#173e2c] text-white shadow-sm' : 'text-[#6f7f76] hover:bg-[#f0f4f1] hover:text-[#294c38]'}`}><Icon className="size-3.5" />{tab.label}</button>; })}</nav>
            {detailLoading && <div className="flex items-center justify-center gap-3 py-20 text-xs font-medium text-[#718078]"><span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm"><LoaderCircle className="size-4 animate-spin text-[#397657]" /></span> Carregando experiência do report...</div>}
            {!detailLoading && <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-7 [&>aside:last-child]:hidden">
              <section className="order-1 grid grid-cols-2 gap-2 lg:col-span-2 lg:grid-cols-4"><ReportMetric icon={ShieldCheck} label="Status atual" value={selectedReport.status} tone="green" /><ReportMetric icon={AlertTriangle} label="Prioridade" value={Number(reportDetail?.report.urgent) === 1 ? 'Alta' : 'Normal'} tone={Number(reportDetail?.report.urgent) === 1 ? 'red' : 'green'} /><ReportMetric icon={Users} label="Responsável" value="Desenvolvimento" tone="blue" /><ReportMetric icon={Paperclip} label="Evidências" value={`${reportDetail?.attachments.length || 0} arquivo${reportDetail?.attachments.length === 1 ? '' : 's'}`} tone="amber" /></section>
              <aside className="order-3 space-y-4">
                {reportTab === 'summary' && <>
                  {Number(reportDetail?.report.from_test_round) === 1 && <section className="overflow-hidden rounded-[20px] border border-[#cadecf] bg-white shadow-[0_12px_35px_-30px_#173e2c]"><div className="flex items-center gap-3 border-b border-[#e5ece7] bg-[linear-gradient(135deg,#edf6f0,#f8fbf9)] p-4"><span className="grid size-9 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ListChecks className="size-4" /></span><div><p className="detail-label text-[#397657]">Origem do report</p><p className="mt-1 text-xs font-semibold">Bug encontrado em rodada</p></div></div><div className="space-y-3 p-4"><div><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#87948d]">Rodada</p><p className="mt-1 text-[11px] font-semibold text-[#32463b]">{String(reportDetail?.report.test_round_title || 'Não informada')}</p><p className="mt-0.5 text-[9px] text-[#7d8a83]">{String(reportDetail?.report.test_round_version || '')}</p></div><div className="rounded-xl border border-[#e2e9e5] bg-[#f7faf8] p-3"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#87948d]">Teste relacionado</p><p className="mt-1 text-[10px] font-semibold leading-4 text-[#405449]">{String(reportDetail?.report.test_item_title || 'Não informado')}</p></div></div></section>}
                  <section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#eef4f0] text-[#4d775f]"><LayoutDashboard className="size-3.5" /></span><div><p className="detail-label">Ficha técnica</p><p className="mt-0.5 text-[9px] text-[#849088]">Contexto para análise</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><InfoCard label="Ambiente beta" value={String(reportDetail?.report.beta_status || 'Não testado')} /><InfoCard label="Urgência" value={Number(reportDetail?.report.urgent) === 1 ? 'Prioritário' : 'Normal'} /><InfoCard label="Possui cópia" value={Number(reportDetail?.report.has_backup) === 1 ? 'Sim' : 'Não'} /><InfoCard label="Possui anexos" value={Number(reportDetail?.report.has_attachments) === 1 ? 'Sim' : 'Não'} /></div></section>
                  <section className="rounded-[20px] border border-[#dde6e0] bg-[#173e2c] p-4 text-white shadow-[0_18px_40px_-30px_#173e2c]"><div className="flex items-center gap-2 text-[#d7ff66]"><Building2 className="size-4" /><p className="text-[9px] font-bold uppercase tracking-[.12em]">Cliente e versão</p></div><p className="mt-3 text-xs font-semibold leading-5">{String(reportDetail?.report.institution || selectedReport.client)}</p><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[9px]">Cópia {String(reportDetail?.report.copy_number || selectedReport.copy)}</span><span className="rounded-lg bg-white/10 px-2.5 py-1.5 text-[9px]">{String(reportDetail?.report.version || selectedReport.version)}</span></div></section>
                </>}
                {reportTab === 'activity' && <section className="rounded-[20px] border border-[#d8e4dc] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><Activity className="size-4" /></span><div><p className="detail-label">Fluxo do report</p><p className="mt-0.5 text-[9px] text-[#849088]">Situação neste momento</p></div></div><div className="mt-4 space-y-2"><div className="flex items-center justify-between rounded-xl bg-[#f5f8f6] px-3 py-2.5"><span className="text-[9px] text-[#75837b]">Status</span><span className={`status status-${selectedReport.tone}`}><span />{selectedReport.status}</span></div><div className="flex items-center justify-between rounded-xl bg-[#f5f8f6] px-3 py-2.5"><span className="text-[9px] text-[#75837b]">Movimentações</span><strong className="text-[11px]">{reportDetail?.activities.length || 0}</strong></div><div className="flex items-center justify-between rounded-xl bg-[#f5f8f6] px-3 py-2.5"><span className="text-[9px] text-[#75837b]">Seu acesso</span><strong className="text-[10px]">{reportDetail?.permissions?.canEdit ? 'Pode responder' : 'Somente leitura'}</strong></div></div></section>}
                {reportTab === 'files' && <>
                  {reportDetail?.permissions?.isOwner && <section className="rounded-[20px] border border-[#bcd4c4] bg-[linear-gradient(145deg,#f7fbf8,#edf6f0)] p-4 shadow-[0_12px_35px_-28px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white text-[#397657] shadow-sm"><Share2 className="size-3.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#397657]">Compartilhar edição</p><p className="mt-0.5 text-[9px] text-[#74837b]">Controle quem pode colaborar</p></div></div><p className="mt-3 text-[10px] leading-4 text-[#617168]">Pessoas autorizadas podem responder, anexar arquivos e alterar o status.</p><form onSubmit={shareReport} className="mt-3 space-y-2"><Input name="shareEmail" type="email" required placeholder="email@empresa.com" className="h-9 rounded-xl bg-white text-[10px]" /><Button type="submit" disabled={sharing} className="h-9 w-full rounded-xl bg-[#173e2c] text-white">{sharing ? <LoaderCircle className="animate-spin" /> : <Plus />} Liberar edição</Button></form>{shareNotice && <p className={`mt-2 rounded-lg px-2 py-1.5 text-[9px] ${shareNotice.tone === 'success' ? 'bg-[#e6f3ea] text-[#397657]' : 'bg-[#fff0ed] text-[#a64b3e]'}`}>{shareNotice.message}</p>}<div className="mt-3 space-y-2">{reportDetail.shares?.map((share) => <div key={share.user_email} className="flex items-center gap-2 rounded-xl border border-[#e1e9e4] bg-white px-2.5 py-2"><span className="grid size-7 place-items-center rounded-full bg-[#d7ff66] text-[8px] font-bold text-[#294b37]">{initials(share.user_email.split('@')[0])}</span><span className="min-w-0 flex-1 truncate text-[9px] text-[#53655b]">{share.user_email}</span><button type="button" onClick={() => updateShare(share.user_email, 'remove')} disabled={sharing} className="rounded-md px-1.5 py-1 text-[8px] font-semibold text-[#a64b3e] hover:bg-[#fff0ed]">Remover</button></div>)}{!reportDetail.shares?.length && <p className="rounded-lg border border-dashed border-[#ccd9d1] px-3 py-2 text-center text-[9px] text-[#8a968f]">Acesso exclusivo do autor</p>}</div></section>}
                  <section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><ShieldCheck className="size-4" /></span><div><p className="text-xs font-semibold">Arquivos protegidos</p><p className="mt-1 text-[10px] leading-4 text-[#74837b]">As evidências ficam vinculadas ao report e disponíveis para a equipe autorizada.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><InfoCard label="Cópia de segurança" value={Number(reportDetail?.report.has_backup) === 1 ? 'Incluída' : 'Não incluída'} /><InfoCard label="Total de arquivos" value={String(reportDetail?.attachments.length || 0)} /></div></section>
                </>}
              </aside>
              <div className="order-2 space-y-5">
                {reportTab === 'summary' && <section className="rounded-[20px] border border-[#dde6e0] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Sparkles className="size-3.5" /></span><p className="detail-label">Diagnóstico do problema</p></div><ReportDescription value={String(reportDetail?.report.description || 'Cliente tenta realizar a operação e o sistema apresenta um erro, impedindo a conclusão.')} attachments={reportDetail?.attachments || []} /><div className="mt-5 border-t border-[#edf1ef] pt-4"><p className="detail-label">Caminho no sistema</p><p className="mt-2 flex items-center gap-2 rounded-xl border border-[#e1e8e4] bg-[#f7faf8] px-3.5 py-3 font-mono text-[11px] text-[#405449]"><Code2 className="size-3.5 shrink-0 text-[#668274]" />{String(reportDetail?.report.system_path || 'Caminho informado no report')}</p></div></section>}
                {reportTab === 'activity' && <section className="rounded-[20px] border border-[#dde6e0] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Activity className="size-3.5" /></span><div><p className="detail-label">Linha do tempo</p><p className="mt-0.5 text-[10px] text-[#849088]">Histórico completo deste report</p></div></div><Badge className="bg-[#f0f4f1] text-[#64756b]">{reportDetail?.activities.length || 0} EVENTOS</Badge></div><div className="mt-5 space-y-3 border-l border-[#d9e4dd] pl-5">
                  {reportDetail?.activities.length ? reportDetail.activities.map((activity) => <Timeline key={activity.id} name={actorName(activity.actor_email)} role={activity.action === 'status_update' ? 'Atualização de status' : activity.action === 'attachment_added' ? 'Anexo' : 'Equipe'} time={formatDateTime(activity.created_at)} text={activity.message || 'Atualização registrada.'} highlighted={activity.action === 'status_update'} />) : <Timeline name="Equipe GEHA" role="Suporte" time="Histórico inicial" text="Report registrado para análise da equipe." />}
                </div></section>}
                {reportTab === 'activity' && (reportDetail?.permissions?.canEdit ? <form onSubmit={sendReply} className="rounded-[20px] border border-[#cfded5] bg-white p-4 shadow-[0_14px_40px_-32px_#173e2c]"><div className="flex items-center gap-2 px-1"><span className="grid size-7 place-items-center rounded-lg bg-[#173e2c] text-[#d7ff66]"><MessageSquareText className="size-3.5" /></span><div><p className="text-xs font-semibold">Registrar atualização</p><p className="text-[9px] text-[#849088]">Responda, anexe uma evidência ou altere o status.</p></div></div><Textarea name="message" placeholder="Escreva uma resposta ou o resultado do reteste..." className="mt-3 min-h-24 rounded-xl border-[#e1e8e4] bg-[#f9fbfa] p-3 shadow-none" /><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px_auto]"><Input name="attachment" type="file" className="h-9 rounded-xl bg-white text-[10px]" aria-label="Anexar arquivo à resposta" /><select name="status" defaultValue={selectedReport.status} className="form-select h-9 rounded-xl"><option>Novo report</option><option>Em análise</option><option>Em correção</option><option>Aguardando reteste</option><option>Corrigido</option><option>Ainda ocorre</option></select><Button type="submit" disabled={replying} className="h-9 rounded-xl bg-[#173e2c] text-white shadow-sm">{replying ? <LoaderCircle className="animate-spin" /> : <MessageSquareText />} {replying ? 'Enviando...' : 'Publicar'}</Button></div>{replyNotice && <div role="status" className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${replyNotice.tone === 'success' ? 'border-[#bfddc9] bg-[#eef8f1] text-[#2f7048]' : 'border-[#efc3bb] bg-[#fff2ef] text-[#9e3e31]'}`}>{replyNotice.message}</div>}</form> : reportDetail && <div className="flex items-start gap-3 rounded-[20px] border border-[#dce5df] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0f3f1] text-[#728078]"><ShieldCheck className="size-4" /></span><div><p className="text-xs font-semibold">Report disponível somente para leitura</p><p className="mt-1 text-[10px] leading-4 text-[#74837b]">Você pode acompanhar todas as informações, mas somente o autor ou pessoas autorizadas podem responder, anexar arquivos e alterar o status.</p></div></div>)}
                {reportTab === 'files' && <section className="rounded-[20px] border border-[#dde6e0] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center justify-between"><div><p className="detail-label">Central de evidências</p><p className="mt-1 text-xs text-[#718078]">Arquivos, imagens e cópias anexados ao report.</p></div><span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Paperclip className="size-4" /></span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{reportDetail?.attachments.length ? reportDetail.attachments.map((file) => <Attachment key={file.id} id={file.id} name={file.file_name} size={formatBytes(file.byte_size)} csv={file.kind === 'backup'} />) : <p className="col-span-full rounded-2xl border border-dashed border-[#d4dfd8] bg-[#f8faf9] p-8 text-center text-[10px] text-[#7b8981]">Nenhum arquivo anexado a este report.</p>}</div></section>}
              </div>
              <aside className="space-y-4">{reportDetail?.permissions?.isOwner && <section className="rounded-[20px] border border-[#bcd4c4] bg-[linear-gradient(145deg,#f7fbf8,#edf6f0)] p-4 shadow-[0_12px_35px_-28px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white text-[#397657] shadow-sm"><Share2 className="size-3.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#397657]">Compartilhar edição</p><p className="mt-0.5 text-[9px] text-[#74837b]">Controle de acesso ao report</p></div></div><p className="mt-3 text-[10px] leading-4 text-[#617168]">A pessoa poderá responder, anexar arquivos e alterar o status.</p><form onSubmit={shareReport} className="mt-3 space-y-2"><Input name="shareEmail" type="email" required placeholder="email@empresa.com" className="h-9 rounded-xl bg-white text-[10px]" /><Button type="submit" disabled={sharing} className="h-9 w-full rounded-xl bg-[#173e2c] text-white">{sharing ? <LoaderCircle className="animate-spin" /> : <Plus />} Liberar edição</Button></form>{shareNotice && <p className={`mt-2 rounded-lg px-2 py-1.5 text-[9px] ${shareNotice.tone === 'success' ? 'bg-[#e6f3ea] text-[#397657]' : 'bg-[#fff0ed] text-[#a64b3e]'}`}>{shareNotice.message}</p>}<div className="mt-3 space-y-2">{reportDetail.shares?.map((share) => <div key={share.user_email} className="flex items-center gap-2 rounded-xl border border-[#e1e9e4] bg-white px-2.5 py-2"><span className="grid size-7 place-items-center rounded-full bg-[#d7ff66] text-[8px] font-bold text-[#294b37]">{initials(share.user_email.split('@')[0])}</span><span className="min-w-0 flex-1 truncate text-[9px] text-[#53655b]">{share.user_email}</span><button type="button" onClick={() => updateShare(share.user_email, 'remove')} disabled={sharing} className="rounded-md px-1.5 py-1 text-[8px] font-semibold text-[#a64b3e] hover:bg-[#fff0ed]">Remover</button></div>)}{!reportDetail.shares?.length && <p className="rounded-lg border border-dashed border-[#ccd9d1] px-3 py-2 text-center text-[9px] text-[#8a968f]">Acesso exclusivo do autor</p>}</div></section>}{Number(reportDetail?.report.from_test_round) === 1 && <section className="rounded-[20px] border border-[#cfe0d5] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><ListChecks className="size-3.5" /></span><p className="detail-label text-[#397657]">Bug de rodada</p></div><p className="mt-3 text-xs font-semibold">{String(reportDetail?.report.test_round_title || '')}</p><p className="mt-1 text-[10px] text-[#718078]">{String(reportDetail?.report.test_round_version || '')}</p><div className="mt-3 rounded-xl border border-[#e3eae6] bg-[#f7faf8] px-3 py-2"><p className="text-[9px] font-semibold uppercase text-[#849088]">Teste relacionado</p><p className="mt-1 text-[10px] font-semibold text-[#405449]">{String(reportDetail?.report.test_item_title || '')}</p></div></section>}<section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="grid grid-cols-2 gap-3"><InfoCard label="Responsável" value="Desenvolvimento" /><InfoCard label="Urgência" value={Number(reportDetail?.report.urgent) === 1 ? 'Prioritário' : 'Normal'} /><InfoCard label="Ambiente beta" value={String(reportDetail?.report.beta_status || 'Não testado')} />{reportDetail && <InfoCard label="Evidências" value={`${reportDetail.attachments.length} arquivo${reportDetail.attachments.length === 1 ? '' : 's'}`} />}</div></section><section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center justify-between"><p className="detail-label">Arquivos</p><Paperclip className="size-3.5 text-[#849088]" /></div><div className="mt-3 space-y-2">{reportDetail?.attachments.length ? reportDetail.attachments.map((file) => <Attachment key={file.id} id={file.id} name={file.file_name} size={formatBytes(file.byte_size)} csv={file.kind === 'backup'} />) : <p className="rounded-xl border border-dashed border-[#d4dfd8] bg-[#f8faf9] p-4 text-center text-[9px] text-[#7b8981]">Nenhum arquivo anexado.</p>}</div></section></aside>
            </div>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportsView({ reports, onSelect }: { reports: ReportItem[]; onSelect: (report: ReportItem) => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const filteredReports = reports.filter((report) => {
    const haystack = `${report.id} ${report.title} ${report.client} ${report.copy} ${report.version}`.toLocaleLowerCase('pt-BR');
    const matchesQuery = haystack.includes(query.toLocaleLowerCase('pt-BR'));
    const matchesFilter = filter === 'Todos' || (filter === 'Novos' && report.status === 'Novo report') || (filter === 'Em andamento' && ['Em análise', 'Em correção', 'Em teste'].includes(report.status)) || (filter === 'Reteste' && report.status === 'Aguardando reteste') || (filter === 'Corrigidos' && report.status === 'Corrigido');
    return matchesQuery && matchesFilter;
  });
  return <div>
    <div className="flex items-center gap-3 rounded-2xl border border-[#d6e2da] bg-[linear-gradient(110deg,#ffffff_0%,#f4f8f5_100%)] px-4 py-3.5 shadow-[0_8px_24px_-25px_#173e2c]">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f3ec] text-[#397657] ring-1 ring-[#d6e4da]"><MessageSquareText className="size-4" /></span>
      <p className="text-xs leading-5 text-[#68786f] sm:text-[13px]"><strong className="font-semibold text-[#263b2f]">Acompanhe cada report</strong> do registro inicial à análise, correção e validação final, com todo o histórico centralizado.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStat value={String(reports.filter((report) => report.status !== 'Corrigido').length)} label="Reports abertos" tone="red" /><MiniStat value={String(reports.filter((report) => report.status === 'Aguardando reteste').length)} label="Aguardando reteste" tone="amber" /><MiniStat value={String(reports.filter((report) => report.status === 'Corrigido').length)} label="Reports corrigidos" tone="green" /></div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#dce5df] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e4ebe7] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">{['Todos', 'Novos', 'Em andamento', 'Reteste', 'Corrigidos'].map((item) => <button onClick={() => setFilter(item)} key={item} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${filter === item ? 'bg-[#173e2c] text-white' : 'bg-[#f0f4f1] text-[#64756b] hover:bg-[#e5ece7]'}`}>{item}</button>)}</div>
        <div className="relative sm:w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cliente, função ou ID" aria-label="Buscar reports" className="h-9 rounded-xl bg-[#f8faf9] pl-8" /></div>
      </div>
      <div className="hidden grid-cols-[1.4fr_.65fr_.6fr_.4fr] gap-4 border-b border-[#e9eeeb] bg-[#fafcfb] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.1em] text-[#829087] md:grid"><span>Report</span><span>Versão / anexos</span><span>Status</span><span>Responsável</span></div>
      <div className="divide-y divide-[#e9eeeb]">{filteredReports.map((report) => <button key={report.id} onClick={() => onSelect(report)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left hover:bg-[#f8faf9] md:grid-cols-[1.4fr_.65fr_.6fr_.4fr]">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-[#78877f]">{report.id}</span>{report.urgent && <Badge className="h-[18px] bg-[#fff0ed] px-1.5 text-[9px] text-[#b64738]">URGENTE</Badge>}{report.canEdit === false && <Badge className="h-[18px] bg-[#f0f2f1] px-1.5 text-[8px] text-[#6c7972]">LEITURA</Badge>}{report.canEdit && !report.isOwner && <Badge className="h-[18px] bg-[#edf7f0] px-1.5 text-[8px] text-[#377853]">COMPARTILHADO</Badge>}</div><p className="mt-1 truncate text-[13px] font-semibold">{report.title}</p><p className="mt-1 truncate text-[11px] text-[#75847c]">{report.client} · {report.copy}</p></div>
        <div className="hidden md:block"><p className="text-[11px] font-medium">{report.version}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[#849088]"><Paperclip className="size-3" />{report.attachments} anexos</p></div>
        <div className="hidden md:block"><span className={`status status-${report.tone}`}><span />{report.status}</span></div>
        <div className="flex items-center justify-end gap-2 md:justify-start"><span className="grid size-7 place-items-center rounded-full bg-[#e6ece8] text-[9px] font-semibold text-[#385144]">{report.owner}</span><ChevronRight className="size-4 text-[#a1ada6] transition group-hover:translate-x-0.5" /></div>
      </button>)}{filteredReports.length === 0 && <div className="py-14 text-center"><Search className="mx-auto size-5 text-[#9aa59f]" /><p className="mt-3 text-xs font-medium">Nenhum report encontrado</p><p className="mt-1 text-[10px] text-[#87938c]">Ajuste a busca ou selecione outro filtro.</p></div>}</div>
    </section>
  </div>;
}

function RoundsView() {
  const [rounds, setRounds] = useState<TestRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [draftItems, setDraftItems] = useState([{ key: 1, title: '', path: '', description: '' }]);
  const [selectedItem, setSelectedItem] = useState<TestRoundItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRound, setSavingRound] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [itemFilter, setItemFilter] = useState('Todos');
  const [itemQuery, setItemQuery] = useState('');

  useEffect(() => {
    fetch('/api/rounds').then(async (response) => {
      if (!response.ok) throw new Error('Não foi possível carregar as rodadas.');
      return response.json() as Promise<{ rounds: TestRound[] }>;
    }).then((payload) => { setRounds(payload.rounds); setSelectedRoundId(payload.rounds[0]?.id || null); }).catch((error) => setNotice({ tone: 'error', message: error.message })).finally(() => setLoading(false));
  }, []);

  const selectedRound = rounds.find((round) => round.id === selectedRoundId) || rounds[0] || null;
  const tested = selectedRound?.items.filter((item) => ['Aprovado', 'Com bug'].includes(item.status)).length || 0;
  const progress = selectedRound?.items.length ? Math.round((tested / selectedRound.items.length) * 100) : 0;
  const pendingCount = selectedRound?.items.filter((item) => item.status === 'Pendente').length || 0;
  const testingCount = selectedRound?.items.filter((item) => item.status === 'Em teste').length || 0;
  const approvedCount = selectedRound?.items.filter((item) => item.status === 'Aprovado').length || 0;
  const bugCount = selectedRound?.items.filter((item) => item.status === 'Com bug').length || 0;
  const beaconPowered = Boolean(selectedRound?.items.some((item) => item.status !== 'Pendente'));
  const participants = selectedRound?.participants || [];
  const completedParticipants = participants.filter((participant) => participant.progress === 100);
  const visibleItems = selectedRound?.items.filter((item) => {
    const matchesFilter = itemFilter === 'Todos' || item.status === itemFilter;
    const searchable = `${item.title} ${item.path || ''} ${item.description || ''} ${item.result_note || ''}`.toLocaleLowerCase('pt-BR');
    return matchesFilter && searchable.includes(itemQuery.toLocaleLowerCase('pt-BR'));
  }) || [];
  const nextAction = progress === 100
    ? { title: 'Rodada concluída', text: 'Todos os testes receberam um resultado.', tone: 'green' }
    : bugCount > 0
      ? { title: 'Atenção aos problemas', text: `${bugCount} ${bugCount === 1 ? 'item precisa' : 'itens precisam'} de acompanhamento e report.`, tone: 'red' }
      : testingCount > 0
        ? { title: 'Teste em execução', text: `${testingCount} ${testingCount === 1 ? 'item está' : 'itens estão'} sendo verificado agora.`, tone: 'blue' }
        : { title: 'Próximo passo', text: pendingCount > 0 ? 'Abra o próximo item pendente e registre o resultado.' : 'Cadastre itens para iniciar esta rodada.', tone: 'amber' };

  async function createRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setSavingRound(true);
    const form = event.currentTarget, data = new FormData(form);
    const items = draftItems.map(({ title, path, description }) => ({ title: title.trim(), path: path.trim(), description: description.trim() })).filter((item) => item.title);
    try {
      const response = await fetch('/api/rounds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: data.get('title'), version: data.get('version'), deadline: data.get('deadline'), description: data.get('description'), items }) });
      const payload = await response.json() as { round?: TestRound; error?: string };
      if (!response.ok || !payload.round) throw new Error(payload.error || 'Não foi possível criar a rodada.');
      const refreshed = await fetch('/api/rounds');
      const refreshedPayload = refreshed.ok ? await refreshed.json() as { rounds: TestRound[] } : null;
      setRounds(refreshedPayload?.rounds || ((current) => [payload.round!, ...current])); setSelectedRoundId(payload.round.id); setNewRoundOpen(false); setDraftItems([{ key: Date.now(), title: '', path: '', description: '' }]); form.reset(); setNotice({ tone: 'success', message: 'Rodada criada e liberada para a equipe.' });
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível criar a rodada.' }); }
    finally { setSavingRound(false); }
  }

  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedRound || !selectedItem) return; setSavingItem(true); setNotice(null);
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/rounds/${encodeURIComponent(selectedRound.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId: selectedItem.id, status: data.get('status'), note: data.get('note') }) });
      const payload = await response.json() as { item?: Partial<TestRoundItem> & { id: string }; participantCompleted?: boolean; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || 'Não foi possível atualizar o teste.');
      const refreshed = await fetch('/api/rounds');
      if (!refreshed.ok) throw new Error('O resultado foi salvo, mas não foi possível atualizar o painel.');
      const refreshedPayload = await refreshed.json() as { rounds: TestRound[] };
      setRounds(refreshedPayload.rounds);
      setSelectedItem(null); setNotice({ tone: 'success', message: 'Resultado do teste registrado.' });
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar o teste.' }); }
    finally { setSavingItem(false); }
  }

  return <div>
    <div className="flex flex-col gap-3 rounded-2xl border border-[#d6e2da] bg-[linear-gradient(110deg,#ffffff_0%,#f4f8f5_100%)] px-4 py-3.5 shadow-[0_8px_24px_-25px_#173e2c] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f3ec] text-[#397657] ring-1 ring-[#d6e4da]"><ListChecks className="size-4" /></span>
        <p className="text-xs leading-5 text-[#68786f] sm:text-[13px]"><strong className="font-semibold text-[#30483a]">Organize cada rodada</strong> com os testes enviados pela gerência e acompanhe a evolução individual de toda a equipe.</p>
      </div>
      {rounds.length > 0 && <Button type="button" onClick={() => setNewRoundOpen(true)} className="shrink-0 bg-[#173e2c] text-white"><Plus /> Nova rodada</Button>}
    </div>
    {notice && <div role="status" className={`mt-4 rounded-xl border px-4 py-3 text-xs ${notice.tone === 'success' ? 'border-[#bfddc9] bg-[#eef8f1] text-[#2f7048]' : 'border-[#efc3bb] bg-[#fff2ef] text-[#9e3e31]'}`}>{notice.message}</div>}
    {loading ? <div className="mt-10 flex items-center justify-center gap-2 text-xs text-[#718078]"><LoaderCircle className="size-4 animate-spin" /> Carregando rodadas...</div> : !selectedRound ? <section className="mt-4 rounded-2xl border border-dashed border-[#cfdcd4] bg-white px-6 py-14 text-center"><ListChecks className="mx-auto size-7 text-[#668274]" /><h3 className="mt-4 text-sm font-semibold">Nenhuma rodada cadastrada</h3><p className="mt-2 text-xs text-[#78867e]">Crie a primeira rodada com os itens que chegaram da gerência.</p><Button type="button" onClick={() => setNewRoundOpen(true)} className="mt-5 bg-[#173e2c] text-white"><Plus /> Criar rodada</Button></section> : <>
      <section className="mt-6 overflow-hidden rounded-[20px] border border-[#dce5df] bg-white shadow-[0_14px_40px_-34px_#173e2c]"><div className="flex flex-col gap-3 border-b border-[#e7ede9] bg-[#f8faf9] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><PackageCheck className="size-4" /></span><div><p className="detail-label">Central de rodadas</p><p className="mt-1 text-xs font-semibold text-[#33473c]">Escolha uma entrega para acompanhar</p></div></div><span className="rounded-full border border-[#dbe5df] bg-white px-3 py-1.5 text-[9px] font-semibold text-[#6e7e75]">{rounds.length} {rounds.length === 1 ? 'RODADA' : 'RODADAS'}</span></div><div className="flex gap-2 overflow-x-auto p-3 sm:p-4">{rounds.map((round) => <button type="button" onClick={() => setSelectedRoundId(round.id)} key={round.id} className={`group flex min-w-[210px] items-center gap-3 rounded-2xl border p-3 text-left transition ${round.id === selectedRound.id ? 'border-[#6f9c7f] bg-[#edf6f0] shadow-[0_10px_25px_-22px_#173e2c]' : 'border-[#e1e8e4] bg-white hover:border-[#b8cbbf] hover:bg-[#fafcfb]'}`}><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${round.id === selectedRound.id ? 'bg-[#173e2c] text-[#d7ff66]' : 'bg-[#f0f4f1] text-[#63806f]'}`}><PackageCheck className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-[11px] font-semibold">{round.version}</span><span className="mt-1 block truncate text-[9px] text-[#7d8b83]">{round.title}</span></span>{round.id === selectedRound.id && <Check className="size-3.5 shrink-0 text-[#397657]" />}</button>)}</div></section>
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[24px] border border-[#294a39] bg-[#123222] text-white shadow-[0_22px_60px_-38px_#173e2c]">
          <div className="grid min-h-[260px] lg:grid-cols-[1fr_260px]">
            <div className="relative z-10 flex flex-col justify-center p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2"><Badge className={beaconPowered ? 'bg-[#d7ff66] text-[#173e2c]' : 'bg-white/12 text-white'}>{selectedRound.status.toUpperCase()}</Badge><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-white/55"><span className={`size-1.5 rounded-full ${beaconPowered ? 'animate-pulse bg-[#d7ff66]' : 'bg-white/35'}`} />{beaconPowered ? 'Farol de qualidade ativo' : 'Aguardando primeiro teste'}</span></div>
              <h2 className="mt-4 text-2xl font-semibold tracking-[-.035em] sm:text-[28px]">{selectedRound.title}</h2>
              <p className="mt-2 text-xs text-white/55">{selectedRound.version} · prazo {formatRoundDate(selectedRound.deadline)}</p>
              {selectedRound.description && <p className="mt-4 max-w-2xl text-xs leading-5 text-white/68">{selectedRound.description}</p>}
              <div className="mt-6 max-w-2xl rounded-2xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-end justify-between gap-4"><div><p className="text-[9px] font-semibold uppercase tracking-[.12em] text-white/45">Meu progresso individual</p><p className="mt-1 text-xs font-semibold">{tested} de {selectedRound.items.length} testes finalizados</p></div><span className="text-3xl font-semibold tracking-[-.07em] text-[#d7ff66]">{progress}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5"><div style={{ width: `${progress}%` }} className="h-full rounded-full bg-[linear-gradient(90deg,#68b27f,#d7ff66)] shadow-[0_0_16px_#d7ff6690] transition-[width] duration-700" /></div></div>
            </div>
            <div className="relative hidden min-h-[260px] place-items-center overflow-hidden border-l border-white/[.06] bg-[radial-gradient(circle,#2c6444_0%,#173e2c_50%,#123222_76%)] lg:grid">
              <div className={`absolute size-[205px] rounded-full ${beaconPowered ? 'beacon-light-ring' : 'bg-white/[.025]'}`} />
              <div className="absolute size-[225px] rounded-full border border-white/[.07]" />
              <div className="relative grid size-[235px] place-items-center">
                <img src={beaconPowered ? '/rounds/quality-beacon-on.png' : '/rounds/quality-beacon-off.png'} alt={beaconPowered ? 'Farol de qualidade aceso' : 'Farol de qualidade apagado'} className={`max-h-[225px] max-w-[225px] object-contain ${beaconPowered ? 'beacon-on' : 'opacity-75 saturate-75'}`} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[pendingCount,'Pendentes','#7b8981','#f4f6f5'],[testingCount,'Em teste','#3970a6','#eef5ff'],[approvedCount,'Aprovados','#347951','#edf8f0'],[bugCount,'Com bug','#b64738','#fff0ed']].map(([value,label,color,background]) => <article key={String(label)} style={{ background: String(background) }} className="rounded-2xl border border-white p-4 shadow-[0_8px_25px_-22px_#173e2c]"><div className="flex items-center justify-between"><p style={{ color: String(color) }} className="text-2xl font-semibold tracking-[-.05em]">{value}</p><span style={{ background: String(color) }} className="size-2 rounded-full opacity-70" /></div><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#78867e]">{label}</p></article>)}</div>

        <section className="overflow-hidden rounded-[22px] border border-[#dce5df] bg-white">
          <div className="border-b border-[#e7ede9] bg-[linear-gradient(135deg,#fbfdfb_0%,#f0f6f2_100%)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ListChecks className="size-4" /></span><p className="detail-label">Minha execução</p></div><h3 className="mt-3 text-lg font-semibold tracking-[-.025em]">Testes que você precisa realizar</h3><p className="mt-1 text-xs text-[#718078]">Abra cada cenário, siga as instruções e registre seu resultado individual.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[#dbe6df] bg-white px-4 py-3 shadow-sm"><div className="relative size-11"><svg viewBox="0 0 40 40" className="size-11 -rotate-90"><circle cx="20" cy="20" r="16" fill="none" stroke="#e8eeea" strokeWidth="4" /><circle cx="20" cy="20" r="16" fill="none" stroke="#4b8a62" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${progress} 100`} pathLength="100" /></svg><span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-[#315c42]">{progress}%</span></div><div><p className="text-xs font-semibold">{tested} concluídos</p><p className="mt-0.5 text-[9px] text-[#829087]">de {selectedRound.items.length} testes atribuídos</p></div></div></div>
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-1.5">{['Todos','Pendente','Em teste','Aprovado','Com bug'].map((filter) => { const count = filter === 'Todos' ? selectedRound.items.length : selectedRound.items.filter((item) => item.status === filter).length; return <button type="button" onClick={() => setItemFilter(filter)} key={filter} className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${itemFilter === filter ? 'bg-[#173e2c] text-white shadow-sm' : 'border border-[#dfe7e2] bg-white text-[#6d7d74] hover:border-[#b8cbbf]'}`}>{filter} <span className={`ml-1 ${itemFilter === filter ? 'text-[#d7ff66]' : 'text-[#9aa69f]'}`}>{count}</span></button>; })}</div><div className="relative w-full lg:w-64"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Buscar teste ou caminho" className="h-9 rounded-xl bg-white pl-9 text-xs" /></div></div>
          </div>
          <div className="p-4 sm:p-5"><div className="grid gap-3">{visibleItems.map((item) => { const done = ['Aprovado', 'Com bug'].includes(item.status); const statusColor = item.status === 'Aprovado' ? '#4b8a62' : item.status === 'Com bug' ? '#c15b4a' : item.status === 'Em teste' ? '#4c7ead' : '#9aa69f'; return <button type="button" onClick={() => setSelectedItem(item)} key={item.id} className="group relative overflow-hidden rounded-2xl border border-[#e1e9e4] bg-[#fbfcfb] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b5c9bc] hover:bg-white hover:shadow-[0_14px_35px_-26px_#173e2c]"><span style={{ background: statusColor }} className="absolute inset-y-0 left-0 w-1" /><div className="grid gap-4 pl-1 sm:grid-cols-[42px_1fr_auto]"><span className={`grid size-10 place-items-center rounded-xl ${item.status === 'Aprovado' ? 'bg-[#e9f5ed] text-[#367a52]' : item.status === 'Com bug' ? 'bg-[#fff0ed] text-[#a94a3c]' : item.status === 'Em teste' ? 'bg-[#eaf2fb] text-[#3f72a2]' : 'bg-[#f0f3f1] text-[#89958e]'}`}>{done ? item.status === 'Aprovado' ? <CheckCircle2 className="size-5" /> : <Bug className="size-4" /> : item.status === 'Em teste' ? <PlayCircle className="size-4" /> : <span className="text-xs font-semibold">{String(item.position).padStart(2, '0')}</span>}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-[#263a2e]">{item.title}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${item.status === 'Aprovado' ? 'bg-[#e9f5ed] text-[#3e8058]' : item.status === 'Com bug' ? 'bg-[#fff0ed] text-[#a94a3c]' : item.status === 'Em teste' ? 'bg-[#eaf2fb] text-[#3f72a2]' : 'bg-[#f0f3f1] text-[#7e8b84]'}`}>{item.status}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#74837b]"><ChevronRight className="size-3" />{item.path || `Item ${item.position} de ${selectedRound.items.length}`}</span>{item.description && <span className="mt-3 line-clamp-2 block text-[10px] leading-4 text-[#65756c]">{item.description}</span>}{item.result_note && <span className="mt-3 block rounded-xl border border-[#e3eae6] bg-white px-3 py-2 text-[10px] leading-4 text-[#586960]"><strong className="mr-1 font-semibold text-[#34483d]">Resultado:</strong>{item.result_note}</span>}</span><span className="flex items-center justify-between gap-3 self-center border-t border-[#edf1ef] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0"><span className="text-[9px] text-[#87938c]">{item.tester_email ? `Testado por ${item.tester_email.split('@')[0]}` : 'Aguardando sua resposta'}</span><span className="inline-flex items-center gap-1.5 rounded-lg bg-[#edf5f0] px-2.5 py-1.5 text-[10px] font-semibold text-[#3f6d54]">Registrar resultado <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" /></span></span></div></button>; })}{visibleItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfdcd4] py-12 text-center"><Search className="mx-auto size-5 text-[#97a49d]" /><p className="mt-3 text-xs font-semibold">Nenhum teste encontrado</p><p className="mt-1 text-[10px] text-[#87938c]">Altere o filtro ou o termo pesquisado.</p></div>}</div></div>
        </section>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section className={`rounded-2xl border p-5 ${nextAction.tone === 'green' ? 'border-[#c9e1d1] bg-[#eef8f1]' : nextAction.tone === 'red' ? 'border-[#f0cbc4] bg-[#fff3f0]' : nextAction.tone === 'blue' ? 'border-[#cbdced] bg-[#f1f7fd]' : 'border-[#ead9b4] bg-[#fff9eb]'}`}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-[#375a46]">{progress === 100 ? <CheckCircle2 className="size-4" /> : bugCount > 0 ? <Bug className="size-4" /> : <PlayCircle className="size-4" />}</span><div><p className="text-xs font-semibold">{nextAction.title}</p><p className="mt-1 text-[10px] leading-4 text-[#68776f]">{nextAction.text}</p></div></div></section>
        <section className="rounded-2xl border border-[#dce5df] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="detail-label">Progresso da equipe</p><h3 className="mt-1.5 text-sm font-semibold">{completedParticipants.length} de {participants.length} concluíram</h3></div><span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Users className="size-4" /></span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf1ef]"><div style={{ width: `${participants.length ? Math.round((completedParticipants.length / participants.length) * 100) : 0}%` }} className="h-full rounded-full bg-[#4b8a62] transition-[width] duration-700" /></div><div className="mt-4 space-y-3">{participants.map((participant) => <div key={participant.user_id} className={`rounded-xl border p-3 ${participant.is_current ? 'border-[#c9ddd0] bg-[#f5faf7]' : 'border-[#e6ece8]'}`}><div className="flex items-center gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${participant.progress === 100 ? 'bg-[#d7ff66] text-[#244c35]' : 'bg-[#e9eeeb] text-[#5d6d64]'}`}>{participant.progress === 100 ? <Check className="size-4" /> : initials(participant.user_name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="block truncate text-[11px] font-semibold">{participant.user_name}</span>{participant.is_current && <span className="text-[8px] font-bold uppercase text-[#4b8a62]">Você</span>}</span><span className="mt-0.5 block text-[9px] text-[#87938c]">{Number(participant.done_items)} de {Number(participant.total_items)} testes</span></span><span className={`text-[10px] font-semibold ${participant.progress === 100 ? 'text-[#3d8057]' : 'text-[#6f7e76]'}`}>{participant.progress}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e8eeea]"><div style={{ width: `${participant.progress}%` }} className={`h-full rounded-full ${Number(participant.bug_items) > 0 ? 'bg-[#cf6a59]' : participant.progress === 100 ? 'bg-[#4b8a62]' : 'bg-[#7aa2c5]'}`} /></div>{participant.progress === 100 && <p className="mt-2 text-[9px] font-semibold text-[#3f7955]">Concluiu a rodada</p>}</div>)}{participants.length === 0 && <p className="rounded-xl bg-[#f6f8f7] p-3 text-[10px] text-[#7b8981]">Os participantes aparecerão aqui quando acessarem a rodada.</p>}</div></section>
        <section className="overflow-hidden rounded-2xl border border-[#dce5df] bg-white"><div className="border-b border-[#e8eeea] px-5 py-4"><p className="detail-label">Informações da rodada</p></div><div className="grid grid-cols-2 divide-x divide-[#e8eeea]"><div className="p-4"><span className="grid size-8 place-items-center rounded-xl bg-[#eef5f0] text-[#3b7655]"><CalendarDays className="size-3.5" /></span><p className="mt-3 text-[9px] text-[#7b8981]">Prazo final</p><p className="mt-1 text-xs font-semibold">{formatRoundDate(selectedRound.deadline)}</p></div><div className="p-4"><span className={`grid size-8 place-items-center rounded-xl ${bugCount > 0 ? 'bg-[#fff0ed] text-[#b04e40]' : 'bg-[#eef5f0] text-[#3b7655]'}`}><Bug className="size-3.5" /></span><p className="mt-3 text-[9px] text-[#7b8981]">Problemas</p><p className="mt-1 text-xs font-semibold">{bugCount} {bugCount === 1 ? 'encontrado' : 'encontrados'}</p></div></div><div className="border-t border-[#e8eeea] bg-[#f8faf9] px-4 py-3 text-[9px] text-[#78867e]">{selectedRound.items.length} testes no total · {tested} concluídos por você</div></section>
      </aside>
      </div>
    </>}

    <Dialog open={newRoundOpen} onOpenChange={setNewRoundOpen}><DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl"><form onSubmit={createRound}><DialogHeader className="border-b border-[#e4ebe7] px-6 py-5"><DialogTitle>Nova rodada de testes</DialogTitle><DialogDescription>Cadastre a entrega e adicione quantos testes forem necessários.</DialogDescription></DialogHeader><div className="space-y-5 px-6 py-5"><Field label="Nome da rodada"><Input name="title" required placeholder="Testes U+ — 010/26" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Versão"><Input name="version" required placeholder="U+ 010/26" /></Field><Field label="Prazo"><Input name="deadline" type="date" required /></Field></div><Field label="Orientações gerais"><Textarea name="description" placeholder="Explique o objetivo da rodada e os cuidados durante os testes." /></Field><section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">Testes a serem feitos</h3><p className="mt-1 text-xs text-[#78867e]">Cada teste fica em uma caixa separada dentro desta rodada.</p></div><Badge className="bg-[#edf5f0] text-[#397657]">{draftItems.length} {draftItems.length === 1 ? 'TESTE' : 'TESTES'}</Badge></div>{draftItems.map((item, index) => <div key={item.key} className="rounded-2xl border border-[#dce5df] bg-[#f8faf9] p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#173e2c] text-[10px] font-semibold text-white">{index + 1}</span><p className="text-xs font-semibold">Teste {index + 1}</p></div>{draftItems.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraftItems((current) => current.filter((entry) => entry.key !== item.key))} className="text-[#a34d40] hover:bg-[#fff0ed]">Remover</Button>}</div><div className="space-y-3"><Field label="Nome do teste"><Input required value={item.title} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, title: event.target.value } : entry))} placeholder="Ex.: Super Revisor — validação geral" /></Field><Field label="Caminho no sistema"><Input value={item.path} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, path: event.target.value } : entry))} placeholder="Ex.: Sua Conta > Configurações" /></Field><Field label="O que deve ser verificado"><Textarea value={item.description} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, description: event.target.value } : entry))} className="min-h-20" placeholder="Descreva como testar e qual resultado é esperado." /></Field></div></div>)}<Button type="button" variant="outline" onClick={() => setDraftItems((current) => current.length >= 50 ? current : [...current, { key: Date.now() + current.length, title: '', path: '', description: '' }])} disabled={draftItems.length >= 50} className="w-full border-dashed"><Plus /> Adicionar outro teste</Button></section></div><DialogFooter className="px-6"><Button type="button" variant="outline" onClick={() => setNewRoundOpen(false)}>Cancelar</Button><Button type="submit" disabled={savingRound} className="bg-[#173e2c] text-white">{savingRound ? <><LoaderCircle className="animate-spin" /> Criando...</> : <><Plus /> Criar rodada com {draftItems.length} {draftItems.length === 1 ? 'teste' : 'testes'}</>}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}><DialogContent className="p-0 sm:max-w-xl">{selectedItem && <form onSubmit={updateItem}><DialogHeader className="border-b border-[#e4ebe7] px-6 py-5"><DialogTitle>{selectedItem.title}</DialogTitle><DialogDescription>{selectedItem.path || `Item ${selectedItem.position} da rodada`} · sua resposta individual</DialogDescription></DialogHeader><div className="space-y-4 px-6 py-5">{selectedItem.description && <p className="rounded-xl bg-[#f5f8f6] p-4 text-xs leading-5 text-[#607067]">{selectedItem.description}</p>}<Field label="Meu resultado"><select name="status" defaultValue={selectedItem.status} className="form-select"><option>Pendente</option><option>Em teste</option><option>Aprovado</option><option>Com bug</option></select></Field><Field label="Minha observação"><Textarea name="note" defaultValue={selectedItem.result_note || ''} className="min-h-28" placeholder="Descreva o que você testou e o resultado encontrado." /></Field></div><DialogFooter className="px-6"><Button type="button" variant="outline" onClick={() => setSelectedItem(null)}>Cancelar</Button><Button type="submit" disabled={savingItem} className="bg-[#173e2c] text-white">{savingItem ? <><LoaderCircle className="animate-spin" /> Salvando...</> : <><Check /> Salvar minha resposta</>}</Button></DialogFooter></form>}</DialogContent></Dialog>
  </div>;
}

function VersionsView() {
  return <div>
    <div className="flex flex-col gap-3 rounded-2xl border border-[#d6e2da] bg-[linear-gradient(110deg,#ffffff_0%,#f4f8f5_100%)] px-4 py-3.5 shadow-[0_8px_24px_-25px_#173e2c] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f3ec] text-[#397657] ring-1 ring-[#d6e4da]"><FileArchive className="size-4" /></span>
        <p className="text-xs leading-5 text-[#68786f] sm:text-[13px]"><strong className="font-semibold text-[#30483a]">Centralize cada entrega</strong> com as alterações, os testes realizados e os reports relacionados em um único histórico.</p>
      </div>
      <Button variant="outline" className="shrink-0 border-[#cbdad1] bg-white text-[#294c39] hover:bg-[#f3f8f5]"><Plus /> Registrar versão</Button>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStat value="0" label="Versões registradas" tone="blue" /><MiniStat value="0" label="Versões em testes" tone="green" /><MiniStat value="0" label="Pendências atuais" tone="amber" /></div>
    <section className="mt-5 rounded-2xl border border-dashed border-[#cfdcd4] bg-white px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef5f0] text-[#397657]"><Code2 className="size-5" /></span><h2 className="mt-4 text-sm font-semibold">Nenhuma versão registrada</h2><p className="mt-1 text-xs text-[#78867e]">A linha do tempo começará com a primeira versão cadastrada pela equipe.</p></section>
  </div>;
}

function TeamView({ currentUserName, currentUserInitials }: { currentUserName: string; currentUserInitials: string }) {
  const members = [
    { name: currentUserName, role: 'Primeiro acesso', initials: currentUserInitials, open: 0, color: '#d7ff66', current: true },
  ];
  return <div>
    <div className="flex flex-col gap-3 rounded-2xl border border-[#d6e2da] bg-[linear-gradient(110deg,#ffffff_0%,#f4f8f5_100%)] px-4 py-3.5 shadow-[0_8px_24px_-25px_#173e2c] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f3ec] text-[#397657] ring-1 ring-[#d6e4da]"><Users className="size-4" /></span><p className="text-xs leading-5 text-[#68786f] sm:text-[13px]"><strong className="font-semibold text-[#30483a]">Organize as responsabilidades</strong> e acompanhe quem participa de cada etapa das rodadas e dos reports.</p></div>
      <Button variant="outline" className="shrink-0 border-[#cbdad1] bg-white text-[#294c39] hover:bg-[#f3f8f5]"><UserPlus /> Adicionar pessoa</Button>
    </div>

    <section className="mt-4 rounded-2xl border border-[#dce5df] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4d7c61]">Equipe cadastrada</p><p className="mt-1 text-xs text-[#78867e]">Pessoas com acesso ao ambiente de qualidade.</p></div><Badge className="bg-[#edf5f0] text-[#397657]">{members.length} {members.length === 1 ? 'PESSOA' : 'PESSOAS'}</Badge></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{members.map((member) => <article key={member.name} className="rounded-2xl border border-[#dce5df] bg-[linear-gradient(145deg,#ffffff,#f7faf8)] p-4 shadow-[0_12px_30px_-28px_#173e2c]"><div className="flex items-start justify-between"><span style={{ background: member.color }} className="grid size-11 place-items-center rounded-xl text-xs font-bold text-[#294033] shadow-sm">{member.initials}</span>{member.current && <Badge className="bg-[#edf7f0] text-[#377853]">VOCÊ</Badge>}</div><h2 className="mt-4 text-sm font-semibold">{member.name}</h2><p className="mt-1 text-xs text-[#78867e]">{member.role}</p><div className="mt-4 flex items-center justify-between border-t border-[#e7ede9] pt-3"><span className="text-[10px] text-[#849088]">Chamados ativos</span><span className="text-sm font-semibold">{member.open}</span></div></article>)}</div>
    </section>

    <section className="mt-5 overflow-hidden rounded-[22px] border border-[#d4e0d8] bg-white shadow-[0_18px_50px_-42px_#173e2c]">
      <div className="flex flex-col gap-3 border-b border-[#e2eae5] bg-[linear-gradient(110deg,#f7faf8,#edf5f0)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ShieldCheck className="size-4" /></span><div><h2 className="text-sm font-semibold text-[#263c30]">Fluxo da rodada de testes</h2><p className="mt-1 text-xs text-[#718078]">Da publicação da gerência até o encerramento ou reteste final.</p></div></div><Badge className="w-fit bg-white text-[#397657] ring-1 ring-[#d5e3da]">FLUXO OFICIAL</Badge></div>

      <div className="p-4 sm:p-5">
        <div className="grid items-stretch gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <WorkflowStep number="01" role="Gerência" description="Publica a rodada e define os testes." icon={Users} />
          <ChevronRight className="mx-auto hidden size-4 self-center text-[#7f998a] lg:block" />
          <WorkflowStep number="02" role="Suporte" description="Executa os testes e registra os resultados." icon={ListChecks} />
          <ChevronRight className="mx-auto hidden size-4 self-center text-[#7f998a] lg:block" />
          <WorkflowStep number="03" role="Gerência" description="Analisa as respostas recebidas." icon={ShieldCheck} />
        </div>

        <div className="my-4 flex items-center gap-3"><span className="h-px flex-1 bg-[#e3eae6]" /><span className="rounded-full bg-[#f1f5f2] px-3 py-1 text-[9px] font-bold uppercase tracking-[.1em] text-[#6c7e74]">Resultado da análise</span><span className="h-px flex-1 bg-[#e3eae6]" /></div>

        <div className="grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-[#cbe2d3] bg-[#f2faf4] p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#dcefe2] text-[#347650]"><CircleCheck className="size-4" /></span><div><p className="text-xs font-semibold text-[#2d6745]">Sem bug encontrado</p><p className="mt-0.5 text-[10px] text-[#688172]">A rodada termina na Gerência.</p></div></div><div className="mt-3 rounded-xl border border-[#d5e8db] bg-white p-3"><p className="text-[9px] font-bold uppercase tracking-[.1em] text-[#4b8060]">Encerramento</p><p className="mt-1 text-xs font-semibold">Gerência aprova e finaliza a rodada</p></div></div>

          <div className="rounded-2xl border border-[#ead9b4] bg-[#fffbf2] p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#ffedc8] text-[#98691a]"><Bug className="size-4" /></span><div><p className="text-xs font-semibold text-[#805b19]">Bug encontrado</p><p className="mt-0.5 text-[10px] text-[#87745a]">A correção segue até o reteste do Suporte.</p></div></div><div className="mt-3 grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr_auto_1fr]"><WorkflowStep compact number="04" role="Desenvolvimento" description="Corrige o bug." icon={Code2} /><ChevronRight className="mx-auto hidden size-4 self-center text-[#b18b4d] sm:block" /><WorkflowStep compact number="05" role="Gerência" description="Valida a correção." icon={ShieldCheck} /><ChevronRight className="mx-auto hidden size-4 self-center text-[#b18b4d] sm:block" /><WorkflowStep compact number="06" role="Suporte" description="Retesta e conclui." icon={CircleCheck} /></div></div>
        </div>
      </div>
    </section>
  </div>;
}

function WorkflowStep({ number, role, description, icon: Icon, compact = false }: { number: string; role: string; description: string; icon: typeof Users; compact?: boolean }) {
  return <div className={`rounded-xl border border-[#dce5df] bg-white ${compact ? 'p-3' : 'p-4'} shadow-[0_10px_25px_-25px_#173e2c]`}><div className="flex items-center justify-between gap-2"><span className="text-[9px] font-bold text-[#4a7c5d]">{number}</span><Icon className="size-3.5 text-[#678474]" /></div><p className={`${compact ? 'mt-2 text-[11px]' : 'mt-3 text-xs'} font-semibold text-[#2e4136]`}>{role}</p><p className="mt-1 text-[9px] leading-4 text-[#7a8981]">{description}</p></div>;
}

function ViewHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) { return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#4f7b62]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{title}</h2><p className="mt-1.5 max-w-2xl text-sm text-[#708078]">{description}</p></div>{action}</div>; }
function AccessGate({ loading = false }: { loading?: boolean }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError('');
    try {
      const response = await fetch('/api/demo-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível entrar');
      window.location.reload();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível entrar'); setSubmitting(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#edf6f0_0%,#f7f9f7_45%,#eef2ef_100%)] p-5"><section className="w-full max-w-md overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_30px_90px_-48px_#173e2c]"><div className="h-1.5 bg-[linear-gradient(90deg,#173e2c,#5a916b,#d7ff66)]" /><div className="p-7 sm:p-9"><div className="flex items-center gap-3"><span className="grid size-12 place-items-center rounded-2xl bg-[#173e2c] text-[#d7ff66] shadow-[0_12px_30px_-18px_#173e2c]"><ShieldCheck className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#5b8069]">GEHA Resolve</p><h1 className="mt-1 text-xl font-semibold tracking-[-.03em] text-[#1f3328]">Acesso corporativo</h1></div></div>{loading ? <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[#f4f7f5] p-4 text-xs text-[#65756c]"><LoaderCircle className="size-4 animate-spin text-[#397657]" /> Verificando sua sessão segura...</div> : <><p className="mt-7 text-sm leading-6 text-[#5e6e65]">Ambiente privado de demonstração. Use um e-mail corporativo autorizado para acessar.</p><form onSubmit={signIn} className="mt-5"><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#617469]">E-mail corporativo</label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu.nome@geha.com.br" required className="h-12 rounded-xl border-[#dbe6df] bg-[#f7faf8]" />{error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}<button type="submit" disabled={submitting} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173e2c] text-xs font-semibold text-white shadow-sm transition hover:bg-[#24573f] disabled:opacity-60">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Entrar na demonstração</button></form><div className="mt-5 flex justify-center gap-2 text-[9px] font-semibold text-[#5b8069]"><span>@geha.com.br</span><span>•</span><span>@horario.com.br</span></div><p className="mt-4 rounded-xl bg-[#f3f7f4] px-3 py-2 text-center text-[9px] leading-4 text-[#7b8981]">Modo demonstração · a confirmação por código será ativada no servidor oficial.</p></>}</div></section></main>;
}
function ReportMetric({ icon: Icon, label, value, tone }: { icon: typeof ShieldCheck; label: string; value: string; tone: 'green' | 'red' | 'blue' | 'amber' }) {
  const palette = tone === 'red' ? 'bg-[#fff0ed] text-[#a94a3c]' : tone === 'blue' ? 'bg-[#edf4fb] text-[#4775a0]' : tone === 'amber' ? 'bg-[#fff7e8] text-[#9a6a18]' : 'bg-[#eaf5ed] text-[#397657]';
  return <article className="flex min-w-0 items-center gap-3 rounded-2xl border border-[#dde6e0] bg-white p-3.5 shadow-[0_10px_30px_-28px_#173e2c]"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${palette}`}><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-[8px] font-bold uppercase tracking-[.1em] text-[#87948d]">{label}</span><span className="mt-1 block truncate text-[11px] font-semibold text-[#34473d]">{value}</span></span></article>;
}
function MiniStat({ value, label, tone }: { value: string; label: string; tone: string }) { return <article className="rounded-2xl border border-[#dce5df] bg-white p-4"><div className={`mb-3 h-1 w-9 rounded-full stat-${tone}`} /><p className="text-xl font-semibold tracking-[-.03em]">{value}</p><p className="mt-1 text-[11px] text-[#78867e]">{label}</p></article>; }
function InfoPanel({ icon: Icon, title, value, note }: { icon: typeof CalendarDays; title: string; value: string; note: string }) { return <section className="rounded-2xl border border-[#dce5df] bg-white p-5"><div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#eef5f0] text-[#3b7655]"><Icon className="size-4" /></span><div><p className="text-[10px] font-medium text-[#7b8981]">{title}</p><p className="mt-1 text-sm font-semibold">{value}</p><p className="mt-1 text-[10px] text-[#87938c]">{note}</p></div></div></section>; }

function InlineReportEditor({ blocks, onChange }: { blocks: ReportEditorBlock[]; onChange: (blocks: ReportEditorBlock[]) => void }) {
  function addImage(afterIndex: number, file?: File) {
    if (!file) return;
    const image: ReportEditorBlock = { key: Date.now(), type: 'image', file, preview: URL.createObjectURL(file), caption: '' };
    const text: ReportEditorBlock = { key: Date.now() + 1, type: 'text', value: '' };
    onChange([...blocks.slice(0, afterIndex + 1), image, text, ...blocks.slice(afterIndex + 1)]);
  }
  function removeImage(key: number) {
    const target = blocks.find((block) => block.key === key);
    if (target?.type === 'image') URL.revokeObjectURL(target.preview);
    onChange(blocks.filter((block) => block.key !== key));
  }
  return <div className="overflow-hidden rounded-2xl border border-[#ccd9d1] bg-white focus-within:border-[#769b84] focus-within:ring-2 focus-within:ring-[#769b8420]"><div className="flex items-center justify-between border-b border-[#e6ece8] bg-[#f6f9f7] px-4 py-2.5"><span className="text-[10px] font-semibold uppercase tracking-[.09em] text-[#63736a]">Texto e evidências</span><span className="text-[9px] font-normal text-[#87938c]">PNG, JPG ou WEBP · até 10 MB</span></div><div className="space-y-3 p-3">{blocks.map((block, index) => block.type === 'text' ? <div key={block.key}><Textarea value={block.value} onChange={(event) => onChange(blocks.map((entry) => entry.key === block.key && entry.type === 'text' ? { ...entry, value: event.target.value } : entry))} className="min-h-24 resize-y border-0 bg-transparent px-2 shadow-none focus-visible:ring-0" placeholder={index === 0 ? 'Descreva o que foi feito e o resultado encontrado...' : 'Continue explicando abaixo da imagem...'} /><button type="button" onClick={(event) => (event.currentTarget.nextElementSibling as HTMLInputElement | null)?.click()} className="mt-1 inline-flex items-center gap-2 rounded-lg border border-dashed border-[#b9cbbf] bg-[#f8fbf9] px-3 py-2 text-[10px] font-semibold text-[#3d7553] transition hover:border-[#78a087] hover:bg-[#f0f7f2]"><FileImage className="size-3.5" /> Inserir print neste ponto</button><input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { addImage(index, event.target.files?.[0]); event.currentTarget.value = ''; }} /></div> : <figure key={block.key} className="overflow-hidden rounded-xl border border-[#dce5df] bg-[#f5f8f6]"><div className="relative bg-[linear-gradient(135deg,#edf2ef,#f9fbfa)] p-3"><img src={block.preview} alt={block.caption || 'Prévia do print inserido'} className="mx-auto max-h-72 rounded-lg object-contain shadow-sm" /><button type="button" onClick={() => removeImage(block.key)} className="absolute right-2 top-2 rounded-lg bg-white/95 px-2.5 py-1.5 text-[9px] font-semibold text-[#a44b3e] shadow-sm">Remover</button></div><input value={block.caption} onChange={(event) => onChange(blocks.map((entry) => entry.key === block.key && entry.type === 'image' ? { ...entry, caption: event.target.value } : entry))} className="w-full border-0 border-t border-[#e1e8e4] bg-white px-3 py-2 text-[10px] outline-none" placeholder="Legenda da imagem (opcional)" /></figure>)}</div></div>;
}

function ReportDescription({ value, attachments }: { value: string; attachments: ReportDetail['attachments'] }) {
  let parsed: { version?: number; blocks?: Array<{ type?: string; value?: string; attachmentId?: string; caption?: string }> } | null = null;
  try { parsed = JSON.parse(value); } catch { parsed = null; }
  if (!parsed?.blocks || !Array.isArray(parsed.blocks)) return <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#3d4e45]">{value}</p>;
  return <div className="mt-3 space-y-4">{parsed.blocks.map((block, index) => block.type === 'image' && block.attachmentId ? <figure key={`${block.attachmentId}-${index}`} className="overflow-hidden rounded-xl border border-[#dce5df] bg-[#f5f8f6]"><a href={`/api/attachments/${encodeURIComponent(block.attachmentId)}`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${encodeURIComponent(block.attachmentId)}`} alt={block.caption || 'Print do erro'} className="max-h-[520px] w-full bg-[#edf2ef] object-contain" /></a>{block.caption && <figcaption className="border-t border-[#e1e8e4] bg-white px-3 py-2 text-[10px] text-[#68776f]">{block.caption}</figcaption>}</figure> : block.type === 'text' && block.value ? <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-[#3d4e45]">{block.value}</p> : null)}{attachments.filter((file) => file.kind === 'inline').length === 0 && parsed.blocks.some((block) => block.type === 'image') && <p className="text-[10px] text-[#9a5a4f]">Uma imagem deste texto não está mais disponível.</p>}</div>;
}

function FormSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="space-y-4"><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs text-[#78867e]">{description}</p></div>{children}</section>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-xs font-medium text-[#43564b]"><span>{label}</span>{children}</label>; }
function Timeline({ name, role, time, text, highlighted = false }: { name: string; role: string; time: string; text: string; highlighted?: boolean }) { return <div className="relative"><span className={`absolute -left-[26px] top-5 size-2.5 rounded-full ring-4 ring-white ${highlighted ? 'bg-[#d99a25]' : 'bg-[#4b8b65]'}`} /><article className={`rounded-2xl border p-3.5 transition hover:-translate-y-0.5 hover:shadow-[0_10px_25px_-24px_#173e2c] ${highlighted ? 'border-[#ead5a8] bg-[#fffbf2]' : 'border-[#e3eae6] bg-[#fbfcfb]'}`}><div className="flex items-start gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${highlighted ? 'bg-[#ffe7b3] text-[#7e5a16]' : 'bg-[#dfede4] text-[#3d6f50]'}`}>{initials(name)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1"><p className="text-[11px] font-semibold">{name} <span className="font-normal text-[#849088]">· {role}</span></p><time className="rounded-full bg-white px-2 py-1 text-[8px] font-medium text-[#8a968f]">{time}</time></div><p className="mt-2 text-[11px] leading-5 text-[#596960]">{text}</p></div></div></article></div>; }
function InfoCard({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#e5ebe7] bg-[#f8faf9] p-3"><p className="text-[8px] font-bold uppercase tracking-[.09em] text-[#829087]">{label}</p><p className="mt-1.5 text-[11px] font-semibold leading-4 text-[#405248]">{value}</p></div>; }
function Attachment({ id, name, size, csv = false }: { id?: string; name: string; size: string; csv?: boolean }) { const content = <><span className={`grid size-9 place-items-center rounded-xl ${csv ? 'bg-[#eaf5ed] text-[#347850]' : 'bg-[#eef3f9] text-[#4b7097]'}`}>{csv ? <FileArchive className="size-4" /> : <FileImage className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold">{name}</span><span className="mt-0.5 block text-[8px] text-[#8b978f]">{size} · clique para abrir</span></span><ChevronRight className="size-3.5 text-[#a0aca5]" /></>; return id ? <a href={`/api/attachments/${encodeURIComponent(id)}`} className="flex w-full items-center gap-2 rounded-xl border border-[#e1e8e4] bg-[#fbfcfb] p-2.5 text-left transition hover:border-[#bcd0c3] hover:bg-white hover:shadow-sm">{content}</a> : <span className="flex w-full items-center gap-2 rounded-xl border border-[#e1e8e4] p-2.5 text-left">{content}</span>; }
function OptionToggle({ checked, onChange, icon: Icon, title, description }: { checked: boolean; onChange: (value: boolean) => void; icon: typeof FileArchive; title: string; description: string }) { return <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${checked ? 'border-[#9fc3ac] bg-[#f0f8f2]' : 'border-[#dce5df] bg-white'}`}><span className={`grid size-9 place-items-center rounded-lg ${checked ? 'bg-[#dceddf] text-[#347951]' : 'bg-[#f0f2f1] text-[#8b9690]'}`}><Icon className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block text-xs font-semibold">{title}</strong><small className="mt-1 block text-[10px] text-[#7a8980]">{description}</small></span><span className={`relative h-5 w-9 rounded-full transition ${checked ? 'bg-[#347951]' : 'bg-[#cbd3ce]'}`}><span className={`absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition ${checked ? 'left-[18px]' : 'left-0.5'}`} /></span><span className="sr-only">{checked ? 'Sim' : 'Não'}</span></button>; }
function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: React.ReactNode }) { if (!open) return null; return <div className="fixed inset-0 z-50 grid place-items-center p-4"><button type="button" aria-label="Fechar janela" className="absolute inset-0 bg-[#0d1f17]/35 backdrop-blur-[2px]" onClick={() => onOpenChange(false)} /><div className="relative z-10 contents">{children}</div></div>; }
function DialogContent({ className = '', children }: { className?: string; children: React.ReactNode }) { return <div role="dialog" aria-modal="true" className={`relative w-full rounded-2xl bg-white text-[#16231d] shadow-[0_25px_80px_rgb(5_20_12/28%)] ring-1 ring-black/5 ${className}`}>{children}</div>; }
function DialogHeader({ className = '', children }: { className?: string; children: React.ReactNode }) { return <div className={className}>{children}</div>; }
function DialogTitle({ className = '', children }: { className?: string; children: React.ReactNode }) { return <h2 className={`font-semibold tracking-[-0.02em] ${className}`}>{children}</h2>; }
function DialogDescription({ className = '', children }: { className?: string; children: React.ReactNode }) { return <p className={`text-sm text-[#718078] ${className}`}>{children}</p>; }
function DialogFooter({ className = '', children }: { className?: string; children: React.ReactNode }) { return <div className={`flex flex-col-reverse gap-2 border-t border-[#e4ebe7] bg-[#f8faf9] py-4 sm:flex-row sm:justify-end ${className}`}>{children}</div>; }
function friendlyName(displayName?: string, email?: string) {
  const candidate = displayName || email;
  if (!candidate) return 'equipe';
  const clean = candidate.includes('@') ? candidate.split('@')[0] : candidate;
  return clean.trim().split(/\s+/)[0] || 'equipe';
}
function initials(name: string) {
  if (name === 'equipe') return 'EQ';
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}
function statusTone(status: string) { if (status === 'Corrigido') return 'green'; if (status === 'Aguardando reteste') return 'amber'; if (['Em análise', 'Em correção', 'Em teste'].includes(status)) return 'blue'; return 'red'; }
function formatRoundDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR'); }
function apiReportToItem(row: Record<string, unknown>): ReportItem { const email = String(row.author_email || 'EQ'); return { id: String(row.id), title: String(row.function_name || 'Report'), client: String(row.institution || 'Cliente não informado'), copy: String(row.copy_number || 'Sem cópia'), version: String(row.version || 'Sem versão'), status: String(row.status || 'Novo report'), tone: statusTone(String(row.status || 'Novo report')), owner: initials(email.includes('@') ? email.split('@')[0] : email).slice(0, 2), updated: formatDateTime(Number(row.updated_at || Date.now())), attachments: Number(row.attachment_count || 0), urgent: Number(row.urgent) === 1, canEdit: Number(row.can_edit) === 1, isOwner: Number(row.is_owner) === 1 }; }
function formatDateTime(value: number) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function actorName(email: string) { const local = email.split('@')[0].replace(/[._-]+/g, ' '); return local.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
