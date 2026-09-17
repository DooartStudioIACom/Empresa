'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Activity, AlertTriangle, Bell, Bug, Building2, CalendarDays, Check, CheckCircle2, ChevronRight, Circle, CircleCheck, Clock3, Code2, Copy, Eye, ExternalLink, FileArchive, FileImage, FlaskConical, LayoutDashboard, Link2, ListChecks, LoaderCircle, Mail, MessageSquareText, MoreHorizontal, PackageCheck, Paperclip, PlayCircle, Plus, Search, Share2, ShieldCheck, Sparkles, Tags, UploadCloud, UserPlus, Users, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type ReportItem = { id: string; title: string; client: string; copy: string; version: string; status: string; tone: string; owner: string; reporterName: string; responsibleName?: string; updated: string; attachments: number; urgent?: boolean; canEdit?: boolean; isOwner?: boolean };
type GlobalBugItem = { id: string; function_name: string; institution: string; copy_number: string | null; version: string | null; system_path: string; description: string; status: string; urgent: number; author_email: string; created_at: number; updated_at: number; images: Array<{ id: string; file_name: string; kind: string }> };
const initialReports: ReportItem[] = [];
type ReportDetail = {
  report: Record<string, string | number | null>;
  attachments: Array<{ id: string; file_name: string; content_type: string; byte_size: number; kind: string; created_at: number }>;
  activities: Array<{ id: string; actor_email: string; action: string; message: string | null; created_at: number }>;
  permissions?: { isOwner: boolean; canEdit: boolean; role?: TeamRole };
  shares?: Array<{ user_email: string; permission: string; created_at: number }>;
};
type ReportEditorBlock = { key: number; type: 'text'; value: string } | { key: number; type: 'image'; file: File; preview: string; caption: string };
type TestRoundItem = { id: string; round_id: string; position: number; title: string; path: string | null; description: string | null; status: string; tester_email: string | null; tester_name?: string | null; result_note: string | null; updated_at: number; response_updated_at?: number | null; linked_report_id?: string | null; linked_report_status?: string | null; images?: Array<{ id: string; file_name: string; content_type: string; byte_size: number }> };
type RoundParticipant = { round_id: string; user_id: string; user_email: string; user_name: string; total_items: number; done_items: number; bug_items: number; progress: number; completed_at: number | null; deadline_override: string | null; is_current: boolean };
type TestRound = { id: string; title: string; version: string; deadline: string; description: string | null; tags?: string[]; status: string; author_email: string; created_at: number; updated_at: number; items: TestRoundItem[]; participants?: RoundParticipant[] };
type TeamRole = 'support' | 'manager' | 'developer';
type CurrentUser = { displayName: string; email: string; role: TeamRole; roleLabel: string };
type TeamMember = { email: string; name: string; role: TeamRole; updated_at: number };

const nav = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'reports', label: 'Reports', icon: Bug },
  { id: 'rounds', label: 'Rodadas de testes', icon: ListChecks },
  { id: 'versions', label: 'Versões', icon: FileArchive },
  { id: 'team', label: 'Equipe', icon: Users },
] as const;

type SectionId = (typeof nav)[number]['id'];
const showTeamHistory = false;

