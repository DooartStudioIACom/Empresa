'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle, Bell, Bug, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, CircleCheck, Clock3, Code2, FileArchive, FileImage, FlaskConical, LayoutDashboard, ListChecks, LoaderCircle, MessageSquareText, MoreHorizontal, PackageCheck, Paperclip, PlayCircle, Plus, Search, ShieldCheck, UploadCloud, UserPlus, Users } from 'lucide-react';
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
type ReportItem = (typeof reports)[number];
type ReportDetail = {
  report: Record<string, string | number | null>;
  attachments: Array<{ id: string; file_name: string; content_type: string; byte_size: number; kind: string; created_at: number }>;
  activities: Array<{ id: string; actor_email: string; action: string; message: string | null; created_at: number }>;
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
  const [reportItems, setReportItems] = useState(reports);
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<(typeof reports)[number] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ displayName: string; email: string } | null>(null);
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
  const [formError, setFormError] = useState<string | null>(null);
  const [overviewRound, setOverviewRound] = useState<TestRound | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    fetch('/api/me')
      .then((response) => response.ok ? response.json() : null)
      .then((user) => user && setCurrentUser(user))
      .catch(() => undefined);
    const syncDashboard = async () => {
      const [reportResponse, roundResponse] = await Promise.allSettled([fetch('/api/reports'), fetch('/api/rounds')]);
      let synced = false;
      if (reportResponse.status === 'fulfilled' && reportResponse.value.ok) { const payload = await reportResponse.value.json(); setReportItems((payload.reports || []).map(apiReportToItem)); synced = true; }
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
    fetch('/api/rounds').then((response) => response.ok ? response.json() : null).then((payload: { rounds?: TestRound[] } | null) => payload?.rounds && setReportRounds(payload.rounds)).catch(() => undefined);
  }, [newReportOpen]);

  const userName = friendlyName(currentUser?.displayName, currentUser?.email);
  const userInitials = initials(userName);
  const pageTitle = activeSection === 'overview' ? `Olá, ${userName}` : nav.find((item) => item.id === activeSection)?.label;
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
    setReportDetail(null);
    setReplyNotice(null);
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
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#d7ff66]">Rodada ativa</p><p className="mt-2 text-sm font-semibold">Testes U+ — 009/26</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full w-[62%] rounded-full bg-[#d7ff66]" /></div>
          <div className="mt-2 flex justify-between text-[11px] text-white/50"><span>5 itens</span><span>62%</span></div>
        </div>
        <button className="flex items-center gap-3 border-t border-white/10 px-5 py-5 text-left">
          <span className="grid size-8 place-items-center rounded-full bg-[#e7b68d] text-xs font-semibold text-[#4a2a14]">{userInitials}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{currentUser?.displayName || 'Usuário conectado'}</span><span className="block text-[10px] text-white/45">Membro da equipe</span></span><MoreHorizontal className="size-4 text-white/40" />
        </button>
      </aside>

      <main className="lg:ml-[238px]">
        <header className="sticky top-0 z-10 flex h-[76px] items-center justify-between border-b border-[#dce5df] bg-[#f4f7f5]/90 px-5 backdrop-blur-xl sm:px-8">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#607168]">GEHA Resolve · Qualidade</p><h1 className="mt-1 text-xl font-semibold tracking-[-0.025em]">{pageTitle}</h1></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Notificações" className="relative size-9 rounded-xl bg-white"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef6a5b] ring-2 ring-white" /></Button>
            <Button onClick={() => setNewReportOpen(true)} className="h-9 rounded-xl bg-[#173e2c] px-4 text-white shadow-sm hover:bg-[#24573f]"><Plus className="size-4" /> Novo report</Button>
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
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-[#7b8981]">{report.id}</span>{report.id === 'BUG-2026-014' && <Badge className="h-[18px] bg-[#fff0ed] px-1.5 text-[9px] font-semibold text-[#b64738]">URGENTE</Badge>}</div><p className="mt-1 truncate text-[13px] font-semibold text-[#1d2e25]">{report.title}</p><p className="mt-1 truncate text-[11px] text-[#75847c]">{report.client} · {report.copy}</p></div>
                  <div className="hidden md:block"><p className="text-[11px] font-medium text-[#3f5148]">{report.version}</p><div className="mt-1 flex items-center gap-1 text-[10px] text-[#849088]"><Paperclip className="size-3" />{report.attachments} anexos</div></div>
                  <div className="hidden md:block"><span className={`status status-${report.tone}`}><span />{report.status}</span></div>
                  <div className="flex items-center justify-end gap-2 md:justify-start"><span className="grid size-7 place-items-center rounded-full bg-[#e6ece8] text-[9px] font-semibold text-[#385144]">{report.owner}</span><span className="hidden text-[10px] text-[#849088] xl:block">{report.updated}</span></div>
                  <ChevronRight className="hidden size-4 text-[#a1ada6] transition group-hover:translate-x-0.5 group-hover:text-[#426653] md:block" />
                </button>
              ))}
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
          </> : activeSection === 'reports' ? <ReportsView reports={reportItems} onSelect={openReport} onCreate={() => setNewReportOpen(true)} /> : activeSection === 'rounds' ? <RoundsView /> : activeSection === 'versions' ? <VersionsView /> : <TeamView currentUserName={currentUser?.displayName || userName} currentUserInitials={userInitials} />}
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
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl">
          {selectedReport && <>
            <DialogHeader className="border-b border-[#e4ebe7] px-6 py-5">
              <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] font-semibold text-[#75847c]">{selectedReport.id}</span><span className={`status status-${selectedReport.tone}`}><span />{selectedReport.status}</span></div>
              <DialogTitle className="mt-2 text-xl">{selectedReport.title}</DialogTitle><DialogDescription>{String(reportDetail?.report.institution || selectedReport.client)} · Cópia {String(reportDetail?.report.copy_number || selectedReport.copy)} · {String(reportDetail?.report.version || selectedReport.version)}</DialogDescription>
            </DialogHeader>
            {detailLoading && <div className="flex items-center justify-center gap-2 py-12 text-xs text-[#718078]"><LoaderCircle className="size-4 animate-spin" /> Carregando report...</div>}
            {!detailLoading && <div className="grid gap-6 px-6 py-5 md:grid-cols-[1fr_220px]">
              <div className="space-y-5">
                <div><p className="detail-label">Descrição do erro</p><ReportDescription value={String(reportDetail?.report.description || 'Cliente tenta realizar a operação e o sistema apresenta um erro, impedindo a conclusão.')} attachments={reportDetail?.attachments || []} /></div>
                <div><p className="detail-label">Caminho</p><p className="mt-2 rounded-lg bg-[#f4f7f5] px-3 py-2 font-mono text-xs text-[#405449]">{String(reportDetail?.report.system_path || 'Caminho informado no report')}</p></div>
                <div><p className="detail-label">Linha do tempo</p><div className="mt-3 space-y-4 border-l border-[#dce5df] pl-5">
                  {reportDetail?.activities.length ? reportDetail.activities.map((activity) => <Timeline key={activity.id} name={actorName(activity.actor_email)} role={activity.action === 'status_update' ? 'Atualização de status' : activity.action === 'attachment_added' ? 'Anexo' : 'Equipe'} time={formatDateTime(activity.created_at)} text={activity.message || 'Atualização registrada.'} highlighted={activity.action === 'status_update'} />) : <Timeline name="Equipe GEHA" role="Suporte" time="Histórico inicial" text="Report registrado para análise da equipe." />}
                </div></div>
                {reportDetail && <form onSubmit={sendReply} className="rounded-xl border border-[#dce5df] p-3"><Textarea name="message" placeholder="Escreva uma resposta ou o resultado do reteste..." className="min-h-20 border-0 p-1 shadow-none focus-visible:ring-0" /><div className="mt-2 grid gap-2 border-t border-[#edf1ef] pt-3 sm:grid-cols-[1fr_180px_auto]"><Input name="attachment" type="file" className="h-8 text-[10px]" aria-label="Anexar arquivo à resposta" /><select name="status" defaultValue={selectedReport.status} className="form-select"><option>Novo report</option><option>Em análise</option><option>Em correção</option><option>Aguardando reteste</option><option>Corrigido</option><option>Ainda ocorre</option></select><Button type="submit" disabled={replying} size="sm" className="bg-[#173e2c] text-white">{replying ? <LoaderCircle className="animate-spin" /> : <MessageSquareText />} {replying ? 'Enviando...' : 'Responder'}</Button></div>{replyNotice && <div role="status" className={`mt-3 rounded-lg border px-3 py-2 text-[11px] ${replyNotice.tone === 'success' ? 'border-[#bfddc9] bg-[#eef8f1] text-[#2f7048]' : 'border-[#efc3bb] bg-[#fff2ef] text-[#9e3e31]'}`}>{replyNotice.message}</div>}</form>}
              </div>
              <aside className="space-y-4">{Number(reportDetail?.report.from_test_round) === 1 && <section className="rounded-xl border border-[#cfe0d5] bg-[#f2f8f4] p-4"><div className="flex items-center gap-2"><ListChecks className="size-4 text-[#397657]" /><p className="detail-label text-[#397657]">Bug de rodada</p></div><p className="mt-3 text-xs font-semibold">{String(reportDetail?.report.test_round_title || '')}</p><p className="mt-1 text-[10px] text-[#718078]">{String(reportDetail?.report.test_round_version || '')}</p><div className="mt-3 rounded-lg bg-white px-3 py-2"><p className="text-[9px] font-semibold uppercase text-[#849088]">Teste relacionado</p><p className="mt-1 text-[10px] font-semibold text-[#405449]">{String(reportDetail?.report.test_item_title || '')}</p></div></section>}<InfoCard label="Responsável" value="Desenvolvimento" /><InfoCard label="Urgência" value={Number(reportDetail?.report.urgent) === 1 ? 'Sim — prioritário' : 'Normal'} /><InfoCard label="Ambiente beta" value={String(reportDetail?.report.beta_status || 'Não testado')} />{reportDetail && <><InfoCard label="Possui cópia?" value={reportDetail.attachments.some((file) => file.kind === 'backup') ? 'Sim' : 'Não'} /><InfoCard label="Possui anexos?" value={reportDetail.attachments.some((file) => file.kind !== 'backup') ? 'Sim' : 'Não'} /></>}<div><p className="detail-label">Arquivos</p><div className="mt-2 space-y-2">{reportDetail?.attachments.length ? reportDetail.attachments.map((file) => <Attachment key={file.id} id={file.id} name={file.file_name} size={formatBytes(file.byte_size)} csv={file.kind === 'backup'} />) : <p className="rounded-lg bg-[#f4f7f5] p-3 text-[10px] text-[#7b8981]">Nenhum arquivo anexado.</p>}</div></div></aside>
            </div>}
          </>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportsView({ reports, onSelect, onCreate }: { reports: ReportItem[]; onSelect: (report: ReportItem) => void; onCreate: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const filteredReports = reports.filter((report) => {
    const haystack = `${report.id} ${report.title} ${report.client} ${report.copy} ${report.version}`.toLocaleLowerCase('pt-BR');
    const matchesQuery = haystack.includes(query.toLocaleLowerCase('pt-BR'));
    const matchesFilter = filter === 'Todos' || (filter === 'Novos' && report.status === 'Novo report') || (filter === 'Em andamento' && ['Em análise', 'Em correção', 'Em teste'].includes(report.status)) || (filter === 'Reteste' && report.status === 'Aguardando reteste') || (filter === 'Corrigidos' && report.status === 'Corrigido');
    return matchesQuery && matchesFilter;
  });
  return <div>
    <ViewHeading eyebrow="Central de chamados" title="Todos os reports" description="Acompanhe cada problema desde o envio do Suporte até o reteste final." action={<Button onClick={onCreate} className="bg-[#173e2c] text-white"><Plus /> Novo report</Button>} />
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><MiniStat value={String(reports.filter((report) => report.status !== 'Corrigido').length)} label="Reports abertos" tone="red" /><MiniStat value={String(reports.filter((report) => report.status === 'Aguardando reteste').length)} label="Aguardando reteste" tone="amber" /><MiniStat value={String(reports.filter((report) => report.status === 'Corrigido').length)} label="Reports corrigidos" tone="green" /></div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#dce5df] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e4ebe7] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">{['Todos', 'Novos', 'Em andamento', 'Reteste', 'Corrigidos'].map((item) => <button onClick={() => setFilter(item)} key={item} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${filter === item ? 'bg-[#173e2c] text-white' : 'bg-[#f0f4f1] text-[#64756b] hover:bg-[#e5ece7]'}`}>{item}</button>)}</div>
        <div className="relative sm:w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cliente, função ou ID" aria-label="Buscar reports" className="h-9 rounded-xl bg-[#f8faf9] pl-8" /></div>
      </div>
      <div className="hidden grid-cols-[1.4fr_.65fr_.6fr_.4fr] gap-4 border-b border-[#e9eeeb] bg-[#fafcfb] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.1em] text-[#829087] md:grid"><span>Report</span><span>Versão / anexos</span><span>Status</span><span>Responsável</span></div>
      <div className="divide-y divide-[#e9eeeb]">{filteredReports.map((report) => <button key={report.id} onClick={() => onSelect(report)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left hover:bg-[#f8faf9] md:grid-cols-[1.4fr_.65fr_.6fr_.4fr]">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-[#78877f]">{report.id}</span>{report.id === 'BUG-2026-014' && <Badge className="h-[18px] bg-[#fff0ed] px-1.5 text-[9px] text-[#b64738]">URGENTE</Badge>}</div><p className="mt-1 truncate text-[13px] font-semibold">{report.title}</p><p className="mt-1 truncate text-[11px] text-[#75847c]">{report.client} · {report.copy}</p></div>
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
    <ViewHeading eyebrow="Planejamento de qualidade" title="Rodadas de testes" description="Organize os itens enviados pela gerência e acompanhe o resultado de cada teste." action={<Button type="button" onClick={() => setNewRoundOpen(true)} className="bg-[#173e2c] text-white"><Plus /> Nova rodada</Button>} />
    {notice && <div role="status" className={`mt-5 rounded-xl border px-4 py-3 text-xs ${notice.tone === 'success' ? 'border-[#bfddc9] bg-[#eef8f1] text-[#2f7048]' : 'border-[#efc3bb] bg-[#fff2ef] text-[#9e3e31]'}`}>{notice.message}</div>}
    {loading ? <div className="mt-10 flex items-center justify-center gap-2 text-xs text-[#718078]"><LoaderCircle className="size-4 animate-spin" /> Carregando rodadas...</div> : !selectedRound ? <section className="mt-6 rounded-2xl border border-dashed border-[#cfdcd4] bg-white px-6 py-14 text-center"><ListChecks className="mx-auto size-7 text-[#668274]" /><h3 className="mt-4 text-sm font-semibold">Nenhuma rodada cadastrada</h3><p className="mt-2 text-xs text-[#78867e]">Crie a primeira rodada com os itens que chegaram da gerência.</p><Button type="button" onClick={() => setNewRoundOpen(true)} className="mt-5 bg-[#173e2c] text-white"><Plus /> Criar rodada</Button></section> : <div className="mt-6 grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-[24px] border border-[#294a39] bg-[#123222] text-white shadow-[0_22px_60px_-38px_#173e2c]">
          <div className="grid min-h-[330px] lg:grid-cols-[1fr_330px]">
            <div className="relative z-10 flex flex-col justify-center p-6 sm:p-8">
              <div className="flex flex-wrap items-center gap-2"><Badge className={beaconPowered ? 'bg-[#d7ff66] text-[#173e2c]' : 'bg-white/12 text-white'}>{selectedRound.status.toUpperCase()}</Badge><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[.12em] text-white/55"><span className={`size-1.5 rounded-full ${beaconPowered ? 'animate-pulse bg-[#d7ff66]' : 'bg-white/35'}`} />{beaconPowered ? 'Farol de qualidade ativo' : 'Aguardando primeiro teste'}</span></div>
              <h2 className="mt-5 text-2xl font-semibold tracking-[-.035em] sm:text-3xl">{selectedRound.title}</h2>
              <p className="mt-2 text-xs text-white/55">{selectedRound.version} · prazo {formatRoundDate(selectedRound.deadline)}</p>
              {selectedRound.description && <p className="mt-4 max-w-2xl text-xs leading-5 text-white/68">{selectedRound.description}</p>}
              <div className="mt-8 max-w-2xl"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-white/45">Meu progresso</p><p className="mt-1 text-sm font-semibold">{tested} de {selectedRound.items.length} testes concluídos por você</p></div><span className="text-4xl font-semibold tracking-[-.07em] text-[#d7ff66]">{progress}%</span></div><div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/5"><div style={{ width: `${progress}%` }} className="h-full rounded-full bg-[linear-gradient(90deg,#68b27f,#d7ff66)] shadow-[0_0_16px_#d7ff6690] transition-[width] duration-700" /></div></div>
            </div>
            <div className="relative hidden min-h-[330px] place-items-center overflow-hidden bg-[radial-gradient(circle,#2c6444_0%,#173e2c_48%,#123222_74%)] lg:grid">
              <div className={`absolute size-[260px] rounded-full ${beaconPowered ? 'beacon-light-ring' : 'bg-white/[.025]'}`} />
              <div className="absolute size-[290px] rounded-full border border-white/[.07]" />
              <div className="relative grid size-[300px] place-items-center">
                <img src={beaconPowered ? '/rounds/quality-beacon-on.png' : '/rounds/quality-beacon-off.png'} alt={beaconPowered ? 'Farol de qualidade aceso' : 'Farol de qualidade apagado'} className={`max-h-[285px] max-w-[285px] object-contain ${beaconPowered ? 'beacon-on' : 'opacity-75 saturate-75'}`} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[pendingCount,'Pendentes','#7b8981','#f4f6f5'],[testingCount,'Em teste','#3970a6','#eef5ff'],[approvedCount,'Aprovados','#347951','#edf8f0'],[bugCount,'Com bug','#b64738','#fff0ed']].map(([value,label,color,background]) => <article key={String(label)} style={{ background: String(background) }} className="rounded-2xl border border-white p-4 shadow-[0_8px_25px_-22px_#173e2c]"><div className="flex items-center justify-between"><p style={{ color: String(color) }} className="text-2xl font-semibold tracking-[-.05em]">{value}</p><span style={{ background: String(color) }} className="size-2 rounded-full opacity-70" /></div><p className="mt-1 text-[10px] font-semibold uppercase tracking-[.08em] text-[#78867e]">{label}</p></article>)}</div>

        <section className="overflow-hidden rounded-[22px] border border-[#dce5df] bg-white">
          <div className="border-b border-[#e7ede9] bg-[linear-gradient(135deg,#fbfdfb_0%,#f0f6f2_100%)] p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ListChecks className="size-4" /></span><p className="detail-label">Plano de testes</p></div><h3 className="mt-3 text-lg font-semibold tracking-[-.025em]">Roteiro desta rodada</h3><p className="mt-1 text-xs text-[#718078]">Consulte as instruções, execute o cenário e registre a evidência em cada item.</p></div><div className="flex items-center gap-3 rounded-2xl border border-[#dbe6df] bg-white px-4 py-3 shadow-sm"><div className="relative size-11"><svg viewBox="0 0 40 40" className="size-11 -rotate-90"><circle cx="20" cy="20" r="16" fill="none" stroke="#e8eeea" strokeWidth="4" /><circle cx="20" cy="20" r="16" fill="none" stroke="#4b8a62" strokeWidth="4" strokeLinecap="round" strokeDasharray={`${progress} 100`} pathLength="100" /></svg><span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-[#315c42]">{progress}%</span></div><div><p className="text-xs font-semibold">{tested} concluídos</p><p className="mt-0.5 text-[9px] text-[#829087]">de {selectedRound.items.length} testes</p></div></div></div>
            <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex flex-wrap gap-1.5">{['Todos','Pendente','Em teste','Aprovado','Com bug'].map((filter) => { const count = filter === 'Todos' ? selectedRound.items.length : selectedRound.items.filter((item) => item.status === filter).length; return <button type="button" onClick={() => setItemFilter(filter)} key={filter} className={`rounded-lg px-3 py-2 text-[10px] font-semibold transition ${itemFilter === filter ? 'bg-[#173e2c] text-white shadow-sm' : 'border border-[#dfe7e2] bg-white text-[#6d7d74] hover:border-[#b8cbbf]'}`}>{filter} <span className={`ml-1 ${itemFilter === filter ? 'text-[#d7ff66]' : 'text-[#9aa69f]'}`}>{count}</span></button>; })}</div><div className="relative w-full lg:w-64"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Buscar teste ou caminho" className="h-9 rounded-xl bg-white pl-9 text-xs" /></div></div>
          </div>
          <div className="p-4 sm:p-5"><div className="grid gap-3">{visibleItems.map((item) => { const done = ['Aprovado', 'Com bug'].includes(item.status); const statusColor = item.status === 'Aprovado' ? '#4b8a62' : item.status === 'Com bug' ? '#c15b4a' : item.status === 'Em teste' ? '#4c7ead' : '#9aa69f'; return <button type="button" onClick={() => setSelectedItem(item)} key={item.id} className="group relative overflow-hidden rounded-2xl border border-[#e1e9e4] bg-[#fbfcfb] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#b5c9bc] hover:bg-white hover:shadow-[0_14px_35px_-26px_#173e2c]"><span style={{ background: statusColor }} className="absolute inset-y-0 left-0 w-1" /><div className="grid gap-4 pl-1 sm:grid-cols-[42px_1fr_auto]"><span className={`grid size-10 place-items-center rounded-xl ${item.status === 'Aprovado' ? 'bg-[#e9f5ed] text-[#367a52]' : item.status === 'Com bug' ? 'bg-[#fff0ed] text-[#a94a3c]' : item.status === 'Em teste' ? 'bg-[#eaf2fb] text-[#3f72a2]' : 'bg-[#f0f3f1] text-[#89958e]'}`}>{done ? item.status === 'Aprovado' ? <CheckCircle2 className="size-5" /> : <Bug className="size-4" /> : item.status === 'Em teste' ? <PlayCircle className="size-4" /> : <span className="text-xs font-semibold">{String(item.position).padStart(2, '0')}</span>}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-[13px] font-semibold text-[#263a2e]">{item.title}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${item.status === 'Aprovado' ? 'bg-[#e9f5ed] text-[#3e8058]' : item.status === 'Com bug' ? 'bg-[#fff0ed] text-[#a94a3c]' : item.status === 'Em teste' ? 'bg-[#eaf2fb] text-[#3f72a2]' : 'bg-[#f0f3f1] text-[#7e8b84]'}`}>{item.status}</span></span><span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-[#74837b]"><ChevronRight className="size-3" />{item.path || `Item ${item.position} de ${selectedRound.items.length}`}</span>{item.description && <span className="mt-3 line-clamp-2 block text-[10px] leading-4 text-[#65756c]">{item.description}</span>}{item.result_note && <span className="mt-3 block rounded-xl border border-[#e3eae6] bg-white px-3 py-2 text-[10px] leading-4 text-[#586960]"><strong className="mr-1 font-semibold text-[#34483d]">Resultado:</strong>{item.result_note}</span>}</span><span className="flex items-center justify-between gap-3 self-center border-t border-[#edf1ef] pt-3 sm:flex-col sm:items-end sm:border-0 sm:pt-0"><span className="text-[9px] text-[#87938c]">{item.tester_email ? `Testado por ${item.tester_email.split('@')[0]}` : 'Sem responsável'}</span><span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#3f6d54]">Abrir teste <ChevronRight className="size-3.5 transition group-hover:translate-x-0.5" /></span></span></div></button>; })}{visibleItems.length === 0 && <div className="rounded-2xl border border-dashed border-[#cfdcd4] py-12 text-center"><Search className="mx-auto size-5 text-[#97a49d]" /><p className="mt-3 text-xs font-semibold">Nenhum teste encontrado</p><p className="mt-1 text-[10px] text-[#87938c]">Altere o filtro ou o termo pesquisado.</p></div>}</div></div>
        </section>
      </div>
      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <section className={`rounded-2xl border p-5 ${nextAction.tone === 'green' ? 'border-[#c9e1d1] bg-[#eef8f1]' : nextAction.tone === 'red' ? 'border-[#f0cbc4] bg-[#fff3f0]' : nextAction.tone === 'blue' ? 'border-[#cbdced] bg-[#f1f7fd]' : 'border-[#ead9b4] bg-[#fff9eb]'}`}><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white/80 text-[#375a46]">{progress === 100 ? <CheckCircle2 className="size-4" /> : bugCount > 0 ? <Bug className="size-4" /> : <PlayCircle className="size-4" />}</span><div><p className="text-xs font-semibold">{nextAction.title}</p><p className="mt-1 text-[10px] leading-4 text-[#68776f]">{nextAction.text}</p></div></div></section>
        <section className="rounded-2xl border border-[#dce5df] bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="detail-label">Progresso da equipe</p><h3 className="mt-1.5 text-sm font-semibold">{completedParticipants.length} de {participants.length} concluíram</h3></div><span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Users className="size-4" /></span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#edf1ef]"><div style={{ width: `${participants.length ? Math.round((completedParticipants.length / participants.length) * 100) : 0}%` }} className="h-full rounded-full bg-[#4b8a62] transition-[width] duration-700" /></div><div className="mt-4 space-y-3">{participants.map((participant) => <div key={participant.user_id} className={`rounded-xl border p-3 ${participant.is_current ? 'border-[#c9ddd0] bg-[#f5faf7]' : 'border-[#e6ece8]'}`}><div className="flex items-center gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-[9px] font-bold ${participant.progress === 100 ? 'bg-[#d7ff66] text-[#244c35]' : 'bg-[#e9eeeb] text-[#5d6d64]'}`}>{participant.progress === 100 ? <Check className="size-4" /> : initials(participant.user_name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="block truncate text-[11px] font-semibold">{participant.user_name}</span>{participant.is_current && <span className="text-[8px] font-bold uppercase text-[#4b8a62]">Você</span>}</span><span className="mt-0.5 block text-[9px] text-[#87938c]">{Number(participant.done_items)} de {Number(participant.total_items)} testes</span></span><span className={`text-[10px] font-semibold ${participant.progress === 100 ? 'text-[#3d8057]' : 'text-[#6f7e76]'}`}>{participant.progress}%</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e8eeea]"><div style={{ width: `${participant.progress}%` }} className={`h-full rounded-full ${Number(participant.bug_items) > 0 ? 'bg-[#cf6a59]' : participant.progress === 100 ? 'bg-[#4b8a62]' : 'bg-[#7aa2c5]'}`} /></div>{participant.progress === 100 && <p className="mt-2 text-[9px] font-semibold text-[#3f7955]">Concluiu a rodada</p>}</div>)}{participants.length === 0 && <p className="rounded-xl bg-[#f6f8f7] p-3 text-[10px] text-[#7b8981]">Os participantes aparecerão aqui quando acessarem a rodada.</p>}</div></section>
        <InfoPanel icon={CalendarDays} title="Prazo da rodada" value={formatRoundDate(selectedRound.deadline)} note={`${selectedRound.items.length} itens · ${tested} concluídos`} />
        <InfoPanel icon={Bug} title="Problemas encontrados" value={`${bugCount} ${bugCount === 1 ? 'item' : 'itens'}`} note="Resultados marcados como Com bug" />
        <section className="rounded-2xl border border-[#dce5df] bg-white p-5"><div className="flex items-center justify-between"><p className="detail-label">Todas as rodadas</p><span className="text-[10px] font-semibold text-[#6f7f76]">{rounds.length}</span></div><div className="mt-3 space-y-2">{rounds.map((round) => <button type="button" onClick={() => setSelectedRoundId(round.id)} key={round.id} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${round.id === selectedRound.id ? 'bg-[#edf5f0] text-[#2f7048]' : 'hover:bg-[#f7f9f8]'}`}><span className={`grid size-8 shrink-0 place-items-center rounded-lg ${round.id === selectedRound.id ? 'bg-white' : 'bg-[#f0f4f1]'}`}><PackageCheck className="size-4 text-[#56806a]" /></span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{round.version}</span><span className="mt-0.5 block truncate text-[9px] text-[#87938c]">{round.title}</span></span><span className="text-[9px] text-[#849088]">{round.status}</span></button>)}</div></section>
      </aside>
    </div>}

    <Dialog open={newRoundOpen} onOpenChange={setNewRoundOpen}><DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-3xl"><form onSubmit={createRound}><DialogHeader className="border-b border-[#e4ebe7] px-6 py-5"><DialogTitle>Nova rodada de testes</DialogTitle><DialogDescription>Cadastre a entrega e adicione quantos testes forem necessários.</DialogDescription></DialogHeader><div className="space-y-5 px-6 py-5"><Field label="Nome da rodada"><Input name="title" required placeholder="Testes U+ — 010/26" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Versão"><Input name="version" required placeholder="U+ 010/26" /></Field><Field label="Prazo"><Input name="deadline" type="date" required /></Field></div><Field label="Orientações gerais"><Textarea name="description" placeholder="Explique o objetivo da rodada e os cuidados durante os testes." /></Field><section className="space-y-3"><div className="flex items-end justify-between gap-3"><div><h3 className="text-sm font-semibold">Testes a serem feitos</h3><p className="mt-1 text-xs text-[#78867e]">Cada teste fica em uma caixa separada dentro desta rodada.</p></div><Badge className="bg-[#edf5f0] text-[#397657]">{draftItems.length} {draftItems.length === 1 ? 'TESTE' : 'TESTES'}</Badge></div>{draftItems.map((item, index) => <div key={item.key} className="rounded-2xl border border-[#dce5df] bg-[#f8faf9] p-4"><div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-[#173e2c] text-[10px] font-semibold text-white">{index + 1}</span><p className="text-xs font-semibold">Teste {index + 1}</p></div>{draftItems.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraftItems((current) => current.filter((entry) => entry.key !== item.key))} className="text-[#a34d40] hover:bg-[#fff0ed]">Remover</Button>}</div><div className="space-y-3"><Field label="Nome do teste"><Input required value={item.title} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, title: event.target.value } : entry))} placeholder="Ex.: Super Revisor — validação geral" /></Field><Field label="Caminho no sistema"><Input value={item.path} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, path: event.target.value } : entry))} placeholder="Ex.: Sua Conta > Configurações" /></Field><Field label="O que deve ser verificado"><Textarea value={item.description} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, description: event.target.value } : entry))} className="min-h-20" placeholder="Descreva como testar e qual resultado é esperado." /></Field></div></div>)}<Button type="button" variant="outline" onClick={() => setDraftItems((current) => current.length >= 50 ? current : [...current, { key: Date.now() + current.length, title: '', path: '', description: '' }])} disabled={draftItems.length >= 50} className="w-full border-dashed"><Plus /> Adicionar outro teste</Button></section></div><DialogFooter className="px-6"><Button type="button" variant="outline" onClick={() => setNewRoundOpen(false)}>Cancelar</Button><Button type="submit" disabled={savingRound} className="bg-[#173e2c] text-white">{savingRound ? <><LoaderCircle className="animate-spin" /> Criando...</> : <><Plus /> Criar rodada com {draftItems.length} {draftItems.length === 1 ? 'teste' : 'testes'}</>}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}><DialogContent className="p-0 sm:max-w-xl">{selectedItem && <form onSubmit={updateItem}><DialogHeader className="border-b border-[#e4ebe7] px-6 py-5"><DialogTitle>{selectedItem.title}</DialogTitle><DialogDescription>{selectedItem.path || `Item ${selectedItem.position} da rodada`} · sua resposta individual</DialogDescription></DialogHeader><div className="space-y-4 px-6 py-5">{selectedItem.description && <p className="rounded-xl bg-[#f5f8f6] p-4 text-xs leading-5 text-[#607067]">{selectedItem.description}</p>}<Field label="Meu resultado"><select name="status" defaultValue={selectedItem.status} className="form-select"><option>Pendente</option><option>Em teste</option><option>Aprovado</option><option>Com bug</option></select></Field><Field label="Minha observação"><Textarea name="note" defaultValue={selectedItem.result_note || ''} className="min-h-28" placeholder="Descreva o que você testou e o resultado encontrado." /></Field></div><DialogFooter className="px-6"><Button type="button" variant="outline" onClick={() => setSelectedItem(null)}>Cancelar</Button><Button type="submit" disabled={savingItem} className="bg-[#173e2c] text-white">{savingItem ? <><LoaderCircle className="animate-spin" /> Salvando...</> : <><Check /> Salvar minha resposta</>}</Button></DialogFooter></form>}</DialogContent></Dialog>
  </div>;
}

function VersionsView() {
  const versions = [
    { name: 'U+ 009/26', date: '03 ago 2026', status: 'Em testes', tone: 'blue', reports: '3 reports', notes: 'Super Revisor, perfis de acesso, aviso de recursos e melhorias de usabilidade.' },
    { name: 'U+ 008/26', date: '30 jul 2026', status: 'Aprovada', tone: 'green', reports: '2 corrigidos', notes: 'Ajustes em Controles e melhorias na validação de salas.' },
    { name: 'U+ 007/26', date: '17 jul 2026', status: 'Publicada', tone: 'green', reports: 'Sem pendências', notes: 'Correções gerais e melhorias de estabilidade.' },
    { name: 'U+ 006/26', date: '03 jul 2026', status: 'Arquivada', tone: 'amber', reports: '4 corrigidos', notes: 'Ciclo encerrado e histórico preservado.' },
  ];
  return <div><ViewHeading eyebrow="Histórico de entregas" title="Versões do U+" description="Veja o que mudou, os testes executados e os bugs relacionados a cada versão." action={<Button variant="outline"><Plus /> Registrar versão</Button>} />
    <div className="mt-6 grid gap-3 sm:grid-cols-3"><MiniStat value="009/26" label="Versão em testes" tone="blue" /><MiniStat value="8" label="Versões em 2026" tone="green" /><MiniStat value="3" label="Pendências atuais" tone="amber" /></div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#dce5df] bg-white"><div className="border-b border-[#e4ebe7] px-5 py-4"><h2 className="text-sm font-semibold">Linha do tempo de versões</h2><p className="mt-1 text-xs text-[#78867e]">Da versão mais recente para a mais antiga</p></div><div className="divide-y divide-[#e9eeeb]">{versions.map((version, index) => <button key={version.name} className="grid w-full gap-3 px-5 py-5 text-left hover:bg-[#f8faf9] md:grid-cols-[55px_150px_1fr_120px_20px] md:items-center"><span className="relative grid size-10 place-items-center rounded-xl bg-[#eef4f0] text-[#3f6d54]"><Code2 className="size-4" />{index < versions.length - 1 && <span className="absolute left-1/2 top-10 hidden h-8 w-px bg-[#dce5df] md:block" />}</span><span><span className="block text-sm font-semibold">{version.name}</span><span className="mt-1 block text-[10px] text-[#849088]">{version.date}</span></span><span className="text-xs leading-5 text-[#5f7067]">{version.notes}</span><span><span className={`status status-${version.tone}`}><span />{version.status}</span><small className="mt-1.5 block text-[9px] text-[#89958e]">{version.reports}</small></span><ChevronRight className="size-4 text-[#a2ada7]" /></button>)}</div></section>
  </div>;
}

function TeamView({ currentUserName, currentUserInitials }: { currentUserName: string; currentUserInitials: string }) {
  const members = [
    { name: currentUserName, role: 'Qualidade', initials: currentUserInitials, open: 4, color: '#d7ff66', current: true },
    { name: 'Bruno Milfont', role: 'Gerência', initials: 'BM', open: 3, color: '#dce8ff' },
    { name: 'George Martins', role: 'Desenvolvimento', initials: 'GM', open: 5, color: '#ffe5c9' },
    { name: 'Jhoni Duarte', role: 'Suporte', initials: 'JD', open: 2, color: '#eadfff' },
  ];
  return <div><ViewHeading eyebrow="Pessoas e responsabilidades" title="Equipe" description="Acompanhe quem reporta, corrige, testa e aprova cada chamado." action={<Button variant="outline"><UserPlus /> Adicionar pessoa</Button>} />
    <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{members.map((member) => <article key={member.name} className="rounded-2xl border border-[#dce5df] bg-white p-5"><div className="flex items-start justify-between"><span style={{ background: member.color }} className="grid size-11 place-items-center rounded-full text-xs font-bold text-[#294033]">{member.initials}</span>{member.current && <Badge className="bg-[#edf7f0] text-[#377853]">VOCÊ</Badge>}</div><h2 className="mt-4 text-sm font-semibold">{member.name}</h2><p className="mt-1 text-xs text-[#78867e]">{member.role}</p><div className="mt-4 flex items-center justify-between border-t border-[#edf1ef] pt-4"><span className="text-[10px] text-[#849088]">Chamados ativos</span><span className="text-sm font-semibold">{member.open}</span></div></article>)}</div>
    <section className="mt-5 rounded-2xl border border-[#dce5df] bg-white p-5"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><ShieldCheck className="size-4" /></span><div><h2 className="text-sm font-semibold">Papéis no fluxo</h2><p className="mt-1 text-xs text-[#78867e]">Cada área participa em uma etapa clara do chamado.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-4">{[['Suporte','Registra o problema'],['Gerência','Prioriza e acompanha'],['Desenvolvimento','Analisa e corrige'],['Qualidade','Testa e encerra']].map(([role,description], index) => <div key={role} className="relative rounded-xl bg-[#f6f9f7] p-4"><span className="text-[10px] font-bold text-[#3e7657]">0{index + 1}</span><p className="mt-2 text-xs font-semibold">{role}</p><p className="mt-1 text-[10px] text-[#7c8a82]">{description}</p></div>)}</div></section>
  </div>;
}

function ViewHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action: React.ReactNode }) { return <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.13em] text-[#4f7b62]">{eyebrow}</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.035em]">{title}</h2><p className="mt-1.5 max-w-2xl text-sm text-[#708078]">{description}</p></div>{action}</div>; }
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
function Timeline({ name, role, time, text, highlighted = false }: { name: string; role: string; time: string; text: string; highlighted?: boolean }) { return <div className="relative"><span className={`absolute -left-[25px] top-1 size-2 rounded-full ring-4 ring-white ${highlighted ? 'bg-[#d79a27]' : 'bg-[#4b8b65]'}`} /><div className={highlighted ? 'rounded-xl border border-[#f0d69d] bg-[#fff9ed] p-3' : ''}><div className="flex items-center justify-between gap-3"><p className="text-xs font-semibold">{name} <span className="font-normal text-[#849088]">· {role}</span></p><time className="text-[10px] text-[#8a968f]">{time}</time></div><p className="mt-1.5 text-xs leading-5 text-[#596960]">{text}</p></div></div>; }
function InfoCard({ label, value }: { label: string; value: string }) { return <div><p className="detail-label">{label}</p><p className="mt-1.5 text-xs font-medium text-[#405248]">{value}</p></div>; }
function Attachment({ id, name, size, csv = false }: { id?: string; name: string; size: string; csv?: boolean }) { const content = <><span className={`grid size-8 place-items-center rounded-lg ${csv ? 'bg-[#eaf5ed] text-[#347850]' : 'bg-[#eef3f9] text-[#4b7097]'}`}>{csv ? <FileArchive className="size-4" /> : <FileImage className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-[10px] font-semibold">{name}</span><span className="block text-[9px] text-[#8b978f]">{size} · baixar</span></span></>; return id ? <a href={`/api/attachments/${encodeURIComponent(id)}`} className="flex w-full items-center gap-2 rounded-lg border border-[#e1e8e4] p-2 text-left hover:bg-[#f7faf8]">{content}</a> : <span className="flex w-full items-center gap-2 rounded-lg border border-[#e1e8e4] p-2 text-left">{content}</span>; }
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
function apiReportToItem(row: Record<string, unknown>): ReportItem { const email = String(row.author_email || 'EQ'); return { id: String(row.id), title: String(row.function_name || 'Report'), client: String(row.institution || 'Cliente não informado'), copy: String(row.copy_number || 'Sem cópia'), version: String(row.version || 'Sem versão'), status: String(row.status || 'Novo report'), tone: statusTone(String(row.status || 'Novo report')), owner: initials(email.includes('@') ? email.split('@')[0] : email).slice(0, 2), updated: formatDateTime(Number(row.updated_at || Date.now())), attachments: Number(row.attachment_count || 0) }; }
function formatDateTime(value: number) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function actorName(email: string) { const local = email.split('@')[0].replace(/[._-]+/g, ' '); return local.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