export default function Home() {
  const [reportItems, setReportItems] = useState<ReportItem[]>(initialReports);
  const [newReportOpen, setNewReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportItem | null>(null);
  const [bugSquashed, setBugSquashed] = useState(false);
  useEffect(() => {
    setBugSquashed(false);
  }, [selectedReport?.id]);
  useEffect(() => {
    if (!bugSquashed) return;
    const timer = window.setTimeout(() => setBugSquashed(false), 3200);
    return () => window.clearTimeout(timer);
  }, [bugSquashed]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    try { setSidebarCollapsed(localStorage.getItem('bugs-sidebar-collapsed') === 'true'); } catch { /* Browser storage may be unavailable. */ }
  }, []);
  function toggleSidebar() {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    try { localStorage.setItem('bugs-sidebar-collapsed', String(next)); } catch { /* Keep the toggle working without persistence. */ }
  }
  const [hasBackup, setHasBackup] = useState(true);
  const [hasAttachments, setHasAttachments] = useState(true);
  const [fromTestRound, setFromTestRound] = useState(false);
  const [reportRounds, setReportRounds] = useState<TestRound[]>([]);
  const [linkedRoundId, setLinkedRoundId] = useState('');
  const [linkedItemId, setLinkedItemId] = useState('');
  const [roundReportSource, setRoundReportSource] = useState<{ functionName: string; path: string; version: string } | null>(null);
  const [reportBlocks, setReportBlocks] = useState<ReportEditorBlock[]>([{ key: 1, type: 'text', value: '' }]);
  const [reportDetail, setReportDetail] = useState<ReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [replying, setReplying] = useState(false);
  const [replyNotice, setReplyNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareNotice, setShareNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [githubWorking, setGithubWorking] = useState(false);
  const [githubNotice, setGithubNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [githubPreview, setGithubPreview] = useState<{ reportId: string; title: string; markdown: string; imageCount: number } | null>(null);
  const [githubPreviewMode, setGithubPreviewMode] = useState<'visual' | 'markdown'>('visual');
  const [reportTab, setReportTab] = useState<'summary' | 'activity' | 'files'>('summary');
  const [formError, setFormError] = useState<string | null>(null);
  const [overviewRound, setOverviewRound] = useState<TestRound | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [allBugsOpen, setAllBugsOpen] = useState(false);
  const [allBugs, setAllBugs] = useState<GlobalBugItem[]>([]);
  const [allBugsLoading, setAllBugsLoading] = useState(false);
  const [allBugsQuery, setAllBugsQuery] = useState('');
  const [allBugsError, setAllBugsError] = useState('');

  useEffect(() => {
    fetch('/api/me')
      .then(async (response) => response.ok ? await response.json() as CurrentUser : null)
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
    return () => window.clearInterval(syncTimer);
  }, []);

  useEffect(() => {
    if (!newReportOpen) return;
    fetch('/api/rounds').then(async (response) => response.ok ? await response.json() as { rounds?: TestRound[] } : null).then((payload) => payload?.rounds && setReportRounds(payload.rounds)).catch(() => undefined);
  }, [newReportOpen]);

  if (!authReady) return <AccessGate loading />;
  if (!currentUser) return <AccessGate />;

  const userName = friendlyName(currentUser?.displayName, currentUser?.email);
  const userInitials = initials(userName);
  const visibleNav = nav.filter((item) => currentUser.role === 'manager' || (item.id !== 'team' && item.id !== 'versions'));
  const activeNavItem = nav.find((item) => item.id === activeSection);
  const pageTitle = activeSection === 'overview' ? `Olá, ${userName}` : activeNavItem?.label;
  const pageContext = activeSection === 'overview' ? 'Seu espaço de qualidade está pronto' : activeSection === 'reports' ? 'Central de chamados' : activeSection === 'rounds' ? 'Planejamento e execução' : activeSection === 'versions' ? 'Histórico de entregas' : 'Pessoas e responsabilidades';
  const dashboardStats = [
    { step: '01', label: 'Novo report', value: String(reportItems.filter((item) => item.status === 'Novo report').length), note: 'aguarda envio ao DEV', icon: AlertTriangle, tone: 'red' },
    { step: '02', label: 'Com o DEV', value: String(reportItems.filter((item) => item.status === 'Com Desenvolvimento').length), note: 'em análise ou correção', icon: Code2, tone: 'blue' },
    { step: '03', label: 'Retestar', value: String(reportItems.filter((item) => item.status === 'Aguardando reteste').length), note: 'falhou? volta ao DEV', icon: FlaskConical, tone: 'amber' },
    { step: '04', label: 'Finalizado', value: String(reportItems.filter((item) => item.status === 'Finalizado').length), note: 'OK confirmado no reteste', icon: CircleCheck, tone: 'green' },
  ];
  const overviewAttention = reportItems.filter((item) => item.status === 'Novo report' || item.status === 'Aguardando reteste').length;
  const reportVersionCounts = reportItems.reduce<Record<string, number>>((counts, report) => {
    const version = report.version.trim();
    if (version && version !== 'Sem versão') counts[version] = (counts[version] || 0) + 1;
    return counts;
  }, {});
  const overviewTopVersion = Object.entries(reportVersionCounts).sort((first, second) => second[1] - first[1])[0] || null;
  const overviewTopVersionShare = overviewTopVersion && reportItems.length ? Math.round((overviewTopVersion[1] / reportItems.length) * 100) : 0;
  const overviewTested = overviewRound?.items.filter((item) => ['Aprovado', 'Com bug'].includes(item.status)).length || 0;
  const overviewProgress = overviewRound?.items.length ? Math.round((overviewTested / overviewRound.items.length) * 100) : 0;
  const linkedRound = reportRounds.find((round) => round.id === linkedRoundId) || null;

  function createReportFromRound(round: TestRound, item: TestRoundItem, note: string) {
    setFromTestRound(true); setLinkedRoundId(round.id); setLinkedItemId(item.id);
    setReportRounds((current) => current.some((entry) => entry.id === round.id) ? current : [round, ...current]);
    setRoundReportSource({ functionName: item.title, path: item.path || '', version: round.version });
    setReportBlocks([{ key: Date.now(), type: 'text', value: note }]);
    setHasBackup(false); setHasAttachments(false); setFormError(null); setNewReportOpen(true);
  }

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
        status: 'Novo report', tone: 'red', owner: userInitials, reporterName: userName, updated: 'agora',
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
      setRoundReportSource(null);
      reportBlocks.forEach((block) => { if (block.type === 'image') URL.revokeObjectURL(block.preview); });
      setReportBlocks([{ key: Date.now(), type: 'text', value: '' }]);
      window.dispatchEvent(new Event('official-report-created'));
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
    setGithubNotice(null);
    setGithubPreview(null);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(report.id)}`);
      if (response.ok) setReportDetail(await response.json());
    } finally {
      setDetailLoading(false);
    }
  }

  async function openAllBugs() {
    setAllBugsOpen(true);
    setAllBugsLoading(true);
    setAllBugsError('');
    try {
      const response = await fetch('/api/reports/all');
      const payload = await response.json() as { reports?: GlobalBugItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível carregar os bugs da equipe.');
      setAllBugs(payload.reports || []);
    } catch (error) {
      setAllBugsError(error instanceof Error ? error.message : 'Não foi possível carregar os bugs da equipe.');
    } finally {
      setAllBugsLoading(false);
    }
  }

  async function claimCorrection() {
    if (!selectedReport || replying) return;
    setReplying(true);
    setReplyNotice(null);
    try {
      const data = new FormData();
      data.set('action', 'claim');
      const response = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}`, { method: 'POST', body: data });
      const payload = await response.json() as { error?: string };
      const refreshed = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}`);
      if (refreshed.ok) setReportDetail(await refreshed.json());
      if (!response.ok) throw new Error(payload.error || 'Não foi possível assumir o report.');
      setReplyNotice({ tone: 'success', message: 'Você assumiu a correção deste report.' });
      const reports = await fetch('/api/reports');
      if (reports.ok) { const list = await reports.json() as { reports?: Array<Record<string, unknown>> }; setReportItems((list.reports || []).map(apiReportToItem)); }
    } catch (error) {
      setReplyNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível assumir o report.' });
    } finally { setReplying(false); }
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

  async function prepareForGitHub(mode: 'preview' | 'copy') {
    if (!selectedReport || githubWorking) return;
    setGithubWorking(true); setGithubNotice(null);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}/github`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'prepare' }) });
      const payload = await response.json() as { title?: string; markdown?: string; imageCount?: number; error?: string };
      if (!response.ok || !payload.markdown) throw new Error(payload.error || 'Não foi possível preparar o conteúdo.');
      const preview = { reportId: selectedReport.id, title: payload.title || selectedReport.title, markdown: payload.markdown, imageCount: Number(payload.imageCount || 0) };
      if (mode === 'preview') {
        setGithubPreview(preview);
        setGithubPreviewMode('visual');
      } else {
        await copyText(preview.markdown);
        setGithubNotice({ tone: 'success', message: `Conteúdo copiado${preview.imageCount ? ` com ${preview.imageCount} ${preview.imageCount === 1 ? 'imagem' : 'imagens'}` : ''}. Cole na descrição da issue.` });
      }
    } catch (error) {
      setGithubNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível preparar a issue.' });
    } finally { setGithubWorking(false); }
  }

  async function copyPreviewForGitHub() {
    if (!githubPreview || githubWorking) return;
    setGithubWorking(true);
    try {
      await copyText(githubPreview.markdown);
      setGithubNotice({ tone: 'success', message: 'Conteúdo da prévia copiado. Cole na descrição da issue.' });
    } catch (error) {
      setGithubNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível copiar.' });
    } finally { setGithubWorking(false); }
  }

  async function saveGitHubIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedReport || githubWorking) return;
    const form = event.currentTarget;
    const issueUrl = String(new FormData(form).get('githubIssueUrl') || '').trim();
    setGithubWorking(true); setGithubNotice(null);
    try {
      const response = await fetch(`/api/reports/${encodeURIComponent(selectedReport.id)}/github`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save-link', issueUrl }) });
      const payload = await response.json() as { issueUrl?: string | null; error?: string };
      if (!response.ok) throw new Error(payload.error || 'Não foi possível salvar o link.');
      setReportDetail((current) => current ? { ...current, report: { ...current.report, github_issue_url: payload.issueUrl || null } } : current);
      setGithubNotice({ tone: 'success', message: payload.issueUrl ? 'Issue vinculada ao report.' : 'Vínculo removido.' });
    } catch (error) {
      setGithubNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível salvar o link.' });
    } finally { setGithubWorking(false); }
  }

  return (
    <div className="min-h-screen bg-[#f4f7f5] text-[#16231d]">
      <button type="button" onClick={toggleSidebar} aria-controls="main-sidebar" aria-expanded={!sidebarCollapsed} aria-label={sidebarCollapsed ? 'Mostrar menu lateral' : 'Recolher menu lateral'} title={sidebarCollapsed ? 'Mostrar menu lateral' : 'Recolher menu lateral'} className={`fixed top-[104px] z-30 hidden size-8 items-center justify-center rounded-full border border-[#b9d0c2] bg-white text-[#28583e] shadow-md transition-[left,background-color] duration-200 hover:bg-[#eaf5ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#397657] motion-reduce:transition-none lg:flex ${sidebarCollapsed ? 'left-1' : 'left-[222px]'}`}><ChevronRight className={`size-4 transition-transform duration-200 motion-reduce:transition-none ${sidebarCollapsed ? '' : 'rotate-180'}`} /></button>
      <aside id="main-sidebar" className={`fixed inset-y-0 left-0 z-20 hidden w-[238px] flex-col border-r border-[#dce5df] bg-[#10271d] text-white transition-[transform,visibility] duration-200 motion-reduce:transition-none lg:flex ${sidebarCollapsed ? 'invisible -translate-x-full' : 'visible translate-x-0'}`}>
        <div className="flex h-[76px] items-center gap-3 border-b border-white/10 px-6">
          <img src="/brand/bugs-on-the-table-logo.png" alt="" aria-hidden="true" className="size-10 shrink-0 object-contain drop-shadow-[0_5px_10px_rgba(215,255,102,.18)]" />
          <div><p className="text-[15px] font-semibold tracking-tight">The Bugs on the Table</p><p className="text-[11px] text-white/48">Qualidade & produto</p></div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-6" aria-label="Navegação principal">
          {visibleNav.map((item) => { const Icon = item.icon; return (
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
          <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium">{currentUser?.displayName || 'Usuário conectado'}</span><span className="block text-[10px] text-white/45">{teamRoleName(currentUser.role)}</span></span><MoreHorizontal className="size-4 text-white/40" />
        </button>
      </aside>

      <main className={`transition-[margin-left] duration-200 motion-reduce:transition-none ${sidebarCollapsed ? 'lg:ml-9' : 'lg:ml-[238px]'}`}>
        <header className="sticky top-0 z-10 border-b border-[#dbe5df] bg-[#f4f7f5]/95 py-2.5 backdrop-blur-xl">
          <div className="mx-auto max-w-[1420px] px-5 sm:px-8">
            <div className={`classic-command-header relative isolate flex min-h-[76px] w-full items-center justify-between overflow-hidden rounded-[22px] border border-[#c8d8ce] px-4 shadow-[0_12px_34px_-28px_#173e2c] sm:px-5 ${activeSection === 'rounds' ? 'command-rounds-header' : ''}`}>
              <div className="pointer-events-none absolute inset-[4px] rounded-[17px] border border-white/75" />
              <img src={activeSection === 'rounds' ? '/rounds/test-round-visual-ui.png' : '/header/bug-scan-v2.png'} alt="" aria-hidden="true" className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 object-contain lg:block ${activeSection === 'rounds' ? 'rounds-command-art right-[172px]' : 'classic-header-art right-[118px]'}`} />
              <div className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-[linear-gradient(180deg,#173e2c,#7daf88,#d7ff66)]" />
              <div className="relative z-[1] flex min-w-0 items-center gap-3.5">
                <span className="grid size-11 shrink-0 place-items-center rounded-[14px] bg-[#173e2c] p-1 shadow-sm ring-1 ring-white/70"><img src="/brand/bugs-on-the-table-logo.png" alt="" aria-hidden="true" className="size-full object-contain" /></span>
                <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-[9px] font-bold uppercase tracking-[0.17em] text-[#477058]">The Bugs on the Table</p><span className="size-1 rounded-full bg-[#9ab2a2]" /><p className="hidden truncate text-[9px] font-semibold uppercase tracking-[.1em] text-[#7f9187] sm:block">{pageContext}</p></div><h1 className="mt-1 truncate text-[19px] font-semibold tracking-[-0.03em] text-[#1b3025]">{pageTitle}</h1></div>
              </div>
              <div className="relative z-[2] ml-4 flex shrink-0 items-center gap-2.5 border-l border-[#cddbd2] pl-3 sm:pl-4">
                <div className="flex items-center gap-1 rounded-[14px] border border-[#d3e0d8] bg-white/70 p-1 shadow-sm backdrop-blur">
                  {activeSection !== 'overview' && <Button onClick={() => setActiveSection('overview')} variant="ghost" aria-label="Voltar à visão geral" className="h-8 rounded-[10px] px-2.5 text-[#315c43] hover:bg-[#edf5f0] sm:px-3"><LayoutDashboard className="size-4" /><span className="hidden sm:inline">Visão geral</span></Button>}
                  <Button variant="ghost" size="icon" aria-label="Notificações" className="relative size-8 rounded-[10px] text-[#496355] hover:bg-[#edf5f0]"><Bell className="size-4" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-[#ef6a5b] ring-2 ring-white" /></Button>
                </div>
                  {(activeSection !== 'rounds' || currentUser.role === 'manager') && <Button onClick={() => activeSection === 'rounds' ? window.dispatchEvent(new Event('open-new-round')) : setNewReportOpen(true)} aria-label={activeSection === 'rounds' ? 'Criar nova rodada' : 'Criar novo report'} className={`h-9 rounded-xl px-3.5 text-white shadow-[0_8px_20px_-14px_#173e2c] transition hover:-translate-y-0.5 sm:px-4 ${activeSection === 'rounds' ? 'bg-[linear-gradient(135deg,#173e2c,#2a6848)] ring-1 ring-[#7eaa8e]/25 hover:bg-[#24573f]' : 'bg-[#173e2c] hover:bg-[#24573f]'}`}><Plus className={`size-4 ${activeSection === 'rounds' ? 'text-[#d7ff66]' : ''}`} /><span className="hidden sm:inline">{activeSection === 'rounds' ? 'Nova rodada' : 'Novo report'}</span><span className="sm:hidden">{activeSection === 'rounds' ? 'Rodada' : 'Report'}</span></Button>}
              </div>
            </div>
          </div>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-[#dce5df] bg-white px-4 py-2 lg:hidden" aria-label="Navegação principal móvel">
          {visibleNav.map((item) => { const Icon = item.icon; return <button onClick={() => setActiveSection(item.id)} key={item.id} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium ${activeSection === item.id ? 'bg-[#eaf3ed] text-[#245b3d]' : 'text-[#6f7f76]'}`}><Icon className="size-3.5" />{item.label}</button>; })}
        </nav>

        <div className="mx-auto max-w-[1420px] px-5 py-7 sm:px-8">
          {activeSection === 'overview' ? <>
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.55fr)]">
            <article className={`alert-tech-card ${overviewAttention > 0 ? 'alert-tech-card--active' : 'alert-tech-card--clear'} relative overflow-hidden rounded-[24px] p-5 text-white sm:p-6`}>
              <div className="alert-tech-grid" aria-hidden="true" />
              <div className="alert-tech-scan" aria-hidden="true" />
              <div className="alert-tech-circuit" aria-hidden="true"><span /><span /><span /></div>
              <div className="alert-tech-glow pointer-events-none absolute -right-12 -top-16 size-52 rounded-full blur-2xl" />
              <div className="relative flex h-full items-start gap-4 sm:items-center sm:gap-5">
                <span className="alert-tech-status-icon grid size-12 shrink-0 place-items-center rounded-2xl border">{overviewAttention > 0 ? <Bell className="size-5" /> : <CircleCheck className="size-5" />}</span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.12em] text-white/70"><span className="alert-tech-live-dot relative flex size-2"><span className="alert-tech-live-wave absolute inline-flex size-full rounded-full opacity-60" /><span className="alert-tech-live-core relative inline-flex size-2 rounded-full" /></span> Avisos em tempo real</span>{lastSync && <span className="text-xs text-white/45">Atualizado às {lastSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}</div><h2 className="mt-3 text-2xl font-semibold tracking-[-.04em] sm:text-3xl">{overviewAttention > 0 ? `${overviewAttention} ${overviewAttention === 1 ? 'item precisa' : 'itens precisam'} de atenção` : 'Nenhuma pendência agora'}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">{overviewAttention > 0 ? 'Há novos reports ou retestes aguardando uma ação da equipe.' : 'Todos os reports seguiram no fluxo e não há retestes pendentes.'}</p></div>
              </div>
            </article>

            <article className={`round-focus-card ${overviewRound ? overviewProgress >= 100 ? 'round-focus-card--complete' : 'round-focus-card--active' : 'round-focus-card--idle'} group relative overflow-hidden rounded-[24px] border border-[#d7e2db] bg-white p-5 shadow-[0_8px_28px_rgb(16_39_29/5%)]`}>
              {overviewRound ? <>
              <div className="relative flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[.1em] text-[#58806a]">Rodada em foco</p>
                    {overviewRound && <span className="round-focus-state"><span />{overviewProgress >= 100 ? 'Concluída' : 'Em andamento'}</span>}
                  </div>
                  <h2 className="mt-2 truncate text-base font-semibold text-[#263a2f]">{overviewRound?.title || 'Nenhuma rodada ativa'}</h2>
                </div>
                <button type="button" onClick={() => setActiveSection('rounds')} className="group/open inline-flex shrink-0 items-center gap-2 rounded-xl border border-[#cfe0d5] bg-white px-3 py-2 text-xs font-semibold text-[#35674a] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9ebca8] hover:shadow-md"><ListChecks className="size-3.5" />{overviewRound ? 'Abrir rodada' : currentUser.role === 'manager' ? 'Criar rodada' : 'Ver rodadas'}<ChevronRight className="size-3.5 transition group-hover/open:translate-x-0.5" /></button>
              </div>
              <p className="relative mt-2 text-sm text-[#718078]">{overviewRound ? `${overviewRound.version} · prazo ${formatRoundDate(overviewRound.deadline)}` : 'Crie a primeira rodada para distribuir os testes.'}</p>
              <div className="relative mt-5 grid grid-cols-[minmax(0,1fr)_48px] items-center gap-4">
                <div><div className="h-2.5 overflow-hidden rounded-full bg-[#e8eee9] shadow-inner"><div style={{ width: `${overviewProgress}%` }} className="round-focus-progress h-full rounded-full bg-[linear-gradient(90deg,#347951,#8ecb42,#d7ff66)] transition-all duration-700" /></div><div className="mt-2 flex items-center justify-between text-xs text-[#718078]"><span>{overviewRound ? `${overviewTested} de ${overviewRound.items.length} testados` : 'Sem itens'}</span><span className="font-medium text-[#527060]">Progresso</span></div></div>
                <span className="round-focus-meter grid size-12 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${overviewProgress >= 100 ? '#82bb3a' : '#397b57'} ${overviewProgress}%, #e7efe9 0)` }}><strong className="grid size-9 place-items-center rounded-full bg-white text-[11px] text-[#397657] shadow-sm">{overviewProgress}%</strong></span>
              </div>
              </> : <>
                <div className="relative flex items-center justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[.1em] text-[#58806a]">Testes do URÂNIA</p><span className="rounded-full border border-[#d9e5dc] bg-white/80 px-2.5 py-1 text-[10px] font-semibold text-[#6b8073] shadow-sm">Nova validação</span></div>
                <div className="relative mt-4 flex items-center gap-4"><span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-[#cfe0d5] bg-[linear-gradient(145deg,#173e2c,#2e6b4a)] text-[#d7ff66] shadow-[0_10px_24px_rgb(23_62_44/18%)]"><ListChecks className="size-6" /></span><div className="min-w-0"><h2 className="text-base font-semibold leading-5 text-[#263a2f]">Valide as novidades do URÂNIA</h2><p className="mt-1.5 text-xs leading-5 text-[#718078]">Organize as funcionalidades que a equipe deve testar e acompanhe os bugs encontrados.</p></div></div>
                <button type="button" onClick={() => setActiveSection('rounds')} className="group/create relative mt-4 flex w-full items-center justify-between rounded-xl bg-[#173e2c] px-4 py-3 text-left text-xs font-semibold text-white shadow-[0_8px_20px_rgb(23_62_44/18%)] transition hover:-translate-y-0.5 hover:bg-[#24573f]"><span className="flex items-center gap-2"><ListChecks className="size-4 text-[#d7ff66]" />{currentUser.role === 'manager' ? 'Criar rodada de testes' : 'Acompanhar rodadas'}</span><ChevronRight className="size-4 transition group-hover/create:translate-x-0.5" /></button>
              </>}
            </article>
          </section>

          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo dos chamados">
            {dashboardStats.map((stat) => { const Icon = stat.icon; return (
              <button type="button" onClick={() => setActiveSection('reports')} key={stat.label} className="group relative overflow-hidden rounded-2xl border border-[#dce5df] bg-white p-4 text-left shadow-[0_4px_18px_rgb(16_39_29/4%)] transition hover:-translate-y-0.5 hover:border-[#c7d7cd] hover:shadow-[0_10px_28px_rgb(16_39_29/9%)]">
                <div className={`absolute inset-x-0 top-0 h-1 stat-${stat.tone}`} /><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.1em] text-[#849088]">Etapa {stat.step}</p><p className="mt-1 text-sm font-semibold text-[#4d5f55]">{stat.label}</p><p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.05em]">{stat.value}</p></div><span className={`stat-icon stat-${stat.tone} transition-transform group-hover:scale-110`}><Icon className="size-[17px]" /></span></div>
                <div className="mt-3 flex items-center gap-2 text-xs text-[#7b8981]"><span className={`size-1.5 rounded-full stat-${stat.tone}`} />{stat.note}</div>
              </button>
            ); })}
          </section>

          <div className={`mt-5 grid items-start gap-5 ${showTeamHistory ? 'xl:grid-cols-[minmax(0,1fr)_330px]' : ''}`}>
          <section className="overflow-hidden rounded-[22px] border border-[#d7e2db] bg-white shadow-[0_10px_32px_rgb(16_39_29/6%)]">
            <div className="flex flex-col gap-4 border-b border-[#dfe8e2] bg-[linear-gradient(135deg,#fbfdfc,#f2f7f4)] p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66] shadow-sm"><Activity className="size-[18px]" /></span><div><h2 className="text-base font-semibold text-[#20352a]">Atividade recente</h2><p className="mt-1 text-xs text-[#718078]">Acompanhe as últimas mudanças nos reports da equipe.</p></div></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setActiveSection('reports')} className="group/mine inline-flex items-center gap-1.5 rounded-xl border border-[#d8e3dc] bg-white px-3 py-2 text-xs font-semibold text-[#386349] shadow-sm transition hover:border-[#bcd2c3] hover:bg-[#f7faf8]">Meus reports <ChevronRight className="size-3.5 transition group-hover/mine:translate-x-0.5" /></button><button type="button" onClick={() => void openAllBugs()} className="group/all inline-flex items-center gap-2 rounded-xl bg-[#173e2c] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#24573f]"><Search className="size-3.5 text-[#d7ff66]" />Todos os bugs <span className="hidden items-center gap-1 text-[9px] font-medium text-white/60 md:flex"><ShieldCheck className="size-3" />consulta</span><ChevronRight className="size-3.5 transition group-hover/all:translate-x-0.5" /></button></div></div>
            <div className="divide-y divide-[#e5ece8]">
              {reportItems.slice(0, 5).map((report) => (
                <button onClick={() => openReport(report)} key={report.id} className={`recent-report-row recent-report-row--${report.tone} group relative grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left transition md:grid-cols-[minmax(260px,1.35fr)_minmax(150px,.62fr)_140px_minmax(150px,180px)_34px]`}>
                  <span aria-hidden="true" className="recent-report-accent absolute inset-y-3 left-0 w-1 rounded-r-full" />
                  <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold tracking-wide text-[#7b8981]">{report.id}</span>{report.urgent && <Badge className="h-[19px] border border-[#ffd8d1] bg-[#fff0ed] px-1.5 text-[9px] font-bold text-[#b64738]">URGENTE</Badge>}</div><p className="mt-1.5 truncate text-sm font-semibold text-[#1d2e25] transition group-hover:text-[#255c3d]">{report.title}</p><p className="mt-1 truncate text-xs text-[#75847c]">{report.client} <span className="text-[#b0bab4]">·</span> {report.copy}</p><div className="mt-2 md:hidden"><span className={`status status-${report.tone}`}><span />{report.status}</span></div></div>
                  <div className="hidden md:flex md:flex-wrap md:gap-2"><span className="rounded-lg border border-[#e0e8e3] bg-[#f8faf9] px-2.5 py-1.5"><span className="block text-[8px] font-bold uppercase tracking-[.1em] text-[#96a199]">Versão</span><span className="mt-0.5 block max-w-24 truncate text-[11px] font-semibold text-[#3f5148]">{report.version}</span></span><span className="rounded-lg border border-[#e0e8e3] bg-[#f8faf9] px-2.5 py-1.5"><span className="block text-[8px] font-bold uppercase tracking-[.1em] text-[#96a199]">Anexos</span><span className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-[#53665b]"><Paperclip className="size-3" />{report.attachments}</span></span></div>
                  <div className="hidden md:block"><span className={`status status-${report.tone}`}><span />{report.status}</span><p className="mt-1.5 text-xs text-[#53665b]">{report.responsibleName || 'Aguardando responsável'}</p></div>
                  <div className="flex items-center justify-end gap-2.5 md:justify-start"><span className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-white bg-[#e6ece8] text-[10px] font-bold text-[#385144] shadow-sm">{report.owner}</span><span className="hidden min-w-0 xl:block"><span className="block truncate text-xs font-semibold text-[#344b3f]" title={report.reporterName}>{report.reporterName}</span><span className="mt-0.5 block text-[10px] font-medium text-[#7f8d85]">Atualizado {report.updated}</span></span></div>
                  <span className="hidden size-8 place-items-center rounded-full border border-[#e1e8e4] bg-white text-[#93a098] shadow-sm transition group-hover:border-[#bcd2c3] group-hover:text-[#386349] md:grid"><ChevronRight className="size-4 transition group-hover:translate-x-0.5" /></span>
                </button>
              ))}
              {reportItems.length === 0 && <div className="px-5 py-14 text-center"><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#eef5f0] text-[#397657]"><Sparkles className="size-5" /></span><p className="mt-4 text-base font-semibold text-[#263a2f]">Nenhuma movimentação ainda</p><p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#7a8880]">Novos reports e resultados de testes aparecerão aqui.</p></div>}
            </div>
          </section>

          {showTeamHistory && <aside>
            <section className="team-history-card relative overflow-hidden rounded-[24px] border border-[#d8e4dc] bg-white shadow-[0_10px_30px_rgb(16_56_35/6%)]">
              <div className="team-history-grid" aria-hidden="true" />
              <div className="relative flex items-start justify-between gap-3 px-5 pb-4 pt-5">
                <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#58806a]">Histórico geral</p><h2 className="mt-1 text-lg font-semibold tracking-[-.02em] text-[#203a2d]">Bugs da equipe</h2><p className="mt-1 text-xs leading-5 text-[#76857d]">Visão acumulada de todos os reports.</p></div>
                <span className="team-history-icon grid size-11 shrink-0 place-items-center rounded-full border border-[#d9e7de] bg-white text-[#397657]"><Activity className="size-5" /></span>
              </div>
              <div className="relative grid grid-cols-2 gap-3 px-4 pb-4">
                <div className="rounded-2xl border border-[#e1e9e4] bg-[#f8fbf9] p-4">
                  <div className="flex items-center justify-between gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#e9f4ed] text-[#397657]"><Bug className="size-4" /></span><span className="text-xs font-medium text-[#718078]">Total</span></div>
                  <p className="mt-4 text-[32px] font-semibold leading-none tracking-[-.06em] text-[#173e2c]">{reportItems.length}</p><p className="mt-2 text-sm font-semibold text-[#344b3f]">bugs reportados</p><p className="mt-1 text-xs text-[#7f8e86]">por toda a equipe</p>
                </div>
                <div className="min-w-0 rounded-2xl border border-[#dce9cd] bg-[linear-gradient(145deg,#fbfff6,#f2f9e8)] p-4">
                  <div className="flex items-center justify-between gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#e5f2d4] text-[#5f8b27]"><PackageCheck className="size-4" /></span>{overviewTopVersion && <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[#62852d] shadow-sm">{overviewTopVersionShare}%</span>}</div>
                  <p className="mt-4 truncate text-2xl font-semibold leading-none tracking-[-.04em] text-[#173e2c]" title={overviewTopVersion?.[0]}>{overviewTopVersion?.[0] || '—'}</p><p className="mt-2 text-sm font-semibold text-[#344b3f]">versão mais afetada</p><p className="mt-1 text-xs text-[#7f8e86]">{overviewTopVersion ? `${overviewTopVersion[1]} ${overviewTopVersion[1] === 1 ? 'report registrado' : 'reports registrados'}` : 'sem dados de versão'}</p>
                </div>
              </div>
              <div className="relative border-t border-[#e7ede9] bg-[#fbfdfb] px-5 py-4">
                <div className="flex items-center justify-between gap-3 text-xs"><span className="font-medium text-[#53665b]">Concentração na versão líder</span><strong className="text-[#397657]">{overviewTopVersionShare}%</strong></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e6ede8]"><div className="team-history-progress h-full rounded-full bg-[linear-gradient(90deg,#397657,#86b83e,#c8ef62)]" style={{ width: `${overviewTopVersionShare}%` }} /></div>
              </div>
            </section>
          </aside>}
          </div>
          </> : activeSection === 'reports' ? <ReportsView reports={reportItems} onSelect={openReport} role={currentUser.role} /> : activeSection === 'rounds' ? <RoundsView onCreateReport={createReportFromRound} reports={reportItems.filter((report) => report.isOwner)} currentUser={currentUser} /> : activeSection === 'versions' ? <VersionsView /> : <TeamView currentUserName={currentUser?.displayName || userName} currentUserEmail={currentUser.email} currentUserInitials={userInitials} currentUserRole={currentUser.role} />}
        </div>
      </main>

      <Dialog open={allBugsOpen} onOpenChange={setAllBugsOpen}>
        <DialogContent className="max-h-[92vh] overflow-hidden border border-white/80 bg-[#f4f7f5] p-0 sm:max-w-4xl">
          <DialogHeader className="relative border-b border-[#dbe5df] bg-white px-5 py-5 sm:px-7">
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#173e2c,#4f8a63,#d7ff66)]" />
            <button type="button" onClick={() => setAllBugsOpen(false)} aria-label="Fechar lista de bugs" className="absolute right-4 top-4 grid size-9 place-items-center rounded-xl border border-[#dce5df] bg-white text-[#718078] shadow-sm transition hover:border-[#a9c1b1] hover:text-[#173e2c]"><X className="size-4" /></button>
            <div className="flex items-start gap-3 pr-11"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#173e2c] text-[#d7ff66] shadow-sm"><Bug className="size-5" /></span><div><div className="flex flex-wrap items-center gap-2"><DialogTitle className="text-xl text-[#1b3024]">Todos os bugs da equipe</DialogTitle><Badge className="border border-[#d4e1d8] bg-[#eef4f0] text-[9px] text-[#526b5c]">SOMENTE CONSULTA</Badge></div><DialogDescription className="mt-1.5 max-w-2xl text-xs leading-5">Consulte antes de criar um novo report e confirme se o mesmo problema já foi registrado por outra pessoa.</DialogDescription></div></div>
            <div className="relative mt-4"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-[#84938b]" /><Input value={allBugsQuery} onChange={(event) => setAllBugsQuery(event.target.value)} placeholder="Buscar por bug, cliente, cópia, versão, caminho ou responsável..." className="h-11 border-[#d7e2db] bg-[#f8faf9] pl-10 pr-4 text-xs shadow-none" /></div>
          </DialogHeader>
          <div className="max-h-[calc(92vh-190px)] overflow-y-auto p-4 sm:p-6">
            {allBugsLoading && <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-sm text-[#718078]"><span className="grid size-11 place-items-center rounded-2xl bg-white shadow-sm"><LoaderCircle className="size-5 animate-spin text-[#397657]" /></span>Carregando os bugs da equipe...</div>}
            {!allBugsLoading && allBugsError && <div role="alert" className="flex min-h-52 flex-col items-center justify-center rounded-2xl border border-[#efc3bb] bg-[#fff5f2] p-6 text-center"><AlertTriangle className="size-6 text-[#b54d3f]" /><p className="mt-3 text-sm font-semibold text-[#8e3c31]">Não foi possível abrir a consulta</p><p className="mt-1 text-xs text-[#9d625a]">{allBugsError}</p><Button type="button" variant="outline" onClick={() => void openAllBugs()} className="mt-4">Tentar novamente</Button></div>}
            {!allBugsLoading && !allBugsError && (() => {
              const query = allBugsQuery.trim().toLocaleLowerCase('pt-BR');
              const visibleBugs = allBugs.filter((bug) => !query || [bug.id, bug.function_name, bug.institution, bug.copy_number, bug.version, bug.system_path, bug.author_email].some((value) => String(value || '').toLocaleLowerCase('pt-BR').includes(query)));
              if (visibleBugs.length === 0) return <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfddd4] bg-white p-6 text-center"><Search className="size-6 text-[#7e9687]" /><p className="mt-3 text-sm font-semibold text-[#2d4638]">{allBugs.length ? 'Nenhum bug corresponde à busca' : 'Nenhum bug foi reportado ainda'}</p><p className="mt-1 text-xs text-[#7c8b83]">{allBugs.length ? 'Tente pesquisar usando outro termo.' : 'Os reports da equipe aparecerão aqui.'}</p></div>;
              return <div className="space-y-3"><div className="flex items-center justify-between px-1"><p className="text-[10px] font-semibold uppercase tracking-[.11em] text-[#74857b]">{visibleBugs.length} {visibleBugs.length === 1 ? 'bug encontrado' : 'bugs encontrados'}</p><p className="text-[10px] text-[#8a978f]">Clique em um item para ver o erro</p></div>{visibleBugs.map((bug) => { const normalizedStatus = normalizeReportStatus(bug.status); const tone = statusTone(bug.status); return <details key={bug.id} className="group overflow-hidden rounded-2xl border border-[#dce5df] bg-white shadow-[0_4px_16px_rgb(16_39_29/4%)] open:border-[#bad0c1] open:shadow-[0_9px_24px_rgb(16_39_29/8%)]"><summary className="flex cursor-pointer list-none items-center gap-3 p-4 marker:hidden"><span className={`status-dot status-${tone} size-2.5 shrink-0 rounded-full`} /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="font-mono text-[9px] font-semibold text-[#75847c]">{bug.id}</span>{Number(bug.urgent) === 1 && <Badge className="border border-[#ffd8d1] bg-[#fff0ed] px-1.5 text-[8px] text-[#b64738]">URGENTE</Badge>}<span className={`status status-${tone}`}><span />{normalizedStatus}</span></span><strong className="mt-1.5 block truncate text-sm text-[#21362b]">{bug.function_name}</strong><span className="mt-1 block truncate text-[11px] text-[#75847c]">{bug.institution}{bug.copy_number ? ` · Cópia ${bug.copy_number}` : ''}{bug.version ? ` · ${bug.version}` : ''}</span></span><ChevronRight className="size-4 shrink-0 text-[#8a988f] transition group-open:rotate-90" /></summary><div className="border-t border-[#e5ece8] bg-[#f8faf9] p-4"><section className="rounded-2xl border border-[#dce6df] bg-white p-4 shadow-sm"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#fff0ed] text-[#b24b3d]"><AlertTriangle className="size-4" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#8b6b64]">Erro relatado</p><p className="mt-0.5 text-xs text-[#718078]">Descrição e evidências enviadas no report</p></div></div><ReadOnlyBugDescription value={bug.description} images={bug.images || []} /></section><div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(150px,.7fr)_minmax(140px,.6fr)]"><div><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#89968f]">Caminho no sistema</p><p className="mt-1.5 text-xs leading-5 text-[#43574c]">{bug.system_path || 'Não informado'}</p></div><div><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#89968f]">Reportado por</p><p className="mt-1.5 text-xs font-semibold text-[#43574c]">{actorName(bug.author_email)}</p></div><div><p className="text-[8px] font-bold uppercase tracking-[.11em] text-[#89968f]">Atualizado</p><p className="mt-1.5 text-xs font-semibold text-[#43574c]">{formatDateTime(bug.updated_at)}</p></div></div></div></details>; })}</div>;
            })()}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={newReportOpen} onOpenChange={(open) => { setNewReportOpen(open); if (!open && !saving) { setRoundReportSource(null); setFromTestRound(false); setLinkedRoundId(''); setLinkedItemId(''); } }}>
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
                <div className="grid gap-4 sm:grid-cols-2"><Field label="Função"><Input name="function" required defaultValue={roundReportSource?.functionName || ''} placeholder="Integração SEED-PR" /></Field><Field label="Versão / rodada"><Input name="version" defaultValue={roundReportSource?.version || ''} placeholder="U+ 009/26" /></Field></div>
                <Field label="Caminho no sistema"><Input name="path" required defaultValue={roundReportSource?.path || ''} placeholder="Sua Conta > Integração > SEED-PR" /></Field>
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
            <DialogHeader className="report-hero-frame relative overflow-hidden border-b border-[#98bca5] px-6 pb-11 pt-6 sm:px-8 sm:pb-11 sm:pt-7">
              <div className="report-bug-track"><span className={`report-bug-traveler${bugSquashed ? ' is-squashed' : ''}`}><button type="button" className="report-bug-button" aria-label={bugSquashed ? 'Bug esmagado! Já já ele volta.' : 'Esmagar o inseto'} aria-disabled={bugSquashed} onClick={() => { if (!bugSquashed) setBugSquashed(true); }}><span className="report-bug-goo" aria-hidden="true"><i /><i /><i /><i /><i /></span><img src="/reports/walking-bug.png" alt="" width="48" height="28" /></button></span></div>
              <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#173e2c_0%,#4f8a63_58%,#d7ff66_100%)]" />
              <div aria-hidden="true" className="pointer-events-none absolute right-0 top-0 h-full w-[260px] bg-[radial-gradient(ellipse_at_center,#bade8790_0%,transparent_70%)]" />
              <button type="button" onClick={() => setSelectedReport(null)} aria-label="Fechar report" className="fixed right-[20vw] top-5 z-[60] grid size-10 place-items-center rounded-full border border-[#cbd9cf] bg-white text-[#5f7166] shadow-[0_8px_24px_rgb(16_44_32/18%)] transition hover:border-[#79a48a] hover:bg-[#f3f8f4] hover:text-[#173e2c]"><X className="size-4" /></button>
              <div className="relative z-[1] grid items-center gap-6 sm:grid-cols-[minmax(0,1fr)_136px]"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2 pr-10"><span className="rounded-lg border border-[#d9e2dc] bg-white px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wide text-[#63736a] shadow-sm">{selectedReport.id}</span><span className={`status status-${selectedReport.tone} border border-white shadow-sm`}><span />{selectedReport.status}</span>{reportDetail?.permissions && <Badge className={reportDetail.permissions.canEdit ? 'border border-[#b8d2c1] bg-[#eaf5ed] text-[#347951]' : 'border border-[#dde3df] bg-[#f0f2f1] text-[#69776f]'}>{reportDetail.permissions.isOwner ? 'SEU REPORT' : reportDetail.permissions.role === 'manager' ? 'ACESSO GERÊNCIA' : reportDetail.permissions.role === 'developer' ? 'FILA DEV' : reportDetail.permissions.canEdit ? 'EDIÇÃO COMPARTILHADA' : 'SOMENTE LEITURA'}</Badge>}</div>
              <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#587663]">Diagnóstico técnico</p><DialogTitle className="mt-2 break-words text-left text-2xl leading-tight tracking-tight text-[#172a20] sm:text-[28px]">{selectedReport.title}</DialogTitle><DialogDescription className="sr-only">Dados do cliente, cópia e versão deste report.</DialogDescription><dl className="report-context-strip mt-5 text-left"><div className="report-context-cell report-context-institution"><span className="report-context-icon"><Building2 className="size-4" /></span><div className="min-w-0"><dt>Instituição</dt><dd>{String(reportDetail?.report.institution || selectedReport.client)}</dd></div></div><div className="report-context-cell"><span className="report-context-icon"><FileArchive className="size-4" /></span><div className="min-w-0"><dt>Cópia</dt><dd>{String(reportDetail?.report.copy_number || selectedReport.copy)}</dd></div></div><div className="report-context-cell"><span className="report-context-icon"><Code2 className="size-4" /></span><div className="min-w-0"><dt>Versão</dt><dd>{String(reportDetail?.report.version || selectedReport.version)}</dd></div></div></dl></div></div>
              <div aria-hidden="true" className="report-inspector-scene relative hidden h-[140px] items-center justify-center sm:flex"><div className="report-inspector-halo absolute size-[120px] rounded-full border border-[#d8e5dc] bg-white/65" /><img src="/reports/quality-inspector.png" alt="" className="report-inspector-image relative z-[1] size-[136px] object-contain drop-shadow-[0_12px_18px_rgb(23_62_44/14%)]" /></div></div>
            </DialogHeader>
            <nav className="sticky top-0 z-20 flex items-center gap-1 border-b border-[#dce5df] bg-white/95 px-5 py-2.5 backdrop-blur-xl sm:px-7" aria-label="Seções do report">{[
              { id: 'summary', label: 'Visão geral', icon: LayoutDashboard },
              { id: 'activity', label: 'Histórico e resposta', icon: Activity },
              { id: 'files', label: 'Arquivos e acesso', icon: Paperclip },
            ].map((tab) => { const Icon = tab.icon; return <button type="button" key={tab.id} onClick={() => setReportTab(tab.id as typeof reportTab)} className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-[10px] font-semibold transition ${reportTab === tab.id ? 'bg-[#173e2c] text-white shadow-sm' : 'text-[#6f7f76] hover:bg-[#f0f4f1] hover:text-[#294c38]'}`}><Icon className="size-3.5" />{tab.label}</button>; })}</nav>
            {detailLoading && <div className="flex items-center justify-center gap-3 py-20 text-xs font-medium text-[#718078]"><span className="grid size-10 place-items-center rounded-2xl bg-white shadow-sm"><LoaderCircle className="size-4 animate-spin text-[#397657]" /></span> Carregando experiência do report...</div>}
            {!detailLoading && <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:p-7 [&>aside:last-child]:hidden">
              <section className="order-1 grid grid-cols-2 gap-2 lg:col-span-2 lg:grid-cols-4"><ReportMetric icon={ShieldCheck} label="Status atual" value={selectedReport.status} tone={statusTone(selectedReport.status) as 'green' | 'red' | 'blue' | 'amber'} /><ReportMetric icon={AlertTriangle} label="Prioridade" value={Number(reportDetail?.report.urgent) === 1 ? 'Alta' : 'Normal'} tone={Number(reportDetail?.report.urgent) === 1 ? 'red' : 'green'} /><ReportMetric icon={Users} label="Responsável" value={responsibleLabel(reportDetail?.report, selectedReport.status)} tone="blue" /><ReportMetric icon={Paperclip} label="Evidências" value={`${reportDetail?.attachments.length || 0} arquivo${reportDetail?.attachments.length === 1 ? '' : 's'}`} tone="amber" /></section>
              <aside className="order-3 space-y-4">
                {reportDetail?.permissions?.role === 'manager' && <section className="overflow-hidden rounded-[20px] border border-[#c9d8cf] bg-white shadow-[0_14px_38px_-30px_#102c20]"><div className="bg-[linear-gradient(135deg,#102b20,#1d5239)] p-4 text-white"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/10 text-[#d7ff66] ring-1 ring-white/10"><Code2 className="size-[18px]" /></span><div><p className="text-xs font-semibold">Enviar ao GitHub</p><p className="mt-0.5 text-[10px] text-white/58">Issue pronta, incluindo as imagens</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><Button type="button" variant="outline" onClick={() => void prepareForGitHub('preview')} disabled={githubWorking} className="h-10 rounded-xl border-white/25 bg-white/10 px-2 text-[11px] font-semibold text-white hover:bg-white/20 hover:text-white"><Eye className="size-4" />Pré-visualizar</Button><Button type="button" onClick={() => void prepareForGitHub('copy')} disabled={githubWorking} className="h-10 rounded-xl bg-[#d7ff66] px-2 text-[11px] font-semibold text-[#173e2c] shadow-sm hover:bg-[#c9f050]">{githubWorking ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />}{githubWorking ? 'Preparando…' : 'Copiar'}</Button></div></div><div className="p-4"><p className="text-[10px] leading-4 text-[#66776d]">Depois de criar a issue, cole o link abaixo para manter os dois registros conectados.</p><form onSubmit={saveGitHubIssue} className="mt-3 space-y-2"><div className="relative"><Link2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#6f8376]" /><Input key={String(reportDetail.report.github_issue_url || 'empty')} name="githubIssueUrl" type="url" defaultValue={String(reportDetail.report.github_issue_url || '')} placeholder="https://github.com/.../issues/123" className="h-9 rounded-xl border-[#d8e3dc] pl-9 text-[10px]" /></div><Button type="submit" variant="outline" disabled={githubWorking} className="h-9 w-full rounded-xl border-[#cbd9d0] text-[#315f45] hover:bg-[#edf5f0]">Salvar vínculo</Button></form>{reportDetail.report.github_issue_url && <a href={String(reportDetail.report.github_issue_url)} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#eef5f0] px-3 py-2 text-[10px] font-semibold text-[#397657]">Abrir issue vinculada <ExternalLink className="size-3" /></a>}{githubNotice && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-[10px] leading-4 ${githubNotice.tone === 'success' ? 'bg-[#e8f5ec] text-[#2e7048]' : 'bg-[#fff0ed] text-[#a04739]'}`}>{githubNotice.message}</p>}</div></section>}
                <section className="rounded-[20px] border border-[#cddfd3] bg-white p-4">
                  <div className="space-y-3"><div><p className="text-xs font-semibold  text-[#587663]">Responsável atual</p><p className="mt-1 text-sm font-semibold text-[#173e2c]">{responsibleLabel(reportDetail?.report, selectedReport.status)}</p><p className="mt-1 text-xs text-[#667c6e]">{reportResponsible(selectedReport.status)}</p></div>
                    {selectedReport.status === 'Com Desenvolvimento' && reportDetail?.permissions?.role === 'developer' && !reportDetail.report.developer_email && <Button type="button" onClick={() => void claimCorrection()} disabled={replying} className="mt-3 w-full bg-[#173e2c] text-white hover:bg-[#24573f]">{replying ? <LoaderCircle className="size-4 animate-spin" /> : <Users className="size-4" />}Assumir correção</Button>}
                  </div>
                  <details className="group mt-3 border-t border-[#e5ece7] pt-3"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-[#397657]">Pessoas no fluxo<ChevronRight className="size-3.5 transition group-open:rotate-90" /></summary><div className="mt-3 space-y-2"><InfoCard label="Reportado por" value={actorName(String(reportDetail?.report.author_email || '')) || selectedReport.reporterName} /><InfoCard label="DEV responsável" value={reportDetail?.report.developer_email ? actorName(String(reportDetail.report.developer_email)) : 'Ainda não assumido'} /><InfoCard label={selectedReport.status === 'Finalizado' ? 'Validado por' : 'Reteste com'} value={selectedReport.status === 'Finalizado' ? responsibleLabel(reportDetail?.report, selectedReport.status) : actorName(String(reportDetail?.report.author_email || '')) || selectedReport.reporterName} /></div></details>
                  {replyNotice && reportTab !== 'activity' && <p role="status" className={`mt-3 text-xs ${replyNotice.tone === 'error' ? 'text-[#a33e31]' : 'text-[#287443]'}`}>{replyNotice.message}</p>}
                </section>
                {reportTab === 'summary' && <>
                  {Number(reportDetail?.report.from_test_round) === 1 && <section className="overflow-hidden rounded-[20px] border border-[#cadecf] bg-white shadow-[0_12px_35px_-30px_#173e2c]"><div className="flex items-center gap-3 border-b border-[#e5ece7] bg-[linear-gradient(135deg,#edf6f0,#f8fbf9)] p-4"><span className="grid size-9 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ListChecks className="size-4" /></span><div><p className="detail-label text-[#397657]">Origem do report</p><p className="mt-1 text-xs font-semibold">Bug encontrado em rodada</p></div></div><div className="space-y-3 p-4"><div><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#87948d]">Rodada</p><p className="mt-1 text-[11px] font-semibold text-[#32463b]">{String(reportDetail?.report.test_round_title || 'Não informada')}</p><p className="mt-0.5 text-[9px] text-[#7d8a83]">{String(reportDetail?.report.test_round_version || '')}</p></div><div className="rounded-xl border border-[#e2e9e5] bg-[#f7faf8] p-3"><p className="text-[8px] font-bold uppercase tracking-[.1em] text-[#87948d]">Teste relacionado</p><p className="mt-1 text-[10px] font-semibold leading-4 text-[#405449]">{String(reportDetail?.report.test_item_title || 'Não informado')}</p></div></div></section>}
                  <section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#eef4f0] text-[#4d775f]"><LayoutDashboard className="size-3.5" /></span><div><p className="detail-label">Ficha técnica</p><p className="mt-0.5 text-[9px] text-[#849088]">Contexto para análise</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><InfoCard label="Ambiente beta" value={String(reportDetail?.report.beta_status || 'Não testado')} /><InfoCard label="Urgência" value={Number(reportDetail?.report.urgent) === 1 ? 'Prioritário' : 'Normal'} /><InfoCard label="Possui cópia" value={reportDetail?.attachments.some((file) => file.kind === 'backup') ? 'Sim' : 'Não'} /><InfoCard label="Possui anexos" value={reportDetail?.attachments.some((file) => file.kind !== 'backup') ? 'Sim' : 'Não'} /></div></section>
                </>}
                {reportTab === 'activity' && <section className="rounded-[20px] border border-[#d8e4dc] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><Activity className="size-4" /></span><div><p className="detail-label">Fluxo do report</p><p className="mt-0.5 text-[9px] text-[#849088]">Situação neste momento</p></div></div><div className="mt-4 space-y-2"><div className="flex items-center justify-between rounded-xl bg-[#f5f8f6] px-3 py-2.5"><span className="text-[9px] text-[#75837b]">Status</span><span className={`status status-${selectedReport.tone}`}><span />{selectedReport.status}</span></div><div className="flex items-center justify-between rounded-xl bg-[#f5f8f6] px-3 py-2.5"><span className="text-[9px] text-[#75837b]">Movimentações</span><strong className="text-[11px]">{reportDetail?.activities.length || 0}</strong></div><div className="flex items-center justify-between rounded-xl bg-[#f5f8f6] px-3 py-2.5"><span className="text-[9px] text-[#75837b]">Seu acesso</span><strong className="text-[10px]">{reportDetail?.permissions?.canEdit ? 'Pode responder' : 'Somente leitura'}</strong></div></div></section>}
                {reportTab === 'files' && <>
                  {reportDetail?.permissions?.isOwner && <section className="rounded-[20px] border border-[#bcd4c4] bg-[linear-gradient(145deg,#f7fbf8,#edf6f0)] p-4 shadow-[0_12px_35px_-28px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white text-[#397657] shadow-sm"><Share2 className="size-3.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#397657]">Compartilhar edição</p><p className="mt-0.5 text-[9px] text-[#74837b]">Controle quem pode colaborar</p></div></div><p className="mt-3 text-[10px] leading-4 text-[#617168]">Pessoas autorizadas podem responder, anexar arquivos e alterar o status.</p><form onSubmit={shareReport} className="mt-3 space-y-2"><Input name="shareEmail" type="email" required placeholder="email@empresa.com" className="h-9 rounded-xl bg-white text-[10px]" /><Button type="submit" disabled={sharing} className="h-9 w-full rounded-xl bg-[#173e2c] text-white">{sharing ? <LoaderCircle className="animate-spin" /> : <Plus />} Liberar edição</Button></form>{shareNotice && <p className={`mt-2 rounded-lg px-2 py-1.5 text-[9px] ${shareNotice.tone === 'success' ? 'bg-[#e6f3ea] text-[#397657]' : 'bg-[#fff0ed] text-[#a64b3e]'}`}>{shareNotice.message}</p>}<div className="mt-3 space-y-2">{reportDetail.shares?.map((share) => <div key={share.user_email} className="flex items-center gap-2 rounded-xl border border-[#e1e9e4] bg-white px-2.5 py-2"><span className="grid size-7 place-items-center rounded-full bg-[#d7ff66] text-[8px] font-bold text-[#294b37]">{initials(share.user_email.split('@')[0])}</span><span className="min-w-0 flex-1 truncate text-[9px] text-[#53655b]">{share.user_email}</span><button type="button" onClick={() => updateShare(share.user_email, 'remove')} disabled={sharing} className="rounded-md px-1.5 py-1 text-[8px] font-semibold text-[#a64b3e] hover:bg-[#fff0ed]">Remover</button></div>)}{!reportDetail.shares?.length && <p className="rounded-lg border border-dashed border-[#ccd9d1] px-3 py-2 text-center text-[9px] text-[#8a968f]">Acesso exclusivo do autor</p>}</div></section>}
                  <section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><ShieldCheck className="size-4" /></span><div><p className="text-xs font-semibold">Arquivos protegidos</p><p className="mt-1 text-[10px] leading-4 text-[#74837b]">As evidências ficam vinculadas ao report e disponíveis para a equipe autorizada.</p></div></div><div className="mt-4 grid grid-cols-2 gap-2"><InfoCard label="Cópia de segurança" value={reportDetail?.attachments.some((file) => file.kind === 'backup') ? 'Incluída' : 'Não incluída'} /><InfoCard label="Total de arquivos" value={String(reportDetail?.attachments.length || 0)} /></div></section>
                </>}
              </aside>
              <div className="order-2 space-y-5">
                {reportTab === 'summary' && <section className="rounded-[20px] border border-[#dde6e0] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]">
                  <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Sparkles className="size-3.5" /></span><p className="detail-label">Diagnóstico do problema</p></div>
                  <div className="relative mb-5 mt-4 overflow-hidden rounded-2xl border border-[#a8c6b3] bg-[linear-gradient(110deg,#e6f2ea,#f6faf7)] p-4 shadow-[0_5px_18px_rgb(23_62_44/8%)]">
                    <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#397657]" />
                    <div className="flex items-start gap-3 pl-1"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66] shadow-sm"><Code2 aria-hidden="true" className="size-5" /></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.08em] text-[#397657]">Caminho no sistema</p><p className="mt-1.5 break-words text-base font-semibold leading-6 text-[#173e2c] [overflow-wrap:anywhere]">{String(reportDetail?.report.system_path || 'Caminho informado no report')}</p></div></div>
                  </div>
                  <ReportDescription value={String(reportDetail?.report.description || 'Cliente tenta realizar a operação e o sistema apresenta um erro, impedindo a conclusão.')} attachments={reportDetail?.attachments || []} />
                </section>}
                {reportTab === 'activity' && <section className="rounded-[20px] border border-[#dde6e0] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Activity className="size-3.5" /></span><div><p className="detail-label">Linha do tempo</p><p className="mt-0.5 text-[10px] text-[#849088]">Histórico completo deste report</p></div></div><Badge className="bg-[#f0f4f1] text-[#64756b]">{reportDetail?.activities.length || 0} EVENTOS</Badge></div><div className="mt-5 space-y-3 border-l border-[#d9e4dd] pl-5">
                  {reportDetail?.activities.length ? reportDetail.activities.map((activity) => <Timeline key={activity.id} name={actorName(activity.actor_email)} role={activity.action === 'status_update' ? 'Atualização de status' : activity.action === 'attachment_added' ? 'Anexo' : 'Equipe'} time={formatDateTime(activity.created_at)} text={activity.message || 'Atualização registrada.'} highlighted={activity.action === 'status_update'} />) : <Timeline name="Equipe GEHA" role="Suporte" time="Histórico inicial" text="Report registrado para análise da equipe." />}
                </div></section>}
                {reportTab === 'activity' && (reportDetail?.permissions?.canEdit ? <form onSubmit={sendReply} className="rounded-[20px] border border-[#cfded5] bg-white p-4 shadow-[0_14px_40px_-32px_#173e2c]"><div className="flex items-center gap-2 px-1"><span className="grid size-7 place-items-center rounded-lg bg-[#173e2c] text-[#d7ff66]"><MessageSquareText className="size-3.5" /></span><div><p className="text-xs font-semibold">Registrar atualização</p><p className="text-[9px] text-[#849088]">Escolha somente a próxima etapa permitida no fluxo.</p></div></div>{selectedReport.status === 'Aguardando reteste' && <div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl border border-[#cce2d4] bg-[#f1faf4] p-3"><p className="text-[10px] font-semibold text-[#347650]">Funcionou</p><p className="mt-1 text-[9px] text-[#6e8075]">Selecione “OK — Finalizado”.</p></div><div className="rounded-xl border border-[#ead7ae] bg-[#fffaf0] p-3"><p className="text-[10px] font-semibold text-[#8a621c]">Problema continua</p><p className="mt-1 text-[9px] text-[#84745b]">Selecione “Voltar ao DEV”.</p></div></div>}<Textarea name="message" placeholder="Descreva a atualização ou o resultado do reteste..." className="mt-3 min-h-24 rounded-xl border-[#e1e8e4] bg-[#f9fbfa] p-3 shadow-none" /><div className="mt-3 grid gap-2 sm:grid-cols-[1fr_210px_auto]"><Input name="attachment" type="file" className="h-9 rounded-xl bg-white text-[10px]" aria-label="Anexar arquivo à resposta" /><select name="status" defaultValue={selectedReport.status} className="form-select h-9 rounded-xl">{reportWorkflowOptions(selectedReport.status, reportDetail.permissions.role, reportDetail.permissions.isOwner).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><Button type="submit" disabled={replying} className="h-9 rounded-xl bg-[#173e2c] text-white shadow-sm">{replying ? <LoaderCircle className="animate-spin" /> : <MessageSquareText />} {replying ? 'Enviando...' : 'Publicar'}</Button></div>{replyNotice && <div role="status" className={`mt-3 rounded-xl border px-3 py-2 text-[11px] ${replyNotice.tone === 'success' ? 'border-[#bfddc9] bg-[#eef8f1] text-[#2f7048]' : 'border-[#efc3bb] bg-[#fff2ef] text-[#9e3e31]'}`}>{replyNotice.message}</div>}</form> : reportDetail && <div className="flex items-start gap-3 rounded-[20px] border border-[#dce5df] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f0f3f1] text-[#728078]"><ShieldCheck className="size-4" /></span><div><p className="text-xs font-semibold">Report disponível somente para leitura</p><p className="mt-1 text-[10px] leading-4 text-[#74837b]">Você pode acompanhar todas as informações, mas somente o autor ou pessoas autorizadas podem responder, anexar arquivos e alterar o status.</p></div></div>)}
                {reportTab === 'files' && <section className="rounded-[20px] border border-[#dde6e0] bg-white p-5 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center justify-between"><div><p className="detail-label">Central de evidências</p><p className="mt-1 text-xs text-[#718078]">Arquivos, imagens e cópias anexados ao report.</p></div><span className="grid size-9 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><Paperclip className="size-4" /></span></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{reportDetail?.attachments.length ? reportDetail.attachments.map((file) => <Attachment key={file.id} id={file.id} name={file.file_name} size={formatBytes(file.byte_size)} csv={file.kind === 'backup'} />) : <p className="col-span-full rounded-2xl border border-dashed border-[#d4dfd8] bg-[#f8faf9] p-8 text-center text-[10px] text-[#7b8981]">Nenhum arquivo anexado a este report.</p>}</div></section>}
              </div>
              <aside className="space-y-4">{reportDetail?.permissions?.role === 'manager' && <section className="overflow-hidden rounded-[20px] border border-[#c9d8cf] bg-white shadow-[0_14px_38px_-30px_#102c20]"><div className="bg-[linear-gradient(135deg,#102b20,#1d5239)] p-4 text-white"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white/10 text-[#d7ff66] ring-1 ring-white/10"><Code2 className="size-[18px]" /></span><div><p className="text-xs font-semibold">Enviar ao GitHub</p><p className="mt-0.5 text-[10px] text-white/58">Issue pronta, incluindo as imagens</p></div></div><Button type="button" onClick={() => void prepareForGitHub('copy')} disabled={githubWorking} className="mt-4 h-10 w-full rounded-xl bg-[#d7ff66] font-semibold text-[#173e2c] shadow-sm hover:bg-[#c9f050]">{githubWorking ? <LoaderCircle className="size-4 animate-spin" /> : <Copy className="size-4" />}{githubWorking ? 'Preparando…' : 'Copiar para o GitHub'}</Button></div><div className="p-4"><p className="text-[10px] leading-4 text-[#66776d]">Depois de criar a issue, cole o link abaixo para manter os dois registros conectados.</p><form onSubmit={saveGitHubIssue} className="mt-3 space-y-2"><div className="relative"><Link2 className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[#6f8376]" /><Input key={String(reportDetail.report.github_issue_url || 'empty')} name="githubIssueUrl" type="url" defaultValue={String(reportDetail.report.github_issue_url || '')} placeholder="https://github.com/.../issues/123" className="h-9 rounded-xl border-[#d8e3dc] pl-9 text-[10px]" /></div><Button type="submit" variant="outline" disabled={githubWorking} className="h-9 w-full rounded-xl border-[#cbd9d0] text-[#315f45] hover:bg-[#edf5f0]">Salvar vínculo</Button></form>{reportDetail.report.github_issue_url && <a href={String(reportDetail.report.github_issue_url)} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#eef5f0] px-3 py-2 text-[10px] font-semibold text-[#397657]">Abrir issue vinculada <ExternalLink className="size-3" /></a>}{githubNotice && <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-[10px] leading-4 ${githubNotice.tone === 'success' ? 'bg-[#e8f5ec] text-[#2e7048]' : 'bg-[#fff0ed] text-[#a04739]'}`}>{githubNotice.message}</p>}</div></section>}{reportDetail?.permissions?.isOwner && <section className="rounded-[20px] border border-[#bcd4c4] bg-[linear-gradient(145deg,#f7fbf8,#edf6f0)] p-4 shadow-[0_12px_35px_-28px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white text-[#397657] shadow-sm"><Share2 className="size-3.5" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.1em] text-[#397657]">Compartilhar edição</p><p className="mt-0.5 text-[9px] text-[#74837b]">Controle de acesso ao report</p></div></div><p className="mt-3 text-[10px] leading-4 text-[#617168]">A pessoa poderá responder, anexar arquivos e alterar o status.</p><form onSubmit={shareReport} className="mt-3 space-y-2"><Input name="shareEmail" type="email" required placeholder="email@empresa.com" className="h-9 rounded-xl bg-white text-[10px]" /><Button type="submit" disabled={sharing} className="h-9 w-full rounded-xl bg-[#173e2c] text-white">{sharing ? <LoaderCircle className="animate-spin" /> : <Plus />} Liberar edição</Button></form>{shareNotice && <p className={`mt-2 rounded-lg px-2 py-1.5 text-[9px] ${shareNotice.tone === 'success' ? 'bg-[#e6f3ea] text-[#397657]' : 'bg-[#fff0ed] text-[#a64b3e]'}`}>{shareNotice.message}</p>}<div className="mt-3 space-y-2">{reportDetail.shares?.map((share) => <div key={share.user_email} className="flex items-center gap-2 rounded-xl border border-[#e1e9e4] bg-white px-2.5 py-2"><span className="grid size-7 place-items-center rounded-full bg-[#d7ff66] text-[8px] font-bold text-[#294b37]">{initials(share.user_email.split('@')[0])}</span><span className="min-w-0 flex-1 truncate text-[9px] text-[#53655b]">{share.user_email}</span><button type="button" onClick={() => updateShare(share.user_email, 'remove')} disabled={sharing} className="rounded-md px-1.5 py-1 text-[8px] font-semibold text-[#a64b3e] hover:bg-[#fff0ed]">Remover</button></div>)}{!reportDetail.shares?.length && <p className="rounded-lg border border-dashed border-[#ccd9d1] px-3 py-2 text-center text-[9px] text-[#8a968f]">Acesso exclusivo do autor</p>}</div></section>}{Number(reportDetail?.report.from_test_round) === 1 && <section className="rounded-[20px] border border-[#cfe0d5] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#edf5f0] text-[#397657]"><ListChecks className="size-3.5" /></span><p className="detail-label text-[#397657]">Bug de rodada</p></div><p className="mt-3 text-xs font-semibold">{String(reportDetail?.report.test_round_title || '')}</p><p className="mt-1 text-[10px] text-[#718078]">{String(reportDetail?.report.test_round_version || '')}</p><div className="mt-3 rounded-xl border border-[#e3eae6] bg-[#f7faf8] px-3 py-2"><p className="text-[9px] font-semibold uppercase text-[#849088]">Teste relacionado</p><p className="mt-1 text-[10px] font-semibold text-[#405449]">{String(reportDetail?.report.test_item_title || '')}</p></div></section>}<section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="grid grid-cols-2 gap-3"><InfoCard label="Responsável" value={responsibleLabel(reportDetail?.report, selectedReport.status)} /><InfoCard label="Urgência" value={Number(reportDetail?.report.urgent) === 1 ? 'Prioritário' : 'Normal'} /><InfoCard label="Ambiente beta" value={String(reportDetail?.report.beta_status || 'Não testado')} />{reportDetail && <InfoCard label="Evidências" value={`${reportDetail.attachments.length} arquivo${reportDetail.attachments.length === 1 ? '' : 's'}`} />}</div></section><section className="rounded-[20px] border border-[#dde6e0] bg-white p-4 shadow-[0_10px_35px_-30px_#173e2c]"><div className="flex items-center justify-between"><p className="detail-label">Arquivos</p><Paperclip className="size-3.5 text-[#849088]" /></div><div className="mt-3 space-y-2">{reportDetail?.attachments.length ? reportDetail.attachments.map((file) => <Attachment key={file.id} id={file.id} name={file.file_name} size={formatBytes(file.byte_size)} csv={file.kind === 'backup'} />) : <p className="rounded-xl border border-dashed border-[#d4dfd8] bg-[#f8faf9] p-4 text-center text-[9px] text-[#7b8981]">Nenhum arquivo anexado.</p>}</div></section></aside>
            </div>}
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(githubPreview)} onOpenChange={(open) => { if (!open) setGithubPreview(null); }}>
        <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col overflow-hidden rounded-[22px] border border-[#d3e2d7]">
          <DialogHeader className="flex shrink-0 items-start justify-between gap-4 border-b border-[#dce8df] bg-[linear-gradient(115deg,#102d21,#1e5038)] px-5 py-5 text-white sm:px-7">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-[#d7ff66]"><Eye className="size-5" /></span>
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#d7ff66]">Prévia da issue</p><DialogTitle className="mt-1 truncate text-xl text-white">{githubPreview?.title || 'Report para o GitHub'}</DialogTitle><DialogDescription className="mt-1 text-sm text-white/70">Confira antes de copiar. Nada foi publicado no GitHub.</DialogDescription></div>
            </div>
            <button type="button" onClick={() => setGithubPreview(null)} aria-label="Fechar prévia" className="grid size-9 shrink-0 place-items-center rounded-full border border-white/20 text-white transition hover:bg-white/10"><X className="size-4" /></button>
          </DialogHeader>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#e0e9e3] bg-[#f6faf7] px-5 py-3 sm:px-7">
            <div className="flex items-center gap-2 rounded-xl border border-[#cfe0d4] bg-white p-1" role="tablist" aria-label="Formato da prévia">
              <button type="button" role="tab" aria-selected={githubPreviewMode === 'visual'} onClick={() => setGithubPreviewMode('visual')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${githubPreviewMode === 'visual' ? 'bg-[#173e2c] text-white' : 'text-[#45624f] hover:bg-[#eef5f0]'}`}>Visual</button>
              <button type="button" role="tab" aria-selected={githubPreviewMode === 'markdown'} onClick={() => setGithubPreviewMode('markdown')} className={`rounded-lg px-3 py-2 text-sm font-semibold ${githubPreviewMode === 'markdown' ? 'bg-[#173e2c] text-white' : 'text-[#45624f] hover:bg-[#eef5f0]'}`}>Markdown</button>
            </div>
            <span className="rounded-full border border-[#d2e1d6] bg-white px-3 py-1.5 text-sm font-medium text-[#4a6856]">{githubPreview?.imageCount || 0} {(githubPreview?.imageCount || 0) === 1 ? 'imagem' : 'imagens'}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f4f7f5] p-4 sm:p-6">
            {githubPreview && (githubPreviewMode === 'visual' ? <GitHubMarkdownPreview markdown={githubPreview.markdown} /> : <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-2xl border border-[#dce7df] bg-white p-5 font-mono text-sm leading-6 text-[#254132]">{githubPreview.markdown}</pre>)}
          </div>
          <DialogFooter className="shrink-0 items-center justify-between gap-3 border-t border-[#dce8df] bg-white px-5 py-3 sm:px-7">
            <p role="status" className={`text-sm ${githubNotice?.tone === 'error' ? 'text-[#a04739]' : 'text-[#5e7265]'}`}>{githubNotice?.message || 'Prévia privada no sistema; o GitHub ainda não recebeu este conteúdo.'}</p>
            <Button type="button" onClick={() => void copyPreviewForGitHub()} disabled={githubWorking || !githubPreview} className="h-10 shrink-0 rounded-xl bg-[#173e2c] px-4 text-white hover:bg-[#24573f]"><Copy className="size-4" />Copiar conteúdo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function GitHubMarkdownPreview({ markdown }: { markdown: string }) {
  return <article className="github-markdown rounded-2xl border border-[#dce7df] bg-white px-5 py-6 shadow-[0_10px_30px_-26px_#173e2c] sm:px-8">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
      img: ({ src, alt }) => {
        let safePath = '';
        if (typeof src === 'string' && typeof window !== 'undefined') {
          try {
            const url = new URL(src, window.location.origin);
            if (url.origin === window.location.origin && /^\/api\/github-assets\/[a-f0-9]{32}$/.test(url.pathname)) safePath = url.pathname;
          } catch { /* Invalid image links are shown as text. */ }
        }
        return safePath ? <img src={safePath} alt={alt || 'Evidência do report'} loading="lazy" /> : <span className="github-preview-missing-image">Imagem externa não exibida na prévia: {alt || 'sem descrição'}</span>;
      },
      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    }}>{markdown}</ReactMarkdown>
  </article>;
}

function ReportsView({ reports, onSelect, role }: { reports: ReportItem[]; onSelect: (report: ReportItem) => void; role: TeamRole }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('Todos');
  const filteredReports = reports.filter((report) => {
    const haystack = `${report.id} ${report.title} ${report.client} ${report.copy} ${report.version}`.toLocaleLowerCase('pt-BR');
    const matchesQuery = haystack.includes(query.toLocaleLowerCase('pt-BR'));
    const matchesFilter = filter === 'Todos' || (filter === 'Novos' && report.status === 'Novo report') || (filter === 'Com o DEV' && report.status === 'Com Desenvolvimento') || (filter === 'Reteste' && report.status === 'Aguardando reteste') || (filter === 'Finalizados' && report.status === 'Finalizado');
    return matchesQuery && matchesFilter;
  });
  const scopeTitle = role === 'manager' ? 'Visão completa da Gerência' : role === 'developer' ? 'Fila do Desenvolvimento' : 'Seus reports';
  const scopeDescription = role === 'manager' ? 'Você acompanha todos os reports da equipe.' : role === 'developer' ? 'Aqui aparecem os reports enviados ao Desenvolvimento.' : 'Aqui aparecem somente os reports criados por você ou compartilhados com você.';
  return <div>
    <div className="flex items-center gap-3 rounded-2xl border border-[#d6e2da] bg-[linear-gradient(110deg,#ffffff_0%,#f4f8f5_100%)] px-4 py-3.5 shadow-[0_8px_24px_-25px_#173e2c]">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f3ec] text-[#397657] ring-1 ring-[#d6e4da]"><MessageSquareText className="size-4" /></span>
      <p className="text-xs leading-5 text-[#68786f] sm:text-[13px]"><strong className="font-semibold text-[#263b2f]">{scopeTitle}.</strong> {scopeDescription}</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><MiniStat value={String(reports.filter((report) => report.status !== 'Finalizado').length)} label="Reports abertos" tone="red" /><MiniStat value={String(reports.filter((report) => report.status === 'Aguardando reteste').length)} label="Aguardando reteste" tone="amber" /><MiniStat value={String(reports.filter((report) => report.status === 'Finalizado').length)} label="Reports finalizados" tone="green" /></div>
    <section className="mt-5 overflow-hidden rounded-2xl border border-[#dce5df] bg-white">
      <div className="flex flex-col gap-3 border-b border-[#e4ebe7] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">{['Todos', 'Novos', 'Com o DEV', 'Reteste', 'Finalizados'].map((item) => <button onClick={() => setFilter(item)} key={item} className={`rounded-lg px-3 py-1.5 text-[11px] font-medium ${filter === item ? 'bg-[#173e2c] text-white' : 'bg-[#f0f4f1] text-[#64756b] hover:bg-[#e5ece7]'}`}>{item}</button>)}</div>
        <div className="relative sm:w-64"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#849088]" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por cliente, função ou ID" aria-label="Buscar reports" className="h-9 rounded-xl bg-[#f8faf9] pl-8" /></div>
      </div>
      <div className="hidden grid-cols-[1.4fr_.65fr_.6fr_.4fr] gap-4 border-b border-[#e9eeeb] bg-[#fafcfb] px-5 py-2.5 text-[9px] font-bold uppercase tracking-[.1em] text-[#829087] md:grid"><span>Report</span><span>Versão / anexos</span><span>Status</span><span>Responsável</span></div>
      <div className="divide-y divide-[#e9eeeb]">{filteredReports.map((report) => <button key={report.id} onClick={() => onSelect(report)} className="group grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 text-left hover:bg-[#f8faf9] md:grid-cols-[1.4fr_.65fr_.6fr_.4fr]">
        <div className="min-w-0"><div className="flex items-center gap-2"><span className="font-mono text-[10px] font-semibold text-[#78877f]">{report.id}</span>{report.urgent && <Badge className="h-[18px] bg-[#fff0ed] px-1.5 text-[9px] text-[#b64738]">URGENTE</Badge>}{report.canEdit === false && <Badge className="h-[18px] bg-[#f0f2f1] px-1.5 text-[8px] text-[#6c7972]">LEITURA</Badge>}{report.canEdit && !report.isOwner && <Badge className="h-[18px] bg-[#edf7f0] px-1.5 text-[8px] text-[#377853]">{role === 'manager' ? 'GERÊNCIA' : role === 'developer' ? 'DEV' : 'COMPARTILHADO'}</Badge>}</div><p className="mt-1 truncate text-[13px] font-semibold">{report.title}</p><p className="mt-1 truncate text-[11px] text-[#75847c]">{report.client} · {report.copy}</p></div>
        <div className="hidden md:block"><p className="text-[11px] font-medium">{report.version}</p><p className="mt-1 flex items-center gap-1 text-[10px] text-[#849088]"><Paperclip className="size-3" />{report.attachments} anexos</p></div>
        <div className="hidden md:block"><span className={`status status-${report.tone}`}><span />{report.status}</span><p className="mt-1.5 text-xs text-[#53665b]">{report.responsibleName || 'Aguardando responsável'}</p></div>
        <div className="flex items-center justify-end gap-2 md:justify-start"><span className="grid size-7 place-items-center rounded-full bg-[#e6ece8] text-[9px] font-semibold text-[#385144]">{initials(report.responsibleName || '?')}</span><span className="text-xs text-[#344b3f]">{report.responsibleName || 'Aguardando responsável'}</span><ChevronRight className="size-4 text-[#a1ada6] transition group-hover:translate-x-0.5" /></div>
      </button>)}{filteredReports.length === 0 && <div className="py-14 text-center"><Search className="mx-auto size-5 text-[#9aa59f]" /><p className="mt-3 text-xs font-medium">Nenhum report encontrado</p><p className="mt-1 text-[10px] text-[#87938c]">Ajuste a busca ou selecione outro filtro.</p></div>}</div>
    </section>
  </div>;
}

function RoundsView({ onCreateReport, reports, currentUser }: { onCreateReport: (round: TestRound, item: TestRoundItem, note: string) => void; reports: ReportItem[]; currentUser: CurrentUser }) {
  const [rounds, setRounds] = useState<TestRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [roundScope, setRoundScope] = useState<'active' | 'history'>('active');
  const [newRoundOpen, setNewRoundOpen] = useState(false);
  const [participantPickerOpen, setParticipantPickerOpen] = useState(false);
  const [draftItems, setDraftItems] = useState<Array<{ key: number; title: string; path: string; description: string; images: File[]; previews: string[] }>>([{ key: 1, title: '', path: '', description: '', images: [], previews: [] }]);
  const [roundDraft, setRoundDraft] = useState({ title: 'Rodada de testes', version: '', deadline: '', description: '' });
  const [tagsOpen, setTagsOpen] = useState(false);
  const [roundTags, setRoundTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');
  const [roundTeamMembers, setRoundTeamMembers] = useState<TeamMember[]>([]);
  const [selectedTesterEmails, setSelectedTesterEmails] = useState<string[]>([]);
  const [selectedItem, setSelectedItem] = useState<TestRoundItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingRound, setSavingRound] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [itemFilter, setItemFilter] = useState('Todos');
  const [itemQuery, setItemQuery] = useState('');
  const [resultStatus, setResultStatus] = useState('Pendente');
  const [bugReportChoice, setBugReportChoice] = useState<'create' | 'existing'>('create');
  const [existingReportId, setExistingReportId] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<RoundParticipant | null>(null);
  const [extendedDeadline, setExtendedDeadline] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);

  useEffect(() => {
    if (notice?.tone !== 'success') return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const loadRounds = () => fetch('/api/rounds').then(async (response) => {
      if (!response.ok) throw new Error('Não foi possível carregar as rodadas.');
      return response.json() as Promise<{ rounds: TestRound[] }>;
    }).then((payload) => {
      const active = payload.rounds.filter((round) => round.status !== 'Finalizada');
      const archived = payload.rounds.filter((round) => round.status === 'Finalizada');
      setRounds(payload.rounds);
      setRoundScope((current) => current === 'active' && active.length === 0 && archived.length > 0 ? 'history' : current);
      setSelectedRoundId((current) => current && payload.rounds.some((round) => round.id === current) ? current : (active[0] || archived[0])?.id || null);
    }).catch((error) => setNotice({ tone: 'error', message: error.message })).finally(() => setLoading(false));
    void loadRounds();
    window.addEventListener('official-report-created', loadRounds);
    return () => window.removeEventListener('official-report-created', loadRounds);
  }, []);

  useEffect(() => { fetch('/api/team').then(async (response) => response.ok ? await response.json() as { members: TeamMember[] } : null).then((payload) => payload && setRoundTeamMembers(payload.members)).catch(() => undefined); }, []);

  useEffect(() => { if (selectedItem) { setResultStatus(selectedItem.status); setBugReportChoice(selectedItem.linked_report_id ? 'existing' : 'create'); setExistingReportId(selectedItem.linked_report_id || ''); } }, [selectedItem]);

  useEffect(() => {
    const openNewRound = () => { if (currentUser.role !== 'manager') return; setParticipantPickerOpen(false); setNewRoundOpen(true); };
    window.addEventListener('open-new-round', openNewRound);
    return () => window.removeEventListener('open-new-round', openNewRound);
  }, []);

  const activeRounds = rounds.filter((round) => round.status !== 'Finalizada');
  const archivedRounds = rounds.filter((round) => round.status === 'Finalizada');
  const scopedRounds = roundScope === 'active' ? activeRounds : archivedRounds;
  const selectedRound = scopedRounds.find((round) => round.id === selectedRoundId) || scopedRounds[0] || null;
  const roundReadonly = selectedRound?.status === 'Finalizada';
  const tested = selectedRound?.items.filter((item) => ['Aprovado', 'Com bug'].includes(item.status)).length || 0;
  const progress = selectedRound?.items.length ? Math.round((tested / selectedRound.items.length) * 100) : 0;
  const pendingCount = selectedRound?.items.filter((item) => item.status === 'Pendente').length || 0;
  const approvedCount = selectedRound?.items.filter((item) => item.status === 'Aprovado').length || 0;
  const bugCount = selectedRound?.items.filter((item) => item.status === 'Com bug').length || 0;
  const beaconPowered = Boolean(selectedRound?.items.some((item) => item.status !== 'Pendente'));
  const participants = selectedRound?.participants || [];
  const canRespond = participants.some((participant) => participant.is_current);
  const itemReadonly = roundReadonly || !canRespond;
  const completedParticipants = participants.filter((participant) => participant.progress === 100);
  const canRemindParticipants = currentUser.role === 'manager' || selectedRound?.author_email.toLowerCase() === currentUser.email.toLowerCase();
  const canManageParticipantDeadlines = !roundReadonly && selectedRound?.author_email.toLowerCase() === currentUser.email.toLowerCase();
  const visibleItems = selectedRound?.items.filter((item) => {
    const matchesFilter = itemFilter === 'Todos' || item.status === itemFilter;
    const searchable = `${item.title} ${item.path || ''} ${item.description || ''} ${item.result_note || ''}`.toLocaleLowerCase('pt-BR');
    return matchesFilter && searchable.includes(itemQuery.toLocaleLowerCase('pt-BR'));
  }) || [];
  const completedDraftItems = draftItems.filter((item) => item.title.trim() && item.description.trim()).length;
  const identificationProgress = [roundDraft.version.trim(), roundDraft.deadline].filter(Boolean).length;
  const identificationReady = identificationProgress === 2;
  const roundReady = identificationReady && completedDraftItems === draftItems.length;
  const participantsReady = selectedTesterEmails.length > 0;
  const nextAction = roundReadonly
    ? { title: 'Rodada arquivada', text: 'Resultados e estatísticas preservados para consulta.', tone: 'green' }
    : progress === 100
    ? { title: 'Encerrando rodada', text: 'Todos os participantes concluíram a validação.', tone: 'green' }
    : bugCount > 0
      ? { title: 'Atenção aos problemas', text: `${bugCount} ${bugCount === 1 ? 'item precisa' : 'itens precisam'} de acompanhamento e report.`, tone: 'red' }
      : { title: 'Próximo passo', text: pendingCount > 0 ? 'Abra o próximo item pendente e registre o resultado.' : 'Cadastre itens para iniciar esta rodada.', tone: 'amber' };

  function addRoundTag(value = tagDraft) {
    const tag = value.trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').slice(0, 30);
    if (!tag || roundTags.includes(tag) || roundTags.length >= 12) return;
    setRoundTags((current) => [...current, tag]); setTagDraft('');
  }

  function selectTesters(scope: 'all' | TeamRole) {
    const emails = roundTeamMembers.filter((member) => scope === 'all' || member.role === scope).map((member) => member.email.toLowerCase());
    setSelectedTesterEmails(emails);
  }

  function toggleTester(email: string) {
    const normalized = email.toLowerCase();
    setSelectedTesterEmails((current) => current.includes(normalized) ? current.filter((entry) => entry !== normalized) : [...current, normalized]);
  }

  function reminderEmailHref(participant: RoundParticipant) {
    if (!selectedRound) return 'https://mail.google.com/mail/';
    const firstName = participant.user_name.trim().split(/\s+/)[0] || 'Olá';
    const remainingItems = Math.max(0, participant.total_items - participant.done_items);
    const participantDeadline = participant.deadline_override || selectedRound.deadline;
    const deadline = new Date(`${participantDeadline}T23:59:59`);
    const daysUntilDeadline = Number.isNaN(deadline.getTime()) ? null : Math.ceil((deadline.getTime() - Date.now()) / 86_400_000);
    const deadlineStatus = daysUntilDeadline === null
      ? 'Aguardando sua conclusão'
      : daysUntilDeadline < 0
        ? `Prazo encerrado há ${Math.abs(daysUntilDeadline)} ${Math.abs(daysUntilDeadline) === 1 ? 'dia' : 'dias'}`
        : daysUntilDeadline === 0
          ? 'O prazo termina hoje'
          : `Faltam ${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'dia' : 'dias'} para o prazo`;
    const subjectPrefix = daysUntilDeadline !== null && daysUntilDeadline < 0 ? 'Prazo encerrado' : 'Ação pendente';
    const subject = `${subjectPrefix} | Rodada de testes: ${selectedRound.title}`;
    const body = `Olá, ${firstName}!\n\nPassando para acompanhar sua participação na rodada de testes abaixo. Ainda existem resultados aguardando o seu registro.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nRESUMO DA VALIDAÇÃO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\nRodada: ${selectedRound.title}\nVersão: ${selectedRound.version}\nSeu progresso: ${participant.done_items} de ${participant.total_items} testes concluídos (${participant.progress}%)\nPendências: ${remainingItems} ${remainingItems === 1 ? 'teste' : 'testes'}\nPrazo${participant.deadline_override ? ' individual' : ''}: ${formatRoundDate(participantDeadline)}\nSituação: ${deadlineStatus}\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\nPRECISAMOS DO SEU RETORNO\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n• Ficou alguma dúvida durante a validação?\n• Encontrou algum impedimento para concluir os testes?\n• Precisa de apoio ou de uma extensão do prazo?\n\nAcesse a rodada e registre os resultados pendentes:\nhttps://geha-resolve.dooartstudio.workers.dev/\n\nSe já concluiu os testes, basta confirmar os resultados no sistema para atualizar o acompanhamento da equipe.\n\nObrigado,\nEquipe de Qualidade\nThe Bugs on the Table`;
    return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(participant.user_email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function openDeadlineManager(participant: RoundParticipant) {
    if (!selectedRound || !canManageParticipantDeadlines || participant.progress === 100) return;
    const currentDeadline = participant.deadline_override || selectedRound.deadline;
    const nextDeadline = new Date(`${currentDeadline}T12:00:00`);
    nextDeadline.setDate(nextDeadline.getDate() + 1);
    setSelectedParticipant(participant);
    setExtendedDeadline(nextDeadline.toISOString().slice(0, 10));
  }

  async function extendParticipantDeadline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRound || !selectedParticipant || !extendedDeadline) return;
    setSavingDeadline(true); setNotice(null);
    try {
      const response = await fetch(`/api/rounds/${encodeURIComponent(selectedRound.id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ participantEmail: selectedParticipant.user_email, deadline: extendedDeadline }) });
      const payload = await response.json() as { deadline_override?: string; error?: string };
      if (!response.ok || !payload.deadline_override) throw new Error(payload.error || 'Não foi possível estender o prazo.');
      const refreshed = await fetch('/api/rounds');
      if (!refreshed.ok) throw new Error('O prazo foi salvo, mas não foi possível atualizar o painel.');
      const refreshedPayload = await refreshed.json() as { rounds: TestRound[] };
      setRounds(refreshedPayload.rounds);
      setSelectedParticipant(null);
      setNotice({ tone: 'success', message: `Novo prazo de ${selectedParticipant.user_name}: ${formatRoundDate(payload.deadline_override)}.` });
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível estender o prazo.' }); }
    finally { setSavingDeadline(false); }
  }

  function openParticipantPicker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!roundReady) return;
    setNewRoundOpen(false);
    setParticipantPickerOpen(true);
  }

  async function createRound(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(null); setSavingRound(true);
    const items = draftItems.map(({ title, path, description }) => ({ title: title.trim(), path: path.trim(), description: description.trim() })).filter((item) => item.title);
    try {
      const payloadData = { title: roundDraft.title, version: roundDraft.version, deadline: roundDraft.deadline, description: roundDraft.description, tags: roundTags, participantEmails: selectedTesterEmails, items };
      const formData = new FormData(); formData.set('payload', JSON.stringify(payloadData));
      draftItems.forEach((item, index) => item.images.forEach((file) => formData.append(`itemImages_${index}`, file)));
      const response = await fetch('/api/rounds', { method: 'POST', body: formData });
      const payload = await response.json() as { round?: TestRound; error?: string };
      if (!response.ok || !payload.round) throw new Error(payload.error || 'Não foi possível criar a rodada.');
      const refreshed = await fetch('/api/rounds');
      const refreshedPayload = refreshed.ok ? await refreshed.json() as { rounds: TestRound[] } : null;
      setRounds(refreshedPayload?.rounds || ((current) => [payload.round!, ...current])); setRoundScope('active'); setSelectedRoundId(payload.round.id); setNewRoundOpen(false); setParticipantPickerOpen(false); draftItems.forEach((item) => item.previews.forEach((preview) => URL.revokeObjectURL(preview))); setDraftItems([{ key: Date.now(), title: '', path: '', description: '', images: [], previews: [] }]); setRoundDraft({ title: 'Rodada de testes', version: '', deadline: '', description: '' }); setRoundTags([]); setTagDraft(''); setTagsOpen(false); setSelectedTesterEmails([]); setNotice({ tone: 'success', message: `Rodada criada para ${selectedTesterEmails.length} ${selectedTesterEmails.length === 1 ? 'participante' : 'participantes'}.` });
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível criar a rodada.' }); }
    finally { setSavingRound(false); }
  }

  async function updateItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selectedRound || !selectedItem) return;
    if (selectedRound.status === 'Finalizada' || !canRespond) { setNotice({ tone: 'error', message: selectedRound.status === 'Finalizada' ? 'Esta rodada foi encerrada e está disponível somente para consulta.' : 'Você não foi selecionado para executar esta rodada.' }); return; }
    setSavingItem(true); setNotice(null);
    const data = new FormData(event.currentTarget);
    const status = String(data.get('status') || ''), note = String(data.get('note') || '').trim();
    try {
      const response = await fetch(`/api/rounds/${encodeURIComponent(selectedRound.id)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemId: selectedItem.id, status: data.get('status'), note: data.get('note'), existingReportId: status === 'Com bug' && bugReportChoice === 'existing' ? existingReportId : '' }) });
      const payload = await response.json() as { item?: Partial<TestRoundItem> & { id: string }; participantCompleted?: boolean; roundCompleted?: boolean; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || 'Não foi possível atualizar o teste.');
      const refreshed = await fetch('/api/rounds');
      if (!refreshed.ok) throw new Error('O resultado foi salvo, mas não foi possível atualizar o painel.');
      const refreshedPayload = await refreshed.json() as { rounds: TestRound[] };
      setRounds(refreshedPayload.rounds);
      if (payload.roundCompleted) setRoundScope('history');
      const shouldCreateReport = status === 'Com bug' && bugReportChoice === 'create' && !selectedItem.linked_report_id;
      const linkedExisting = status === 'Com bug' && bugReportChoice === 'existing' && Boolean(existingReportId);
      setSelectedItem(null); setNotice({ tone: 'success', message: payload.roundCompleted ? 'Rodada concluída e movida para o histórico. Os resultados agora são somente para consulta.' : shouldCreateReport ? 'Resultado salvo. Complete apenas os dados restantes do report oficial.' : linkedExisting ? `Resultado salvo e vinculado ao report ${existingReportId}.` : 'Resultado do teste registrado.' });
      if (shouldCreateReport) onCreateReport(selectedRound, selectedItem, note);
    } catch (error) { setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar o teste.' }); }
    finally { setSavingItem(false); }
  }

  return <div className="rounds-workspace overflow-hidden rounded-[22px] border border-[#cddbd2] bg-white shadow-[0_24px_60px_-44px_#173e2c]">

    {notice && <div role="status" className={`mx-4 mt-4 flex items-center gap-3 rounded-xl border px-4 py-2 text-sm sm:mx-5 ${notice.tone === 'success' ? 'border-[#b8d8c3] bg-[#e9f7ed] text-[#286541]' : 'border-[#edbdb4] bg-[#fff0ed] text-[#96392e]'}`}><span className="flex-1">{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Fechar aviso" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-black/5 focus-visible:outline focus-visible:outline-2"><X className="size-4" /></button></div>}
    {loading ? <div className="flex min-h-[420px] items-center justify-center gap-3 text-sm text-[#617169]"><LoaderCircle className="size-5 animate-spin text-[#397657]" /> Carregando rodadas...</div> : !selectedRound ? <section className="m-4 grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[#afc5b7] bg-[#fafcfb] p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ListChecks className="size-5" /></span><h3 className="mt-4 text-lg font-semibold text-[#20372b]">Nenhuma rodada criada</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#6d7c74]">{currentUser.role === 'manager' ? 'Crie uma rodada para organizar os cenários de validação.' : 'Quando a gerência liberar uma rodada, ela aparecerá aqui para você.'}</p>{currentUser.role === 'manager' && <Button type="button" onClick={() => setNewRoundOpen(true)} className="mt-5 h-10 rounded-lg bg-[#173e2c] px-5 text-white"><Plus className="size-4" /> Criar rodada</Button>}</div></section> : <div className="grid xl:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="rounds-rail border-b border-[#d7e2db] p-3 xl:border-b-0 xl:border-r xl:p-4">
        <div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#587164]">Rodadas de testes</p><p className="mt-1 text-sm text-[#7a8981]">Operação e histórico</p></div><span className="grid size-9 place-items-center rounded-xl border border-[#d5e1d9] bg-white text-[#397657]"><PackageCheck className="size-4" /></span></div>
        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-[#d7e2db] bg-white/75 p-1"><button type="button" disabled={activeRounds.length === 0} onClick={() => { setRoundScope('active'); setSelectedRoundId(activeRounds[0]?.id || null); }} className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${roundScope === 'active' ? 'bg-[#173e2c] text-white shadow-sm' : 'text-[#65766d] hover:bg-[#edf3ef]'}`}>Ativas <span className={roundScope === 'active' ? 'text-[#d7ff66]' : 'text-[#87958d]'}>{activeRounds.length}</span></button><button type="button" disabled={archivedRounds.length === 0} onClick={() => { setRoundScope('history'); setSelectedRoundId(archivedRounds[0]?.id || null); }} className={`rounded-lg px-2 py-2 text-[11px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${roundScope === 'history' ? 'bg-[#173e2c] text-white shadow-sm' : 'text-[#65766d] hover:bg-[#edf3ef]'}`}>Histórico <span className={roundScope === 'history' ? 'text-[#d7ff66]' : 'text-[#87958d]'}>{archivedRounds.length}</span></button></div>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible">{scopedRounds.map((round) => { const roundDone = round.items.filter((item) => ['Aprovado','Com bug'].includes(item.status)).length; const roundProgress = round.items.length ? Math.round((roundDone / round.items.length) * 100) : 0; const active = round.id === selectedRound.id; return <button type="button" onClick={() => setSelectedRoundId(round.id)} key={round.id} className={`group/round min-w-[220px] overflow-hidden rounded-xl border px-3 py-3 text-left transition xl:min-w-0 ${active ? 'border-[#397657] bg-[linear-gradient(135deg,#173e2c,#245d40)] text-white shadow-[0_14px_28px_-20px_#173e2c]' : 'border-[#dae4de] bg-white/75 text-[#2d4236] hover:border-[#9db9a7] hover:bg-white hover:shadow-sm'}`}><div className="flex items-center gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${active ? 'bg-[#d7ff66] text-[#173e2c] shadow-sm' : 'bg-[#e5ece8] text-[#5c7064]'}`}>{roundScope === 'history' ? <FileArchive className="size-4" /> : `${roundProgress}%`}</span><span className="min-w-0 flex-1"><span className={`block truncate text-sm font-semibold ${active ? 'text-white' : 'text-[#263b30]'}`}>{round.title}</span><span className={`mt-0.5 block truncate text-xs ${active ? 'text-white/55' : 'text-[#7d8b83]'}`}>{roundScope === 'history' ? `Encerrada · ${roundProgress}%` : `${round.version} · ${roundDone}/${round.items.length}`}</span></span><ChevronRight className={`size-4 transition group-hover/round:translate-x-0.5 ${active ? 'text-[#d7ff66]' : 'text-[#7f9889]'}`} /></div><div className={`mt-3 h-1 overflow-hidden rounded-full ${active ? 'bg-white/12' : 'bg-[#e8eeea]'}`}><span style={{ width: `${roundProgress}%` }} className={`block h-full rounded-full ${active ? 'bg-[#d7ff66]' : 'bg-[#4f8b65]'}`} /></div></button>; })}</div>
      </aside>

      <main className="min-w-0 p-3 sm:p-4">
        <section className="rounds-summary relative overflow-hidden rounded-2xl border border-[#cfe0d5] p-4 shadow-[0_14px_32px_-28px_#173e2c] sm:p-5">
          <div className="relative grid gap-4 lg:grid-cols-[minmax(0,1fr)_132px_220px] lg:items-center">
            <div className="min-w-0 round-summary-copy">
              <div className="flex flex-wrap items-center gap-3"><Badge className="round-summary-status">{selectedRound.status}</Badge><span className="round-summary-eyebrow">Rodada de testes</span></div>
              <h2 className="round-summary-title">{selectedRound.title}</h2>
              <dl className="round-summary-details"><div><dt>Versão</dt><dd>{selectedRound.version}</dd></div><div><dt>{roundReadonly ? 'Encerrada em' : 'Prazo da rodada'}</dt><dd>{roundReadonly ? new Date(selectedRound.updated_at).toLocaleDateString('pt-BR') : formatRoundDate(selectedRound.deadline)}</dd></div></dl>
              {roundReadonly && <p className="mt-3 flex items-center gap-1.5 text-xs"><ShieldCheck className="size-3.5" /> Histórico protegido contra alterações</p>}
              {Boolean(selectedRound.tags?.length) && <div className="mt-3 flex flex-wrap gap-1.5">{selectedRound.tags!.slice(0,5).map((tag) => <span key={tag} className="rounded-md px-2 py-1 text-xs">{tag}</span>)}</div>}
            </div>
            <div className="hidden h-[126px] items-center justify-center lg:flex" role="img" aria-label={`${completedParticipants.length} de ${participants.length} participantes concluíram`}>
              <div className={`round-orbit ${roundReadonly ? 'round-orbit-complete' : ''}`}>
                <span className="round-orbit-track" /><span className="round-orbit-satellite" />
                <svg className="round-orbit-progress" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="45" fill="none" stroke="#dce8df" strokeWidth="3" /><circle cx="60" cy="60" r="45" fill="none" stroke="#438461" strokeWidth="3" strokeLinecap="round" pathLength="100" strokeDasharray={`${participants.length ? completedParticipants.length / participants.length * 100 : 0} 100`} transform="rotate(-90 60 60)" /></svg>
                <span className="round-orbit-core"><ListChecks className="size-5 text-[#d7ff66]" /><strong>{completedParticipants.length}<span>/{participants.length}</span></strong><small>equipe</small></span>
              </div>
            </div>
            <div className="rounded-xl border border-[#214a35] bg-[linear-gradient(135deg,#123a29,#1e5b3d)] p-3.5 text-white shadow-[0_12px_24px_-18px_#173e2c]"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-white/65">{roundReadonly ? 'Resultado final' : 'Meu progresso'}</span><strong className="text-xl text-[#d7ff66]">{progress}%</strong></div><div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-white/12"><span style={{ width: `${progress}%` }} className="block h-full rounded-full bg-[linear-gradient(90deg,#72ad60,#d7ff66)] shadow-[0_0_10px_#d7ff6680] transition-[width] duration-500" /></div><p className="mt-2 text-xs text-white/55">{tested} de {selectedRound.items.length} concluídos</p><div className="mt-3 flex items-center gap-2 border-t border-white/10 pt-3 text-xs text-white/60"><span className={`size-2 rounded-full ${progress === 100 ? 'bg-[#d7ff66]' : 'animate-pulse bg-[#82c692]'}`} />{roundReadonly ? 'Estatísticas preservadas' : progress === 100 ? 'Validação concluída' : 'Rodada em execução'}</div></div>
          </div>
        </section>

        <div className="mt-3 flex flex-wrap items-center gap-2">{[[pendingCount,'Pendente','border-[#d9e1dc] bg-[#f3f6f4] text-[#5f7067]'],[approvedCount,'Aprovado','border-[#c7e1d0] bg-[#eaf7ee] text-[#2f744b]'],[bugCount,'Com bug','border-[#efc8c1] bg-[#fff0ed] text-[#a84739]']].map(([value,label,tone]) => <span key={String(label)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm ${tone}`}><strong className="text-base">{String(value)}</strong>{String(label)}</span>)}</div>

        <div className="mt-4 grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_280px]">
<section className="rounds-table overflow-hidden rounded-xl border border-[#cfdcd4] bg-white shadow-[0_14px_34px_-30px_#173e2c]">
            <div className="flex flex-col gap-3 border-b border-[#d7e3db] bg-[linear-gradient(135deg,#f9fcfa,#edf5f0)] p-3 lg:flex-row lg:items-center lg:justify-between"><div className="flex gap-1 overflow-x-auto rounded-lg border border-[#d6e2da] bg-white/85 p-1 shadow-sm">{['Todos','Pendente','Aprovado','Com bug'].map((filter) => { const count = filter === 'Todos' ? selectedRound.items.length : selectedRound.items.filter((item) => item.status === filter).length; return <button type="button" aria-pressed={itemFilter === filter} onClick={() => setItemFilter(filter)} key={filter} className={`shrink-0 rounded-md px-3 py-2 text-xs font-semibold transition ${itemFilter === filter ? 'bg-[#173e2c] text-white shadow-sm' : 'text-[#617169] hover:bg-[#eaf0ec]'}`}>{filter}<span className={`ml-1.5 ${itemFilter === filter ? 'text-[#d7ff66]' : 'text-[#8c9991]'}`}>{count}</span></button>; })}</div><div className="relative w-full lg:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#648070]" /><Input aria-label="Buscar cenário" value={itemQuery} onChange={(event) => setItemQuery(event.target.value)} placeholder="Buscar cenário" className="h-10 rounded-lg border-[#cadbd0] bg-white pl-9 text-sm shadow-sm" /></div></div>
            <div className="hidden grid-cols-[44px_minmax(0,1fr)_112px_36px] gap-3 border-b border-[#e3ebe6] bg-[#fbfcfb] px-4 py-2.5 text-xs font-bold uppercase tracking-[.06em] text-[#829087] sm:grid"><span>#</span><span>Cenário</span><span>Responsável</span><span /></div>
            <div className="divide-y divide-[#e8eeea]">{visibleItems.map((item) => { const approved = item.status === 'Aprovado'; const hasBug = item.status === 'Com bug'; return <button type="button" onClick={() => setSelectedItem(item)} key={item.id} className="round-test-row group relative grid w-full gap-3 bg-white px-4 py-3.5 text-left transition hover:bg-[#f1f8f4] sm:grid-cols-[44px_minmax(0,1fr)_112px_36px] sm:items-center"><span className={`grid size-9 place-items-center rounded-lg shadow-sm ring-1 ring-white ${approved ? 'bg-[#dff2e6] text-[#2f744b]' : hasBug ? 'bg-[#ffe8e3] text-[#ad493a]' : 'bg-[#e9eeeb] text-[#63736a]'}`}>{approved ? <Check className="size-4" /> : hasBug ? <Bug className="size-4" /> : <span className="text-xs font-bold">{String(item.position).padStart(2,'0')}</span>}</span><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="truncate text-sm text-[#263b30]">{item.title}</strong><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${approved ? 'bg-[#e7f5ec] text-[#347951]' : hasBug ? 'bg-[#fff0ed] text-[#ad493a]' : 'bg-[#eef1ef] text-[#63736a]'}`}>{item.status}</span></span><span className="mt-1 block truncate text-xs text-[#74837b]">{item.path || `Cenário ${item.position}`}</span></span><span className="text-xs font-medium text-[#5f7067]">{item.tester_name || (item.tester_email ? item.tester_email.split('@')[0] : '—')}</span><span className="grid size-8 place-items-center rounded-lg border border-transparent text-[#63806f] transition group-hover:translate-x-0.5 group-hover:border-[#c4d8cb] group-hover:bg-white group-hover:text-[#245d40] group-hover:shadow-sm"><ChevronRight className="size-4" /></span></button>; })}{visibleItems.length === 0 && <div className="px-6 py-12 text-center"><Search className="mx-auto size-5 text-[#91a097]" /><p className="mt-3 text-sm font-semibold text-[#34483d]">Nenhum cenário encontrado</p><p className="mt-1 text-xs text-[#7b8981]">Altere o filtro ou a busca.</p></div>}</div>
          </section>

          <aside className="space-y-3 2xl:sticky 2xl:top-4">
            <section className={`overflow-hidden rounded-xl border shadow-[0_10px_24px_-20px_#173e2c] ${nextAction.tone === 'green' ? 'border-[#28563e] bg-[linear-gradient(135deg,#173e2c,#2a6747)] text-white' : nextAction.tone === 'red' ? 'border-[#e4aaa0] bg-[linear-gradient(135deg,#fff3f0,#ffe8e3)] text-[#7d372d]' : 'border-[#e1c68e] bg-[linear-gradient(135deg,#fffaf0,#fff1cf)] text-[#73521c]'}`}><div className="flex items-center gap-3 p-4"><span className={`grid size-9 place-items-center rounded-lg ${nextAction.tone === 'green' ? 'bg-[#d7ff66] text-[#173e2c]' : 'bg-white/70'}`}>{progress === 100 ? <CheckCircle2 className="size-4" /> : bugCount > 0 ? <Bug className="size-4" /> : <PlayCircle className="size-4" />}</span><span><span className={`block text-xs font-bold uppercase tracking-[.08em] ${nextAction.tone === 'green' ? 'text-white/55' : 'opacity-65'}`}>Próxima ação</span><span className="mt-0.5 block text-sm font-semibold">{nextAction.title}</span></span></div></section>
            <section className="overflow-hidden rounded-xl border border-[#cfdcd4] bg-white shadow-[0_12px_28px_-24px_#173e2c]">
              <div className="flex items-center justify-between border-b border-[#dce6df] bg-[linear-gradient(135deg,#f9fcfa,#eef5f0)] px-4 py-3"><div><p className="text-sm font-semibold text-[#2d4236]">Equipe</p><p className="mt-0.5 text-xs text-[#74837b]">{completedParticipants.length} de {participants.length} concluíram</p></div><span className="grid size-8 place-items-center rounded-lg bg-white text-[#397657] shadow-sm"><Users className="size-4" /></span></div>
              <div className="divide-y divide-[#e8eeea]">{participants.map((participant) => <div key={participant.user_id} className={`p-3.5 ${participant.is_current ? 'bg-[linear-gradient(90deg,#eef8f1,#f8fbf9)]' : 'bg-white'}`}>
                <div className="flex items-center gap-2.5"><button type="button" disabled={!canManageParticipantDeadlines || participant.progress === 100} onClick={() => openDeadlineManager(participant)} title={canManageParticipantDeadlines && participant.progress < 100 ? 'Gerenciar prazo individual' : undefined} className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left outline-none transition ${canManageParticipantDeadlines && participant.progress < 100 ? '-m-1 p-1 hover:bg-[#edf6f0] focus-visible:ring-2 focus-visible:ring-[#83a891]' : 'cursor-default'}`}><span className={`grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold shadow-sm ${participant.progress === 100 ? 'bg-[#d7ff66] text-[#244c35]' : 'bg-[#e9eeeb] text-[#53665b]'}`}>{participant.progress === 100 ? <Check className="size-4" /> : initials(participant.user_name)}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5"><span className="truncate text-sm font-semibold text-[#31473b]">{participant.user_name}</span>{canManageParticipantDeadlines && participant.progress < 100 && <CalendarDays className="size-3.5 shrink-0 text-[#4b8261]" />}</span><span className="block text-xs text-[#829087]">{participant.done_items}/{participant.total_items}{participant.is_current ? ' · você' : ''}{participant.deadline_override ? ` · até ${formatRoundDate(participant.deadline_override)}` : ''}</span></span></button>{canRemindParticipants && participant.progress < 100 && !participant.is_current && <a href={reminderEmailHref(participant)} target="_blank" rel="noreferrer" aria-label={`Abrir lembrete para ${participant.user_name} no Gmail`} title="Abrir lembrete no Gmail" className="grid size-8 shrink-0 place-items-center rounded-lg border border-[#d1ded6] bg-white text-[#397657] shadow-sm transition hover:-translate-y-0.5 hover:border-[#83a891] hover:bg-[#edf7f0] hover:text-[#225d3c]"><Mail className="size-3.5" /></a>}<strong className="w-9 text-right text-xs text-[#476455]">{participant.progress}%</strong></div>
                <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[#e8eeea]"><span style={{ width: `${participant.progress}%` }} className={`block h-full rounded-full ${Number(participant.bug_items) > 0 ? 'bg-[linear-gradient(90deg,#4b8a62_0%,#4b8a62_66%,#c85b4b_66%)]' : 'bg-[#4b8a62]'}`} /></div>
              </div>)}{participants.length === 0 && <p className="p-4 text-xs leading-5 text-[#74837b]">Os participantes aparecerão quando abrirem a rodada.</p>}</div>
            </section>
          </aside>
        </div>
      </main>
    </div>}

    <Dialog open={Boolean(selectedParticipant)} onOpenChange={(open) => !open && !savingDeadline && setSelectedParticipant(null)}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        {selectedParticipant && selectedRound && <form onSubmit={extendParticipantDeadline}>
          <DialogHeader className="bg-[#173e2c] px-6 py-5">
            <DialogTitle className="text-xl text-white">Estender prazo individual</DialogTitle>
            <DialogDescription className="mt-2 text-white/75">{selectedParticipant.user_name} · {selectedRound.title}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 p-6">
            <p className="text-sm text-[#52695b]">Prazo atual: <strong>{formatRoundDate(selectedParticipant.deadline_override || selectedRound.deadline)}</strong></p>
            <label className="block text-sm font-semibold">Novo prazo<Input type="date" required value={extendedDeadline} onChange={(event) => setExtendedDeadline(event.target.value)} className="mt-2 h-11" /></label>
            <p className="rounded-xl bg-[#edf6f0] p-3 text-sm text-[#436550]">A mudança vale somente para esta pessoa. Os demais participantes mantêm seus prazos.</p>
            {notice?.tone === 'error' && <p role="alert" className="text-sm text-red-700">{notice.message}</p>}
          </div>
          <DialogFooter className="px-6"><Button type="button" variant="outline" disabled={savingDeadline} onClick={() => setSelectedParticipant(null)}>Cancelar</Button><Button type="submit" disabled={savingDeadline || extendedDeadline <= (selectedParticipant.deadline_override || selectedRound.deadline)} className="bg-[#173e2c] text-white">{savingDeadline ? 'Salvando…' : 'Salvar novo prazo'}</Button></DialogFooter>
        </form>}
      </DialogContent>
    </Dialog>

    <Dialog open={newRoundOpen} onOpenChange={setNewRoundOpen}>
      <DialogContent className="overflow-visible bg-transparent p-0 shadow-none ring-0 sm:max-w-5xl">
        <button type="button" aria-label="Fechar criação de rodada" onClick={() => setNewRoundOpen(false)} className="absolute -right-3 -top-3 z-30 grid size-10 place-items-center rounded-full border border-[#d6e2da] bg-white text-[#496055] shadow-[0_12px_30px_-12px_#0d1f17] transition hover:-translate-y-0.5 hover:border-[#9cb8a7] hover:bg-[#f5faf7] hover:text-[#173e2c] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#d7ff66]/50"><X className="size-4" /></button>
        <form onSubmit={openParticipantPicker} className="round-builder max-h-[94vh] overflow-y-auto rounded-[22px] bg-white shadow-[0_25px_80px_rgb(5_20_12/28%)] ring-1 ring-black/5">
          <DialogHeader className="round-builder-hero relative overflow-hidden px-5 py-5 pr-16 text-white sm:px-7">
            <div className="relative z-10 flex items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-white/15 bg-white/10 text-[#d7ff66] shadow-[0_14px_35px_-20px_#000] backdrop-blur-sm"><ListChecks className="size-5" /></span>
              <div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#d7ff66]">Central de qualidade</span><span className="h-1 w-1 rounded-full bg-white/30" /><span className="text-[11px] font-medium text-white/55">Nova validação</span></div><DialogTitle className="text-xl text-white sm:text-[24px]">Planejar rodada de testes</DialogTitle><DialogDescription className="mt-1 text-xs text-white/60">Defina a entrega e prepare os cenários do URÂNIA.</DialogDescription></div>
              <div className="hidden items-center gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-2.5 sm:flex"><span className="grid size-7 place-items-center rounded-lg bg-[#d7ff66] text-xs font-bold text-[#173e2c]">{draftItems.length}</span><span className="text-left"><span className="block text-[10px] font-bold uppercase tracking-[.1em] text-white/45">Planejados</span><span className="block text-xs font-semibold text-white/85">{draftItems.length === 1 ? '1 cenário' : `${draftItems.length} cenários`}</span></span></div>
            </div>
          </DialogHeader>

          <div className="grid items-start gap-5 bg-[#e9f0ec] p-4 sm:p-5 md:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="overflow-hidden rounded-[20px] border border-[#8daf98] bg-white shadow-[0_18px_46px_-34px_#173e2c] md:sticky md:top-4">
              <div className="border-b border-[#315b43] bg-[linear-gradient(125deg,#123523,#1d5539)] px-4 py-4 text-white"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl shadow-[0_8px_20px_-15px_#000] transition-all duration-300 ${identificationReady ? 'bg-[#d7ff66] text-[#173e2c] ring-4 ring-[#d7ff66]/15' : 'bg-white/10 text-white/70'}`}>{identificationReady ? <Check className="size-4" /> : <PackageCheck className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#d7ff66]">Etapa 01 · Entrega</p><span className={`rounded-full px-2 py-1 text-[9px] font-bold transition ${identificationReady ? 'bg-[#d7ff66] text-[#173e2c]' : 'bg-white/10 text-white/60'}`}>{identificationReady ? 'OK' : `${identificationProgress}/2`}</span></div><h3 className="mt-0.5 text-sm font-semibold text-white">Identificação da rodada</h3></div></div></div>
              <div className="space-y-3 p-4">
                <div className="rounded-xl border border-[#d7e3db] bg-[#f5faf6] px-3 py-2.5"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#5e806c]">Nome da rodada</p><p className="mt-1 text-sm font-semibold text-[#284b37]">Rodada de testes</p><p className="mt-0.5 text-[10px] text-[#7a8b81]">Nome padrão do fluxo de validação</p></div>
                <Field label="Versão *"><Input name="version" required value={roundDraft.version} onChange={(event) => setRoundDraft((current) => ({ ...current, version: event.target.value }))} placeholder="Ex.: U+ 010/26" className="h-10 rounded-xl bg-[#fbfcfb] text-sm" /></Field>
                <Field label="Prazo de conclusão *"><Input name="deadline" type="date" required value={roundDraft.deadline} onChange={(event) => setRoundDraft((current) => ({ ...current, deadline: event.target.value }))} className="h-10 rounded-xl bg-[#fbfcfb] text-sm" /></Field>
                <Field label="Orientações gerais"><Textarea name="description" value={roundDraft.description} onChange={(event) => setRoundDraft((current) => ({ ...current, description: event.target.value }))} className="min-h-24 rounded-xl bg-[#fbfcfb] text-sm leading-5" placeholder="Objetivo, escopo e cuidados desta validação." /></Field>
                <div className="overflow-hidden rounded-xl border border-[#d7e3db] bg-[#f8fbf9]">
                  <button type="button" aria-expanded={tagsOpen} onClick={() => setTagsOpen((open) => !open)} className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[#f0f6f2]">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#e5f1e9] text-[#397657]"><Tags className="size-4" /></span>
                    <span className="min-w-0 flex-1"><span className="block text-[11px] font-semibold text-[#30483a]">Tags <span className="font-normal text-[#839088]">(opcional)</span></span><span className="mt-0.5 block truncate text-[9px] text-[#7b8981]">{roundTags.length ? `${roundTags.length} ${roundTags.length === 1 ? 'tag adicionada' : 'tags adicionadas'}` : 'Facilite buscas futuras'}</span></span>
                    <span className="grid size-7 place-items-center rounded-lg border border-[#cbdcd1] bg-white text-[#397657]"><Plus className={`size-3.5 transition-transform ${tagsOpen ? 'rotate-45' : ''}`} /></span>
                  </button>
                  {tagsOpen && <div className="border-t border-[#dce7e0] bg-white p-3">
                    <p className="text-[10px] leading-4 text-[#74837b]">Use palavras que identifiquem módulo, tela ou tipo de problema.</p>
                    <div className="mt-2 flex gap-2"><Input aria-label="Nova tag" value={tagDraft} maxLength={30} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addRoundTag(); } }} placeholder="Ex.: horário" className="h-9 min-w-0 rounded-lg bg-[#fbfcfb] text-xs" /><Button type="button" aria-label="Adicionar tag" onClick={() => addRoundTag()} disabled={!tagDraft.trim() || roundTags.length >= 12} className="size-9 shrink-0 rounded-lg bg-[#173e2c] p-0 text-white"><Plus className="size-4" /></Button></div>
                    {roundTags.length > 0 && <div className="mt-2.5 flex flex-wrap gap-1.5">{roundTags.map((tag) => <button type="button" key={tag} onClick={() => setRoundTags((current) => current.filter((entry) => entry !== tag))} title="Remover tag" className="inline-flex items-center gap-1 rounded-full bg-[#e9f4ed] px-2.5 py-1 text-[10px] font-semibold text-[#346c4d] transition hover:bg-[#dcece2]">{tag}<X className="size-3" /></button>)}</div>}
                    {roundTags.length === 0 && <div className="mt-2.5 flex flex-wrap gap-1.5"><span className="mr-0.5 self-center text-[9px] font-semibold uppercase tracking-[.08em] text-[#89958e]">Sugestões</span>{['horário', 'professor', 'cadastro', 'básico', 'tela preta'].map((tag) => <button type="button" key={tag} onClick={() => addRoundTag(tag)} className="rounded-full border border-[#dbe5df] bg-[#f8faf9] px-2 py-1 text-[9px] text-[#607067] transition hover:border-[#a9c4b3] hover:bg-[#edf5f0]">+ {tag}</button>)}</div>}
                    <p className="mt-2 text-right text-[9px] text-[#98a39d]">{roundTags.length}/12 tags</p>
                  </div>}
                </div>
              </div>
              <div className={`border-t px-4 py-3 transition-colors duration-300 ${identificationReady ? 'border-[#b9d7c4] bg-[#e5f5ea]' : 'border-[#d9e5dd] bg-[#edf5f0]'}`}><p className={`flex items-center gap-2 text-[11px] font-semibold ${identificationReady ? 'text-[#2f7048]' : 'text-[#61776a]'}`}>{identificationReady ? <CheckCircle2 className="size-4 text-[#397657]" /> : <ShieldCheck className="size-3.5 text-[#71867a]" />} {identificationReady ? 'Identificação concluída · cenários liberados' : 'Complete os 2 campos obrigatórios'}</p></div>
            </aside>

            {!identificationReady ? <section aria-live="polite" className="min-w-0 overflow-hidden rounded-[22px] border border-[#cbd8d0] bg-[#f4f7f5] shadow-[0_18px_48px_-40px_#173e2c]">
              <div className="flex items-center gap-3 border-b border-[#dce5df] bg-white/70 px-4 py-3.5 opacity-70"><span className="grid size-9 place-items-center rounded-xl bg-[#e9eeeb] text-[#7c8a82]"><ListChecks className="size-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#7e8b84]">Etapa 02 · Execução</p><h3 className="mt-0.5 text-sm font-semibold text-[#526158]">Cenários bloqueados</h3></div></div>
              <div className="grid min-h-[330px] place-items-center p-6 text-center"><div className="max-w-sm"><span className="mx-auto grid size-14 place-items-center rounded-2xl border border-[#d8e2dc] bg-white text-[#789084] shadow-sm"><PackageCheck className="size-5" /></span><p className="mt-4 text-sm font-semibold text-[#35483d]">Primeiro, identifique a rodada</p><p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#74837b]">Preencha versão e prazo. Assim que os dois estiverem prontos, este quadro abrirá automaticamente.</p><div className="mx-auto mt-5 flex max-w-[250px] gap-1.5">{[0, 1].map((step) => <span key={step} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${step < identificationProgress ? 'bg-[#4b8a62]' : 'bg-[#dce4df]'}`} />)}</div><p className="mt-2 text-[10px] font-semibold text-[#718078]">{identificationProgress} de 2 campos preenchidos</p></div></div>
            </section> : <section aria-live="polite" className="min-w-0 space-y-3 rounded-[22px] border border-[#83a98f] bg-[#f7faf8] p-3 shadow-[0_22px_55px_-34px_#173e2c] animate-in fade-in slide-in-from-right-3 duration-500">
              <div className="flex flex-col gap-3 rounded-[16px] border border-[#b8cfc0] bg-white px-4 py-3.5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#173e2c] text-[#d7ff66]"><ListChecks className="size-4" /></span><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#397657]">Etapa 02 · Execução</p><h3 className="mt-0.5 text-sm font-semibold text-[#263a2e]">Cenários que serão validados</h3><p className="mt-0.5 text-[10px] text-[#7b8981]">Defina cada caminho e o resultado esperado.</p></div></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d3e3d9] bg-[#edf5f0] px-3 py-1.5 text-[11px] font-bold text-[#346c4d]"><span className="grid size-5 place-items-center rounded-full bg-[#d7ff66] text-[10px] text-[#173e2c]">{draftItems.length}</span>{draftItems.length === 1 ? 'cenário' : 'cenários'}</span></div>

              <div className="space-y-3">
                {draftItems.map((item, index) => <article key={item.key} className="group overflow-hidden rounded-[18px] border border-[#789d86] bg-white shadow-[0_18px_42px_-34px_#173e2c] transition hover:border-[#4e7e60] hover:shadow-[0_24px_52px_-36px_#173e2c]">
                  <div className="flex items-center justify-between gap-4 border-b border-[#315b43] bg-[linear-gradient(115deg,#173e2c,#245d40)] px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#d7ff66] text-[11px] font-bold text-[#173e2c]">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#d7ff66]/80">Cenário de teste</p><p className="truncate text-sm font-semibold text-white">{item.title.trim() || `Defina o cenário ${index + 1}`}</p></div></div>
                    {draftItems.length > 1 && <Button type="button" variant="ghost" size="sm" onClick={() => setDraftItems((current) => current.filter((entry) => entry.key !== item.key))} className="rounded-xl text-white/70 hover:bg-white/10 hover:text-white">Remover</Button>}
                  </div>
                  <div className="grid gap-3 bg-white p-4 sm:grid-cols-2">
                    <Field label="Nome do teste *"><Input required value={item.title} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, title: event.target.value } : entry))} placeholder="Ex.: Super Revisor — validação geral" className="h-10 rounded-xl bg-[#fbfcfb] text-sm" /></Field>
                    <Field label="Caminho no sistema"><Input value={item.path} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, path: event.target.value } : entry))} placeholder="Ex.: Sua Conta > Configurações" className="h-10 rounded-xl bg-[#fbfcfb] text-sm" /></Field>
                    <div className="sm:col-span-2"><Field label="Procedimento e resultado esperado *"><Textarea required value={item.description} onChange={(event) => setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, description: event.target.value } : entry))} className="min-h-20 rounded-xl bg-[#fbfcfb] text-sm leading-5" placeholder="Descreva os passos, o comportamento esperado e o critério de aprovação." /></Field></div>
                    <div className="sm:col-span-2 rounded-xl border border-dashed border-[#c7d9cd] bg-[#f7fbf8] p-3"><div className="flex flex-wrap items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#e4f1e8] text-[#397657]"><Paperclip className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[#355444]">Imagens de referência <span className="font-normal text-[#819087]">(opcional)</span></p><p className="mt-0.5 text-[10px] text-[#77877d]">Adicione prints ou imagens que ajudem a executar este cenário.</p></div><label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#bdd3c3] bg-white px-3 py-2 text-xs font-semibold text-[#326b4b] transition hover:bg-[#edf6f0]"><UploadCloud className="size-3.5" />Adicionar imagens<input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" onChange={(event) => { const files = Array.from(event.target.files || []).filter((file) => file.size > 0); if (!files.length) return; const previews = files.map((file) => URL.createObjectURL(file)); setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, images: [...entry.images, ...files].slice(0, 6), previews: [...entry.previews, ...previews].slice(0, 6) } : entry)); event.currentTarget.value = ''; }} /></label></div>{item.previews.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">{item.previews.map((preview, imageIndex) => <div key={preview} className="group relative aspect-square overflow-hidden rounded-lg border border-[#d6e4da] bg-white"><img src={preview} alt={`Imagem ${imageIndex + 1} do cenário`} className="size-full object-cover" /><button type="button" aria-label={`Remover imagem ${imageIndex + 1}`} onClick={() => { URL.revokeObjectURL(preview); setDraftItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, images: entry.images.filter((_, index) => index !== imageIndex), previews: entry.previews.filter((_, index) => index !== imageIndex) } : entry)); }} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-[#173e2c]/85 text-white opacity-0 transition group-hover:opacity-100"><X className="size-3" /></button></div>)}</div>}</div>
                  </div>
                </article>)}
              </div>

              <Button type="button" variant="outline" onClick={() => setDraftItems((current) => current.length >= 50 ? current : [...current, { key: Date.now() + current.length, title: '', path: '', description: '', images: [], previews: [] }])} disabled={draftItems.length >= 50} className="h-12 w-full rounded-[16px] border-2 border-dashed border-[#7fa28b] bg-white text-[#285d40] shadow-none transition hover:border-[#397657] hover:bg-[#edf6f0] hover:text-[#173e2c]"><span className="grid size-7 place-items-center rounded-lg bg-[#dff0e4] text-[#397657]"><Plus className="size-4" /></span> Adicionar novo cenário</Button>
            </section>}
          </div>

          <DialogFooter className="sticky bottom-0 z-20 items-center border-t border-[#dce6df] bg-white/95 px-4 py-2 shadow-[0_-14px_35px_-30px_#173e2c] backdrop-blur sm:px-5 sm:justify-between">
            <div className="hidden items-center gap-2.5 text-left sm:flex"><span className={`grid size-8 place-items-center rounded-lg ${roundReady ? 'bg-[#e6f5ea] text-[#347951]' : 'bg-[#fff4df] text-[#a06c18]'}`}>{roundReady ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}</span><div><p className="text-[11px] font-semibold text-[#30483a]">{roundReady ? 'Planejamento concluído' : 'Preenchimento incompleto'}</p><p className="text-[10px] text-[#7b8981]">{completedDraftItems} de {draftItems.length} {draftItems.length === 1 ? 'cenário preenchido' : 'cenários preenchidos'} · próxima etapa: participantes</p></div></div>
            <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setNewRoundOpen(false)} className="h-9 rounded-xl px-5">Cancelar</Button>
              <Button type="submit" disabled={!roundReady} className="h-9 rounded-xl bg-[#173e2c] px-6 text-white shadow-[0_12px_28px_-18px_#173e2c] hover:bg-[#24573f] disabled:bg-[#9caaa2] disabled:shadow-none">{roundReady ? <><ChevronRight /> Concluir e escolher pessoas</> : <><AlertTriangle /> Complete os campos</>}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={participantPickerOpen} onOpenChange={setParticipantPickerOpen}>
      <DialogContent className="overflow-visible bg-transparent p-0 shadow-none ring-0 sm:max-w-3xl">
        <button type="button" aria-label="Fechar seleção de participantes" onClick={() => setParticipantPickerOpen(false)} className="absolute -right-3 -top-3 z-30 grid size-10 place-items-center rounded-full border border-[#d6e2da] bg-white text-[#496055] shadow-[0_12px_30px_-12px_#0d1f17] transition hover:-translate-y-0.5 hover:border-[#9cb8a7] hover:bg-[#f5faf7] hover:text-[#173e2c]"><X className="size-4" /></button>
        <form onSubmit={createRound} className="max-h-[92vh] overflow-y-auto rounded-[22px] bg-white shadow-[0_25px_80px_rgb(5_20_12/28%)] ring-1 ring-black/5">
          <DialogHeader className="relative overflow-hidden bg-[linear-gradient(120deg,#103524,#1e5b3d)] px-5 py-5 text-white sm:px-6"><div className="flex items-center gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-[14px] border border-white/15 bg-white/10 text-[#d7ff66]"><UserPlus className="size-5" /></span><div className="min-w-0 flex-1"><div className="mb-1 flex items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#d7ff66]">Etapa final</span><span className="size-1 rounded-full bg-white/30" /><span className="text-[11px] text-white/55">Distribuição</span></div><DialogTitle className="text-xl text-white">Escolha quem fará os testes</DialogTitle><DialogDescription className="mt-1 text-xs text-white/60">A rodada será acompanhada somente para as pessoas selecionadas.</DialogDescription></div><span className={`hidden rounded-xl border px-3 py-2 text-center sm:block ${participantsReady ? 'border-[#d7ff66]/25 bg-[#d7ff66]/10' : 'border-white/10 bg-black/10'}`}><strong className={`block text-lg ${participantsReady ? 'text-[#d7ff66]' : 'text-white/50'}`}>{selectedTesterEmails.length}</strong><small className="text-[9px] uppercase tracking-[.1em] text-white/55">selecionados</small></span></div></DialogHeader>
          <div className="bg-[#edf3ef] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#d4e0d8] bg-white p-3"><span className="mr-auto min-w-0"><strong className="block truncate text-xs text-[#2d4437]">{roundDraft.title}</strong><span className="mt-0.5 block text-[10px] text-[#7b8981]">{roundDraft.version} · {draftItems.length} {draftItems.length === 1 ? 'cenário' : 'cenários'}</span></span><button type="button" onClick={() => selectTesters('all')} className="rounded-lg bg-[#173e2c] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#24573f]">Todos</button><button type="button" onClick={() => selectTesters('support')} className="rounded-lg border border-[#cdded3] bg-[#edf6f0] px-3 py-2 text-xs font-semibold text-[#326a4b]">Suporte</button><button type="button" onClick={() => selectTesters('developer')} className="rounded-lg border border-[#cad9e8] bg-[#eef5fc] px-3 py-2 text-xs font-semibold text-[#3f668e]">Desenvolvimento</button><button type="button" onClick={() => setSelectedTesterEmails([])} className="rounded-lg px-3 py-2 text-xs font-semibold text-[#7c8982] hover:bg-[#f1f4f2]">Limpar</button></div>
            <div className="grid gap-2 sm:grid-cols-2">{roundTeamMembers.map((member) => { const selected = selectedTesterEmails.includes(member.email.toLowerCase()); return <button type="button" aria-pressed={selected} onClick={() => toggleTester(member.email)} key={member.email} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-[#4f8664] bg-[#edf8f0] shadow-sm ring-1 ring-[#4f8664]/15' : 'border-[#dce5df] bg-white hover:border-[#aac2b2]'}`}><span className={`grid size-10 shrink-0 place-items-center rounded-full text-[11px] font-bold ${selected ? 'bg-[#173e2c] text-[#d7ff66]' : member.role === 'developer' ? 'bg-[#e8f2fc] text-[#4b739e]' : member.role === 'manager' ? 'bg-[#eff8d7] text-[#496b25]' : 'bg-[#e8f3ec] text-[#47715a]'}`}>{selected ? <Check className="size-4" /> : initials(member.name)}</span><span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#30453a]">{member.name}</strong><span className="mt-0.5 block truncate text-xs text-[#7b8981]">{teamRoleName(member.role)} · {member.email}</span></span><span className={`grid size-6 place-items-center rounded-md border ${selected ? 'border-[#4f8664] bg-[#4f8664] text-white' : 'border-[#cbd8d0] bg-white text-transparent'}`}><Check className="size-3.5" /></span></button>; })}</div>
            {roundTeamMembers.length === 0 && <div className="rounded-xl border border-dashed border-[#cbd8d0] bg-white px-4 py-8 text-center text-xs text-[#718078]">Carregando pessoas da equipe...</div>}
          </div>
          <DialogFooter className="items-center border-t border-[#dce6df] bg-white px-4 py-3 sm:px-5 sm:justify-between"><p className={`hidden items-center gap-2 text-xs font-semibold sm:flex ${participantsReady ? 'text-[#347951]' : 'text-[#9a681b]'}`}>{participantsReady ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}{participantsReady ? `${selectedTesterEmails.length} ${selectedTesterEmails.length === 1 ? 'pessoa receberá' : 'pessoas receberão'} a rodada` : 'Selecione ao menos uma pessoa'}</p><div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row"><Button type="button" variant="outline" onClick={() => { setParticipantPickerOpen(false); setNewRoundOpen(true); }} className="h-10 rounded-xl px-5">Voltar</Button><Button type="submit" disabled={savingRound || !participantsReady} className="h-10 rounded-xl bg-[#173e2c] px-6 text-white shadow-[0_12px_28px_-18px_#173e2c] hover:bg-[#24573f] disabled:bg-[#9caaa2]">{savingRound ? <><LoaderCircle className="animate-spin" /> Criando...</> : <><CheckCircle2 /> Criar rodada para {selectedTesterEmails.length}</>}</Button></div></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog open={Boolean(selectedItem)} onOpenChange={(open) => !open && setSelectedItem(null)}>
      <DialogContent className="test-result-dialog max-h-[90vh] overflow-y-auto p-0 sm:max-w-xl">{selectedItem && <form onSubmit={updateItem}>
        <DialogHeader className="relative border-b border-[#37664c] bg-[linear-gradient(120deg,#103527,#256244)] px-6 py-5 pr-16"><p className="mb-2 text-xs font-semibold uppercase tracking-[.12em] text-[#d7ff66]">{itemReadonly ? 'Consulta do cenário' : 'Registrar validação'}</p><DialogTitle className="break-words text-2xl text-white">{selectedItem.title}</DialogTitle><DialogDescription className="mt-2 break-words text-[#c7ddce]">{selectedItem.path || `Item ${selectedItem.position} da rodada`}</DialogDescription><button type="button" aria-label="Fechar resultado" onClick={() => setSelectedItem(null)} className="absolute right-4 top-4 grid size-9 place-items-center rounded-full border border-white/20 text-white hover:bg-white/10"><X className="size-4" /></button></DialogHeader>
        <div className="space-y-4 px-6 py-5">
          {itemReadonly && <div className="flex items-start gap-3 rounded-xl border border-[#bfd3c6] bg-[#edf6f0] p-3.5"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#173e2c] text-[#d7ff66]">{roundReadonly ? <FileArchive className="size-4" /> : <ShieldCheck className="size-4" />}</span><div><p className="text-xs font-semibold text-[#294a38]">{roundReadonly ? 'Rodada encerrada' : 'Acesso de acompanhamento'}</p><p className="mt-1 text-[10px] leading-4 text-[#63766b]">{roundReadonly ? 'Este resultado foi preservado no histórico e está disponível somente para consulta.' : 'Você pode acompanhar esta rodada, mas somente os participantes selecionados podem registrar resultados.'}</p></div></div>}
          {selectedItem.description && <section className="rounded-xl border border-[#d9e6dd] bg-[#f2f7f4] p-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-[.08em] text-[#467058]">O que validar</h3><p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#354d3f]">{selectedItem.description}</p></section>}
          {selectedItem.images?.length ? <section className="rounded-xl border border-[#d9e6dd] bg-white p-4"><div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-[.08em] text-[#467058]">Imagens de referência</h3><span className="text-[10px] text-[#7b8b81]">{selectedItem.images.length} {selectedItem.images.length === 1 ? 'imagem' : 'imagens'}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{selectedItem.images.map((image) => <a key={image.id} href={`/api/test-attachments/${encodeURIComponent(image.id)}`} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-[#dce7df] bg-[#f5f8f6]"><img src={`/api/test-attachments/${encodeURIComponent(image.id)}`} alt={image.file_name} className="max-h-52 w-full object-contain transition group-hover:scale-[1.02]" /><span className="block truncate border-t border-[#dce7df] bg-white px-3 py-2 text-[10px] text-[#63756a]">{image.file_name}</span></a>)}</div></section> : null}
          <fieldset disabled={itemReadonly}><legend className="mb-2 text-sm font-semibold text-[#294a38]">Meu resultado</legend><div className="grid grid-cols-3 gap-2">{['Pendente','Aprovado','Com bug'].map((status) => <label key={status} className="cursor-pointer"><input type="radio" name="status" value={status} checked={(resultStatus === 'Em teste' ? 'Pendente' : resultStatus) === status} onChange={() => setResultStatus(status)} className="peer sr-only" /><span className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl border bg-white px-2 py-3 text-sm font-medium transition peer-focus-visible:ring-2 peer-focus-visible:ring-[#397657] peer-disabled:cursor-default ${status === 'Com bug' ? 'border-[#e7cdc7] text-[#934338] peer-checked:border-[#b65b4b] peer-checked:bg-[#fff0eb]' : status === 'Aprovado' ? 'border-[#c5decd] text-[#286541] peer-checked:border-[#397657] peer-checked:bg-[#e4f4e9]' : 'border-[#d7dfda] text-[#5c6c62] peer-checked:border-[#82968a] peer-checked:bg-[#eef2ef]'}`}>{status === 'Aprovado' ? <CheckCircle2 className="size-4" /> : status === 'Com bug' ? <Bug className="size-4" /> : <Clock3 className="size-4" />}{status}</span></label>)}</div></fieldset>
          <Field label={resultStatus === 'Com bug' ? 'Erro encontrado' : 'Minha observação'}><Textarea name="note" readOnly={itemReadonly} required={!itemReadonly && resultStatus === 'Com bug'} defaultValue={selectedItem.result_note || ''} className="min-h-28 read-only:cursor-default read-only:bg-[#f0f3f1]" placeholder={resultStatus === 'Com bug' ? 'Explique o que aconteceu. Este texto será levado para o report oficial.' : 'Descreva o que você testou e o resultado encontrado.'} /></Field>
          {resultStatus === 'Com bug' && selectedItem.linked_report_id && <div className="flex items-start gap-3 rounded-2xl border border-[#efc9c2] bg-[#fff5f2] p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-[#b04e40] shadow-sm"><Bug className="size-4" /></span><div><p className="text-xs font-semibold text-[#873f34]">Report oficial vinculado</p><p className="mt-1 text-[10px] leading-4 text-[#8a655f]">Este teste está vinculado ao <strong>{selectedItem.linked_report_id}</strong>.</p></div></div>}
          {!itemReadonly && resultStatus === 'Com bug' && !selectedItem.linked_report_id && <fieldset className="overflow-hidden rounded-2xl border border-[#d9e3dd] bg-[#f8faf9]"><legend className="sr-only">Destino do bug encontrado</legend><div className="border-b border-[#e2e9e5] bg-white px-4 py-3"><p className="text-xs font-semibold text-[#34483d]">O que deseja fazer com este bug?</p><p className="mt-1 text-[10px] text-[#78867e]">Escolha apenas um caminho para evitar cadastros duplicados.</p></div><div className="grid gap-2 p-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 transition ${bugReportChoice === 'create' ? 'border-[#df9d91] bg-[#fff1ee] shadow-sm' : 'border-[#dfe7e2] bg-white hover:border-[#c4d3c9]'}`}><input type="radio" name="bugReportChoice" value="create" checked={bugReportChoice === 'create'} onChange={() => { setBugReportChoice('create'); setExistingReportId(''); }} className="sr-only" /><span className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg ${bugReportChoice === 'create' ? 'bg-[#a94a3c] text-white' : 'bg-[#eef2ef] text-[#718078]'}`}><Plus className="size-3.5" /></span><strong className="text-[11px] text-[#493934]">Criar oficial</strong></span><small className="mt-2 block text-[9px] leading-4 text-[#7d6d68]">Abre um report novo já preenchido.</small></label><label className={`cursor-pointer rounded-xl border p-3 transition ${bugReportChoice === 'existing' ? 'border-[#79a187] bg-[#edf7f0] shadow-sm' : 'border-[#dfe7e2] bg-white hover:border-[#c4d3c9]'}`}><input type="radio" name="bugReportChoice" value="existing" checked={bugReportChoice === 'existing'} onChange={() => setBugReportChoice('existing')} className="sr-only" /><span className="flex items-center gap-2"><span className={`grid size-7 place-items-center rounded-lg ${bugReportChoice === 'existing' ? 'bg-[#397657] text-white' : 'bg-[#eef2ef] text-[#718078]'}`}><Share2 className="size-3.5" /></span><strong className="text-[11px] text-[#33463b]">Vincular existente</strong></span><small className="mt-2 block text-[9px] leading-4 text-[#718078]">Use um report criado pelo outro caminho.</small></label></div>{bugReportChoice === 'existing' && <div className="border-t border-[#e1e9e4] bg-white p-3"><Field label="Escolha um dos seus reports"><select value={existingReportId} onChange={(event) => setExistingReportId(event.target.value)} required className="form-select"><option value="">Selecione o report</option>{reports.map((report) => <option key={report.id} value={report.id}>{report.id} · {report.title} · {report.status}</option>)}</select></Field>{reports.length === 0 && <p className="mt-2 rounded-lg bg-[#fff7e4] px-3 py-2 text-[10px] text-[#8a641b]">Você ainda não possui um report disponível para vincular.</p>}</div>}</fieldset>}
        </div>
        <DialogFooter className="border-t border-[#e4ebe7] bg-[#fafcfb] px-6 py-4">{itemReadonly ? <Button type="button" onClick={() => setSelectedItem(null)} className="bg-[#173e2c] text-white"><Check /> Fechar consulta</Button> : <><Button type="button" variant="outline" onClick={() => setSelectedItem(null)}>Cancelar</Button><Button type="submit" disabled={savingItem || (resultStatus === 'Com bug' && bugReportChoice === 'existing' && !existingReportId)} className={resultStatus === 'Com bug' ? 'bg-[#9f4437] text-white hover:bg-[#87382e]' : 'bg-[#173e2c] text-white'}>{savingItem ? <><LoaderCircle className="animate-spin" /> Salvando...</> : resultStatus === 'Com bug' && bugReportChoice === 'create' && !selectedItem.linked_report_id ? <><Bug /> Salvar e preparar report</> : resultStatus === 'Com bug' && bugReportChoice === 'existing' ? <><Share2 /> Salvar e vincular</> : <><Check /> Salvar resultado</>}</Button></>}</DialogFooter>
      </form>}</DialogContent>
    </Dialog>
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

function TeamView({ currentUserName, currentUserEmail, currentUserInitials, currentUserRole }: { currentUserName: string; currentUserEmail: string; currentUserInitials: string; currentUserRole: TeamRole }) {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [teamError, setTeamError] = useState('');
  useEffect(() => { fetch('/api/team').then(async (response) => response.ok ? await response.json() as { members: TeamMember[] } : null).then((payload) => payload && setTeamMembers(payload.members)).catch(() => undefined); }, []);
  async function saveMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSavingMember(true); setTeamError('');
    const form = event.currentTarget; const data = new FormData(form);
    const response = await fetch('/api/team', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: data.get('name'), email: data.get('email'), role: data.get('role') }) });
    const payload = await response.json().catch(() => ({})) as { member?: TeamMember; error?: string };
    setSavingMember(false);
    if (!response.ok || !payload.member) { setTeamError(payload.error || 'Não foi possível salvar esta pessoa.'); return; }
    setTeamMembers((current) => [...current.filter((member) => member.email.toLowerCase() !== payload.member!.email.toLowerCase()), payload.member!]); form.reset(); setEditorOpen(false);
  }
  const members = teamMembers.length ? teamMembers.map((member) => ({ ...member, roleLabel: teamRoleName(member.role), initials: initials(member.name), open: 0, color: member.role === 'manager' ? '#d7ff66' : member.role === 'developer' ? '#b8d7ff' : '#dceee3', current: member.email.toLowerCase() === currentUserEmail.toLowerCase() })) : [{ name: currentUserName, email: currentUserEmail, role: currentUserRole, roleLabel: teamRoleName(currentUserRole), initials: currentUserInitials, open: 0, color: '#d7ff66', current: true, updated_at: Date.now() }];
  return <div>
    <div className="flex flex-col gap-3 rounded-2xl border border-[#d6e2da] bg-[linear-gradient(110deg,#ffffff_0%,#f4f8f5_100%)] px-4 py-3.5 shadow-[0_8px_24px_-25px_#173e2c] sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e9f3ec] text-[#397657] ring-1 ring-[#d6e4da]"><Users className="size-4" /></span><p className="text-xs leading-5 text-[#68786f] sm:text-[13px]"><strong className="font-semibold text-[#30483a]">Organize as responsabilidades</strong> e acompanhe quem participa de cada etapa das rodadas e dos reports.</p></div>
      <Button onClick={() => setEditorOpen((open) => !open)} variant="outline" className="shrink-0 border-[#cbdad1] bg-white text-[#294c39] hover:bg-[#f3f8f5]"><UserPlus /> {editorOpen ? 'Cancelar' : 'Adicionar pessoa'}</Button>
    </div>

    {editorOpen && <form onSubmit={saveMember} className="mt-4 rounded-2xl border border-[#d6e2da] bg-white p-4 shadow-[0_10px_30px_-26px_#173e2c]"><div className="grid gap-3 md:grid-cols-[1fr_1.2fr_.8fr_auto]"><Field label="Nome"><Input name="name" required placeholder="Ex.: Bruno Milfont" /></Field><Field label="E-mail corporativo"><Input name="email" type="email" required placeholder="nome@geha.com.br" /></Field><Field label="Função"><select name="role" defaultValue="support" className="form-select h-9"><option value="support">Suporte</option><option value="manager">Gerência</option><option value="developer">Desenvolvimento</option></select></Field><Button type="submit" disabled={savingMember} className="self-end bg-[#173e2c] text-white hover:bg-[#24573f]">{savingMember ? <LoaderCircle className="animate-spin" /> : <Plus />} Salvar</Button></div>{teamError && <p role="alert" className="mt-3 text-xs text-[#a1483b]">{teamError}</p>}</form>}

    <section className="mt-4 rounded-2xl border border-[#dce5df] bg-white p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.12em] text-[#4d7c61]">Equipe cadastrada</p><p className="mt-1 text-xs text-[#78867e]">Pessoas com acesso ao ambiente de qualidade.</p></div><Badge className="bg-[#edf5f0] text-[#397657]">{members.length} {members.length === 1 ? 'PESSOA' : 'PESSOAS'}</Badge></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{members.map((member) => <article key={member.email} className="rounded-2xl border border-[#dce5df] bg-[linear-gradient(145deg,#ffffff,#f7faf8)] p-4 shadow-[0_12px_30px_-28px_#173e2c]"><div className="flex items-start justify-between"><span style={{ background: member.color }} className="grid size-11 place-items-center rounded-xl text-xs font-bold text-[#294033] shadow-sm">{member.initials}</span>{member.current && <Badge className="bg-[#edf7f0] text-[#377853]">VOCÊ</Badge>}</div><h2 className="mt-4 text-sm font-semibold">{member.name}</h2><p className="mt-1 text-xs font-medium text-[#52705f]">{member.roleLabel}</p><p className="mt-1 truncate text-[10px] text-[#8a968f]">{member.email}</p><div className="mt-4 flex items-center justify-between border-t border-[#e7ede9] pt-3"><span className="text-[10px] text-[#849088]">Chamados ativos</span><span className="text-sm font-semibold">{member.open}</span></div></article>)}</div>
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
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#edf6f0_0%,#f7f9f7_45%,#eef2ef_100%)] p-5"><section className="w-full max-w-md overflow-hidden rounded-[28px] border border-white bg-white shadow-[0_30px_90px_-48px_#173e2c]"><div className="h-1.5 bg-[linear-gradient(90deg,#173e2c,#5a916b,#d7ff66)]" /><div className="p-7 sm:p-9"><div className="flex items-center gap-3"><span className="grid size-14 place-items-center rounded-2xl bg-[#173e2c] p-1.5 shadow-[0_12px_30px_-18px_#173e2c]"><img src="/brand/bugs-on-the-table-logo.png" alt="Logo The Bugs on the Table" className="size-full object-contain" /></span><div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#5b8069]">The Bugs on the Table</p><h1 className="mt-1 text-xl font-semibold tracking-[-.03em] text-[#1f3328]">Acesso corporativo</h1></div></div>{loading ? <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[#f4f7f5] p-4 text-xs text-[#65756c]"><LoaderCircle className="size-4 animate-spin text-[#397657]" /> Verificando sua sessão segura...</div> : <><p className="mt-7 text-sm leading-6 text-[#5e6e65]">Ambiente privado de demonstração. Use um e-mail corporativo autorizado para acessar.</p><form onSubmit={signIn} className="mt-5"><label className="mb-2 block text-[10px] font-bold uppercase tracking-[.12em] text-[#617469]">E-mail corporativo</label><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu.nome@geha.com.br" required className="h-12 rounded-xl border-[#dbe6df] bg-[#f7faf8]" />{error ? <p className="mt-2 text-xs font-medium text-red-600">{error}</p> : null}<button type="submit" disabled={submitting} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#173e2c] text-xs font-semibold text-white shadow-sm transition hover:bg-[#24573f] disabled:opacity-60">{submitting ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Entrar na demonstração</button></form><div className="mt-5 flex justify-center gap-2 text-[9px] font-semibold text-[#5b8069]"><span>@geha.com.br</span><span>•</span><span>@horario.com.br</span></div><p className="mt-4 rounded-xl bg-[#f3f7f4] px-3 py-2 text-center text-[9px] leading-4 text-[#7b8981]">Modo demonstração · a confirmação por código será ativada no servidor oficial.</p></>}</div></section></main>;
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

function ReadOnlyBugDescription({ value, images }: { value: string; images: GlobalBugItem['images'] }) {
  let parsed: { blocks?: Array<{ type?: string; value?: string; attachmentId?: string; caption?: string }> } | null = null;
  try { parsed = JSON.parse(value); } catch { parsed = null; }
  if (!parsed?.blocks || !Array.isArray(parsed.blocks)) return <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#344b3f]">{value || 'Descrição não informada.'}</p>;
  const imageById = new Map(images.map((image) => [image.id, image]));
  return <div className="mt-4 space-y-4">{parsed.blocks.map((block, index) => {
    if (block.type === 'text' && block.value) return <p key={index} className="whitespace-pre-wrap text-sm leading-6 text-[#344b3f]">{block.value}</p>;
    if (block.type === 'image' && block.attachmentId) { const image = imageById.get(block.attachmentId); return image ? <figure key={`${block.attachmentId}-${index}`} className="overflow-hidden rounded-xl border border-[#dce5df] bg-[#eef3f0]"><a href={`/api/attachments/${encodeURIComponent(image.id)}`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${encodeURIComponent(image.id)}`} alt={block.caption || image.file_name || 'Print do erro'} className="max-h-[420px] w-full object-contain" /></a>{(block.caption || image.file_name) && <figcaption className="border-t border-[#dce5df] bg-white px-3 py-2 text-[10px] text-[#68776f]">{block.caption || image.file_name}</figcaption>}</figure> : null; }
    return null;
  })}{images.filter((image) => image.kind === 'screenshot').map((image) => <figure key={image.id} className="overflow-hidden rounded-xl border border-[#dce5df] bg-[#eef3f0]"><a href={`/api/attachments/${encodeURIComponent(image.id)}`} target="_blank" rel="noreferrer"><img src={`/api/attachments/${encodeURIComponent(image.id)}`} alt={image.file_name || 'Print do erro'} className="max-h-[420px] w-full object-contain" /></a><figcaption className="border-t border-[#dce5df] bg-white px-3 py-2 text-[10px] text-[#68776f]">{image.file_name}</figcaption></figure>)}</div>;
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
function normalizeReportStatus(status: string) { if (['Corrigido', 'Finalizado'].includes(status)) return 'Finalizado'; if (status === 'Aguardando reteste') return status; if (['Em análise', 'Em correção', 'Em teste', 'Ainda ocorre', 'Com Desenvolvimento'].includes(status)) return 'Com Desenvolvimento'; return 'Novo report'; }
function statusTone(status: string) { const normalized = normalizeReportStatus(status); if (normalized === 'Finalizado') return 'green'; if (normalized === 'Aguardando reteste') return 'amber'; if (normalized === 'Com Desenvolvimento') return 'blue'; return 'red'; }
function reportResponsible(status: string) { const normalized = normalizeReportStatus(status); if (normalized === 'Com Desenvolvimento') return 'Desenvolvimento'; if (normalized === 'Aguardando reteste') return 'Suporte · Reteste'; if (normalized === 'Finalizado') return 'Concluído'; return 'Aguardando DEV'; }
function reportWorkflowOptions(status: string, role: TeamRole = 'support', isOwner = false) { const normalized = normalizeReportStatus(status); const current = [{ value: normalized, label: normalized }]; if (role === 'manager') { if (normalized === 'Novo report') return [...current, { value: 'Com Desenvolvimento', label: 'Enviar ao Desenvolvimento' }]; if (normalized === 'Com Desenvolvimento') return [...current, { value: 'Aguardando reteste', label: 'Liberar para reteste' }]; if (normalized === 'Aguardando reteste') return [...current, { value: 'Finalizado', label: 'Funcionou — OK, finalizar' }, { value: 'Com Desenvolvimento', label: 'Problema continua — voltar ao DEV' }]; return [...current, { value: 'Com Desenvolvimento', label: 'Reabrir e enviar ao DEV' }]; } if (role === 'developer') return normalized === 'Com Desenvolvimento' ? [...current, { value: 'Aguardando reteste', label: 'Correção pronta — liberar reteste' }] : current; if (!isOwner) return current; if (normalized === 'Novo report') return [...current, { value: 'Com Desenvolvimento', label: 'Enviar ao Desenvolvimento' }]; if (normalized === 'Aguardando reteste') return [...current, { value: 'Finalizado', label: 'Funcionou — OK, finalizar' }, { value: 'Com Desenvolvimento', label: 'Problema continua — voltar ao DEV' }]; if (normalized === 'Finalizado') return [...current, { value: 'Com Desenvolvimento', label: 'Reabrir e enviar ao DEV' }]; return current; }
function formatRoundDate(value: string) { const date = new Date(`${value}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pt-BR'); }
function apiReportToItem(row: Record<string, unknown>): ReportItem { const email = String(row.author_email || 'EQ'); const reporterName = actorName(email); const status = normalizeReportStatus(String(row.status || 'Novo report')); return { responsibleName: responsibleLabel(row, status), id: String(row.id), title: String(row.function_name || 'Report'), client: String(row.institution || 'Cliente não informado'), copy: String(row.copy_number || 'Sem cópia'), version: String(row.version || 'Sem versão'), status, tone: statusTone(status), owner: initials(reporterName).slice(0, 2), reporterName, updated: formatDateTime(Number(row.updated_at || Date.now())), attachments: Number(row.attachment_count || 0), urgent: Number(row.urgent) === 1, canEdit: Number(row.can_edit) === 1, isOwner: Number(row.is_owner) === 1 }; }
function formatDateTime(value: number) { return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function responsibleLabel(row: Record<string, unknown> | null | undefined, status: string) {
  if (!row) return 'Carregando responsável…';
  const name = String(row.responsible_name || row.responsible_email || '');
  if (name) return name.includes('@') ? actorName(name) : name;
  return normalizeReportStatus(status) === 'Finalizado' ? 'Validação não registrada' : 'Aguardando responsável';
}
function actorName(email: string) { const local = email.split('@')[0].replace(/[._-]+/g, ' '); return local.replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function teamRoleName(role: TeamRole) { return role === 'manager' ? 'Gerência' : role === 'developer' ? 'Desenvolvimento' : 'Suporte'; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
async function copyText(value: string) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const field = document.createElement('textarea');
  field.value = value; field.setAttribute('readonly', ''); field.style.position = 'fixed'; field.style.opacity = '0';
  document.body.appendChild(field); field.select();
  const copied = document.execCommand('copy'); document.body.removeChild(field);
  if (!copied) throw new Error('O navegador não permitiu copiar. Tente novamente.');
}
