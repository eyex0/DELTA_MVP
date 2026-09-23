import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import {
  Activity, Archive, ArrowRight, BarChart3, Bell, Bot, CalendarDays, Check, ChevronDown, ChevronRight,
  CircleHelp, ClipboardList, FileText, FolderKanban, Gauge, GitBranch, Grid2X2, Inbox, Layers3, Link2, LockKeyhole,
  Menu, MessageCircle, MoreHorizontal, Paperclip, PanelLeft, Plus, Search, Send, Settings, ShieldCheck,
  Radar, Sparkles, Target, Users, X, Zap, Database, MessageSquare, Play, CheckCircle2, Workflow, ListTodo,
} from 'lucide-react';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { MarketingHome, MarketingPage } from '@/pages/marketing';
import './marketing.css';
import './marketing-responsive-fixes.css';
import './sidebar.css';
import './sidebar-overrides.css';
import './sidebar-mark.css';
import './analysis.css';
import './marketing-home-final.css';
import './marketing-depth.css';
import './marketing-final-fix.css';
import './fresh-hero.css';
import './marketing-page-hero.css';
import './dashboard-responsive.css';
import './enterprise.css';
import deltaLogo from '@assets/delta-brand-logo-cropped.png';
import deltaMark from '@assets/delta-mark.png';

const queryClient = new QueryClient();
const cx = (...items: Array<string | false | undefined>) => items.filter(Boolean).join(' ');
type AuthPayload = { token?: string; error?: { message?: string } };

async function readAuthPayload(response: Response): Promise<AuthPayload> {
  const body = await response.text();
  if (!body.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === 'object') return parsed as AuthPayload;
  } catch {
    // The API may return a proxy/server error page instead of JSON.
  }
  return {};
}

type Section = 'home' | 'projects' | 'cycles' | 'analytics' | 'inbox' | 'calendar' | 'customers' | 'members' | 'agents' | 'knowledge' | 'conversations' | 'runs' | 'approvals' | 'workflows' | 'tasks' | 'vault' | 'security' | 'settings' | 'integrations';

const nav: Array<{ id: Section; label: string; icon: any; group?: string }> = [
  { id: 'home', label: 'Home', icon: Gauge }, { id: 'projects', label: 'Projects', icon: FolderKanban }, { id: 'agents', label: 'Agents', icon: Bot },
  { id: 'knowledge', label: 'Knowledge', icon: Database }, { id: 'conversations', label: 'Conversations', icon: MessageSquare },
  { id: 'runs', label: 'Runs', icon: Play }, { id: 'approvals', label: 'Approvals', icon: CheckCircle2, group: 'Operations' },
  { id: 'workflows', label: 'Workflows', icon: Workflow }, { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, group: 'Workspace' }, { id: 'integrations', label: 'Integrations', icon: Link2 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

function RefreshIcon({ className }: { className?: string }) { return <Activity className={className} />; }
function BriefcaseIcon({ className }: { className?: string }) { return <Archive className={className} />; }
function Logo() { return <Link href="/app/dashboard" className="brand-logo"><img src={deltaLogo} alt="DELTA" /></Link>; }
function LoginBrand() { return <Link href="/app/dashboard" className="login-brand" aria-label="DELTA"><img src={deltaMark} alt="" /></Link>; }
function Pill({ children, tone = 'blue' }: { children: ReactNode; tone?: 'blue' | 'green' | 'amber' | 'purple' | 'slate' }) { return <span className={cx('status-pill', `status-${tone}`)}>{children}</span>; }
function Avatar({ initials, tone = 'blue' }: { initials: string; tone?: string }) { return <span className={cx('avatar', `avatar-${tone}`)}>{initials}</span>; }

function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(true);
  const [location] = useLocation();
  return <div className="min-h-screen bg-[#f7f9fc] text-[#17212f]">
    <aside className={cx('sidebar', collapsed && 'sidebar-collapsed')}>
      <div className="sidebar-brand"><Logo /><button onClick={() => setCollapsed(!collapsed)} className="icon-button" aria-label="Collapse sidebar"><PanelLeft size={15} /></button></div>
      <div className="sidebar-nav">
        {nav.map((item) => <div key={item.id} className="nav-block">{item.group && <div className="nav-section-label">{item.group}</div>}<Link href={`/app/${item.id === 'home' ? 'dashboard' : item.id}`} title={item.label} aria-label={item.label} className={cx('nav-item', (location.includes(item.id) || (item.id === 'home' && location === '/app/dashboard')) && 'nav-active')}><item.icon size={15} /><span>{item.label}</span>{item.id === 'inbox' && <span className="nav-count">4</span>}</Link></div>)}
      </div>
      <div className="sidebar-bottom"><div className="vault-mini"><LockKeyhole size={14} /><span>Private vault</span><span className="toggle-dot" /></div><div className="user-chip"><Avatar initials="MA" tone="dark" /><div className="min-w-0"><div className="truncate text-xs font-semibold">MONTASER ABDALLA</div><div className="text-[10px] text-slate-400">Platform owner</div></div><MoreHorizontal size={15} className="ml-auto text-slate-400" /></div></div>
    </aside>
    <main className={cx('main-shell', collapsed && 'main-shell-wide')}>
      <header className="topbar"><div className="mobile-brand"><Logo /></div><div className="breadcrumb"><span>Home</span><ChevronRight size={13} /><span className="font-semibold">{location.includes('projects') ? 'Projects' : location.includes('cycles') ? 'Work cycles' : location.includes('analytics') ? 'Analytics' : 'Dashboard'}</span></div><div className="top-actions"><label className="global-search"><Search size={15} /><input placeholder="Search projects, work cycles, artifacts..." /><kbd>⌘ K</kbd></label><span className="top-date">Wednesday, March 4, 2026</span><button className="icon-button" aria-label="Notifications"><Bell size={16} /></button><button className="top-profile" onClick={() => { window.localStorage.removeItem('delta_token'); window.location.href = '/login'; }} title="Sign out"><Avatar initials="MA" tone="purple" /><span className="hidden sm:inline">MONTASER ABDALLA</span><ChevronDown size={13} /></button></div></header>
      <div className="page-wrap">{children}</div>
    </main>
  </div>;
}

function PageTitle({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail: string; action?: ReactNode }) { return <div className="page-title"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{detail}</p></div>{action}</div>; }
function MetricCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: string; detail: string; tone: string }) { return <div className="metric-card"><div className="metric-head"><span>{label}</span><span className={cx('metric-icon', `metric-${tone}`)}><Icon size={16} /></span></div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></div>; }

const regionData = [{ label: 'North', value: 111 }, { label: 'South', value: 96 }, { label: 'East', value: 105 }, { label: 'West', value: 104 }, { label: 'Central', value: 89 }];
function AnalyticsVisual() { return <div className="analytics-card"><div className="card-heading"><div><h3>Order count by region</h3><p>Distribution of imported orders across the rollout dataset</p></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><div className="bar-chart">{regionData.map((item) => <div className="bar-column" key={item.label}><div className="bar-value">{item.value}</div><div className="bar" style={{ height: `${item.value * .7}px` }} /><span>{item.label}</span></div>)}</div><div className="data-table"><div className="table-row table-head"><span>Region</span><span>Order count</span><span>Share of 500 orders</span></div>{regionData.map((item) => <div className="table-row" key={item.label}><span>{item.label}</span><span>{item.value}</span><span>{((item.value / 500) * 100).toFixed(1)}%</span></div>)}</div><div className="product-grid">{[['CRM License', '120', 'cyan'], ['Integration Bundle', '96', 'blue'], ['Training Pkg', '92', 'purple'], ['Analytics Pack', '80', 'green']].map(([name, value, tone]) => <div className="product-card" key={name}><div><span className={cx('tiny-dot', `dot-${tone}`)} />{name}</div><strong>{value}</strong></div>)}</div></div>; }

function PromptBar({ onSubmit, disabled = false }: { onSubmit?: (value: string) => void; disabled?: boolean }) {
  const [value, setValue] = useState('');
  const send = (request = value) => { if (!request.trim() || disabled) return; onSubmit?.(request); setValue(''); };
  const prompts = [['Analytics', 'Show delivery analytics and the key trends'], ['Projects', 'Summarize the active projects and risks'], ['Due soon', 'What is due soon and needs attention?'], ['Work cycle', 'Summarize the current work cycle'], ['BRD', 'Draft a BRD from the available project evidence']];
  return <div className="prompt-zone"><div className="prompt-pills"><button className="context-pill active" onClick={() => send('Give me a visual summary of the implementation workspace')} disabled={disabled}><Sparkles size={12} /> Rich Visual</button>{prompts.map(([label, request]) => <button className="context-pill" key={label} onClick={() => send(request)} disabled={disabled}>{label}</button>)}</div><div className="prompt-bar"><button className="prompt-spark" onClick={() => send('Give me a visual summary of the implementation workspace')} disabled={disabled}><Sparkles size={16} /></button><input value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={disabled ? 'DELTA is working…' : 'Ask anything...'} disabled={disabled} /><button className="prompt-attach" disabled={disabled}><Paperclip size={16} /></button><button onClick={() => send()} className="prompt-send" disabled={disabled}><Send size={15} /></button></div><div className="prompt-help">Type @ to mention a project, work cycle, or artifact for targeted answers</div></div>;
}

type DashboardData = {
  activeProjects: number;
  agentsWorking: number;
  pendingApprovals: number;
  requirements: number;
  risks: number;
  decisions: number;
  completionRate: number;
  recentActivity: Array<{ id: string; actor: string; title: string; detail: string; timestamp: string; type: string }>;
  projects: Array<{ id: string; name: string; status: string; progress: number; requirementsCount: number; openDecisions: number; risks: number; pendingApprovals: number }>;
};

function Dashboard() {
  const [conversation, setConversation] = useState(false);
  const [running, setRunning] = useState(false);
  const [response, setResponse] = useState('');
  const [error, setError] = useState('');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [showAnalytics, setShowAnalytics] = useState(false);
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const token = window.localStorage.getItem('delta_token');
        const result = await fetch('/api/dashboard', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!result.ok) throw new Error('Dashboard data could not be loaded.');
        setDashboard(await result.json() as DashboardData);
      } catch (dashboardError) {
        setError(dashboardError instanceof Error ? dashboardError.message : 'Dashboard data could not be loaded.');
      } finally {
        setLoadingDashboard(false);
      }
    };
    void loadDashboard();
  }, []);
  const runAgent = async (request: string) => {
    setConversation(true); setRunning(true); setResponse(''); setError('');
    try {
      const token = window.localStorage.getItem('delta_token');
      const result = await fetch('/api/agents/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ request }),
      });

      const rawText = await result.text();
      let payload: { response?: string; reason?: string; status?: string; error?: { message?: string } } | null = null;

      if (rawText.trim()) {
        try {
          payload = JSON.parse(rawText) as { response?: string; reason?: string; status?: string; error?: { message?: string } };
        } catch {
          throw new Error('DELTA returned an invalid response. Check the backend service and try again.');
        }
      }

      if (!result.ok) {
        const message = payload?.error?.message ?? 'DELTA agent request failed.';
        throw new Error(message);
      }

      if (!payload) {
        throw new Error('DELTA returned an empty response.');
      }

      if (payload.status !== 'completed') {
        throw new Error(payload.reason ?? `Agent stopped with status ${payload.status ?? 'unknown'}.`);
      }
      setResponse(payload.response ?? 'The agent completed without a response.');
    } catch (agentError) { setError(agentError instanceof Error ? agentError.message : 'DELTA agent request failed.'); }
    finally { setRunning(false); }
  };
  const data = dashboard;
  return <div className="dashboard-page"><PageTitle eyebrow="Workspace / Home" title="Good afternoon, MONTASER ABDALLAH" detail="Your implementation workspace is ready. Ask Delta to surface the next useful move." action={<Link href="/app/cycles" className="primary-button"><Plus size={15} />New work cycle</Link>} />{conversation ? <div className="conversation-layout"><div className="thread-strip">{['N', 'A', 'A', 'W', 'S', 'C', 'B'].map((x, i) => <Avatar key={i} initials={x} tone={i === 0 ? 'purple' : 'slate'} />)}<span className="thread-more">+36</span></div><div className="conversation-content"><div className="conversation-title"><span className="ai-mark"><span className="delta-spinner" aria-hidden="true"><img src={deltaMark} alt="" /></span></span><div><h2>DELTA</h2><p>{running ? 'Executing real backend tools…' : 'Responses are returned from the DELTA runtime.'}</p></div></div>{running && <div className="activity-item"><span className="live-dot" />Running agent steps and validating tool results…</div>}{response && <div className="analytics-card"><p>{response}</p></div>}{error && <div className="error-note" role="alert">{error}</div>}<PromptBar onSubmit={runAgent} disabled={running} /></div></div> : <div className="home-empty"><div className="agent-avatar" aria-label="DELTA is ready"><span className="delta-spinner" aria-hidden="true"><img src={deltaMark} alt="" /></span></div><h2>How can I help you today?</h2><p>Ask me about your projects, stakeholders, requirements, or delivery risks.</p><PromptBar onSubmit={runAgent} disabled={running} /><div className="quick-actions"><button onClick={() => { setConversation(true); setShowAnalytics(true); }}><BarChart3 size={14} />Show analytics</button><Link href="/app/projects"><FolderKanban size={14} />Active projects</Link><Link href="/app/cycles"><CalendarDays size={14} />Due next week</Link><Link href="/app/cycles"><RefreshIcon />New work cycle</Link><Link href="/app/deliverables"><FileText size={14} />Generate BRD</Link></div></div>}{showAnalytics && <AnalyticsVisual />}<div className="home-grid">{loadingDashboard ? <div className="activity-item">Loading live workspace metrics…</div> : <><MetricCard icon={FolderKanban} label="Active projects" value={String(data?.activeProjects ?? 0)} detail={`${data?.risks ?? 0} risks need attention`} tone="blue" /><MetricCard icon={Zap} label="Requirements" value={String(data?.requirements ?? 0)} detail={`${data?.agentsWorking ?? 0} agent runs active`} tone="purple" /><MetricCard icon={CircleHelp} label="Open decisions" value={String(data?.decisions ?? 0)} detail={`${data?.pendingApprovals ?? 0} waiting for approval`} tone="amber" /><MetricCard icon={Check} label="Delivery health" value={`${data?.completionRate ?? 0}%`} detail={`${data?.risks ?? 0} risks across active projects`} tone="green" /></>}</div></div>;
}

function DiscoveryAgent() {
  const [content, setContent] = useState('Customers often call support without enough information to diagnose the appliance. The service team wants customers to upload an image before dispatch, while the warranty team needs exceptions reviewed by a human. Product manuals and service bulletins should be available during intake.');
  const [sourceType, setSourceType] = useState('transcript');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<null | { runId: string; status: string; summary: string; requirementsCreated: number; risksIdentified: number; decisionsRequired: number; openItemsCreated: number }>(null);
  const runDiscovery = async () => {
    setError('');
    setResult(null);
    if (content.trim().length < 20) {
      setError('Add at least 20 characters of transcript or workshop notes.');
      return;
    }
    setRunning(true);
    try {
      const token = window.localStorage.getItem('delta_token');
      const response = await fetch('/api/projects/proj-haier/discovery/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ content, sourceType }),
      });
      const rawText = await response.text();
      let payload: ({ error?: { message?: string } | string } & Partial<NonNullable<typeof result>>) | null = null;
      if (rawText.trim()) {
        try {
          payload = JSON.parse(rawText) as { error?: { message?: string } | string } & Partial<NonNullable<typeof result>>;
        } catch {
          throw new Error('DELTA returned an invalid discovery response. Check the backend service and try again.');
        }
      }
      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : payload?.error?.message;
        throw new Error(message ?? 'Discovery run failed. Check the workspace connection and try again.');
      }
      if (!payload) {
        throw new Error('DELTA returned an empty discovery response.');
      }
      setResult(payload as NonNullable<typeof result>);
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : 'Discovery run failed.');
    } finally {
      setRunning(false);
    }
  };
  return <div className="discovery-page"><PageTitle eyebrow="Workspace / Discovery Agent" title="Discovery & Analysis Agent" detail="Turn workshop transcripts and source notes into structured, reviewable implementation evidence." action={<Pill tone="green"><span className="live-dot" />Live Foundry agent</Pill>} /><section className="discovery-workspace"><div className="discovery-input-card"><div className="card-heading"><div><h2>Run discovery</h2><p>Paste a transcript, workshop notes, or project evidence. DELTA will extract requirements, risks, decisions, scope, and open items.</p></div><Search size={20} /></div><label className="field-label" htmlFor="discovery-source">Source type</label><select id="discovery-source" value={sourceType} onChange={(event) => setSourceType(event.target.value)}><option value="transcript">Transcript</option><option value="workshop">Workshop notes</option><option value="document">Project document</option></select><label className="field-label" htmlFor="discovery-content">Source content</label><textarea id="discovery-content" value={content} onChange={(event) => setContent(event.target.value)} rows={10} placeholder="Paste implementation evidence here..." /><div className="discovery-actions"><span>{content.trim().length} characters</span><button className="primary-button" onClick={runDiscovery} disabled={running}>{running ? 'Extracting…' : 'Run Discovery Agent'} <ArrowRight size={15} /></button></div>{error && <div className="error-note" role="alert">{error}</div>}</div>{result ? <section className="discovery-result-card"><Pill tone="green">Reviewable output · {result.status}</Pill><h2>Discovery run {result.runId}</h2><p>{result.summary}</p><div className="discovery-result-grid"><MetricCard icon={ClipboardList} label="Requirements" value={String(result.requirementsCreated)} detail="Ready for review" tone="blue" /><MetricCard icon={ShieldCheck} label="Risks" value={String(result.risksIdentified)} detail="Needs assessment" tone="amber" /><MetricCard icon={CircleHelp} label="Decisions" value={String(result.decisionsRequired)} detail="Human approval" tone="purple" /><MetricCard icon={Inbox} label="Open items" value={String(result.openItemsCreated)} detail="Follow-up needed" tone="green" /></div><Link href="/app/projects" className="secondary-button">Review project outputs <ArrowRight size={14} /></Link></section> : <div className="discovery-empty"><Search size={24} /><h2>Your structured output will appear here</h2><p>The agent keeps the original evidence connected to every extracted result.</p></div>}</section></div>;
}

const stakeholders = [['PN', 'Priya Nair', 'Sales Operations Lead', 'Apex Industrial Supplies', 'blue'], ['RA', 'Rawan Al-Salem', 'CRM Product Owner', 'Apex Industrial Supplies', 'purple'], ['SA', 'Sarah Albright', 'Regional Sales Director', 'Apex Industrial Supplies', 'cyan'], ['TA', 'Tom Avery', 'Partner Delivery Lead', 'Microsoft', 'green'], ['VS', 'Victor Stein', 'Finance Operations', 'Apex Industrial Supplies', 'amber']];
function ProjectDrawer({ mode, onClose }: { mode: 'stakeholders' | 'vault'; onClose: () => void }) { const [tab, setTab] = useState('Contacts'); const [toggles, setToggles] = useState([true, true, true]); return <aside className="drawer"><div className="drawer-header"><div><div className="eyebrow">Project controls</div><h2>{mode === 'stakeholders' ? 'Stakeholder management' : 'Private vault settings'}</h2><p>{mode === 'stakeholders' ? 'Manage contacts, tracks, and RACI assignments for this project.' : 'Control which assets can ground generated deliverables.'}</p></div><button onClick={onClose} className="icon-button"><X size={17} /></button></div>{mode === 'stakeholders' ? <><div className="tabs">{['Contacts', 'Tracks', 'RACI Matrix (18)'].map((x) => <button key={x} className={tab === x ? 'tab-active' : ''} onClick={() => setTab(x)}>{x}</button>)}</div>{tab === 'RACI Matrix (18)' ? <RaciMatrix /> : <><div className="drawer-toolbar"><Pill tone="blue">20 stakeholders</Pill><button className="primary-button small" onClick={() => window.alert('Stakeholder creation is available after connecting a persistent database.')}><Plus size={13} />Add</button></div><div className="info-note"><CircleHelp size={14} /> Assign RACI roles in the matrix tab.</div><div className="stakeholder-list">{stakeholders.map(([initials, name, title, org, tone]) => <div className="stakeholder-row" key={name}><Avatar initials={initials} tone={tone} /><div className="min-w-0 flex-1"><div className="stakeholder-name">{name}<Pill tone="slate">Customer</Pill></div><div className="stakeholder-meta">{title} · {org}</div><div className="stakeholder-email">{name.toLowerCase().replace(' ', '.')}@apex-industrial.com</div></div><MoreHorizontal size={15} className="text-slate-400" /></div>)}</div></>}</> : <div className="vault-settings">{[['Use Private Vault', 'Enable a private knowledge space for this project.'], ['Approved Assets Only', 'Only include approved assets in deliverables.'], ['Allow Work Cycle Override', 'Let individual work cycles customize vault settings.']].map(([label, detail], i) => <div className="setting-row" key={label}><div className="setting-icon"><LockKeyhole size={14} /></div><div className="flex-1"><div className="setting-label">{label}</div><div className="setting-detail">{detail}</div></div><button className={cx('switch', toggles[i] && 'switch-on')} onClick={() => setToggles((t) => t.map((v, j) => j === i ? !v : v))}><span /></button></div>)}<div className="drawer-subheading">Assets by category</div>{[['Playbook', 'Implementation Guide Success by Design'], ['Past deliverable', 'BRD — Apex Industrial Supplies — Global Dynamics 365']].map(([cat, name]) => <div className="vault-asset" key={name}><FileText size={15} /><div><div className="text-xs font-semibold">{name}</div><div className="mt-1 text-[10px] text-slate-400">{cat} · Approved</div></div><Pill tone="green">Approved</Pill></div>)}</div>}</aside>; }
function RaciMatrix() { const [cells, setCells] = useState<Record<string, string>>({ 'Priya Nair-0': 'R', 'Rawan Al-Salem-1': 'A' }); const roles = ['R', 'A', 'C', 'I']; return <div className="raci-wrap"><div className="raci-head"><span>Stakeholder</span>{roles.map((r) => <span key={r}>{r}</span>)}</div>{stakeholders.map(([initials, name, title, org, tone]) => <div className="raci-row" key={name}><div className="raci-person"><Avatar initials={initials} tone={tone} /><div><strong>{name}</strong><small>{title}</small></div></div>{roles.map((r, i) => { const key = `${name}-${i}`; const active = cells[key] === r; return <button key={r} onClick={() => setCells((c) => ({ ...c, [key]: active ? '' : r }))} className={cx('raci-cell', active && `raci-${r.toLowerCase()}`)}>{active ? <Check size={12} /> : r}</button>; })}</div>)}<div className="raci-warning"><CircleHelp size={14} /> Missing Responsible (R) in Delivery Squad</div><button className="primary-button save-raci" onClick={() => window.alert('RACI changes saved for this preview session.')}>Save changes</button></div>; }

function ProjectHub() { const [drawer, setDrawer] = useState<'stakeholders' | 'vault' | null>(null); return <><PageTitle eyebrow="Home / Projects / APEX-D365-Sales" title="Apex Industrial Supplies — Dynamics 365 Sales Rollout" detail="APEX-D365-Sales · Analysis / requirements" action={<div className="flex gap-2"><Pill tone="green">Active</Pill><button className="secondary-button" onClick={() => window.alert('Project editing is available after connecting a persistent database.')}><Settings size={14} />Edit</button></div>} /><div className="project-summary-grid">{[['Customer', 'Apex Industrial Supplies'], ['Apps in scope', 'Sales'], ['Delivery approach', 'Agile (2 weeks)'], ['Timeline', 'Jan 1, 2026 → Mar 31, 2026'], ['Contract type', 'Fixed Fee'], ['Owner', 'MONTASER ABDALLA']].map(([label, value]) => <div className="summary-item" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div><section className="content-card"><div className="section-heading"><div><h2>Work cycles</h2><p>Sprints and focused delivery phases for this project.</p></div><Link className="primary-button small" href="/app/cycles"><Plus size={14} />Create work cycle</Link></div><Link href="/app/cycles" className="cycle-row"><span className="cycle-icon"><Zap size={16} /></span><div className="flex-1"><div className="cycle-title">Lead management: Discovery and Analysis — Sprint 01 <Pill tone="amber">In progress</Pill></div><p>Capture, deduplicate, scoring / routing, and qualification outcomes.</p><div className="cycle-meta"><span>Jan 14 → Jan 28, 2026</span><span>68 assets</span><span>8 workshops</span></div></div><ChevronRight size={17} className="text-slate-400" /></Link></section><div className="related-grid"><button onClick={() => setDrawer('stakeholders')} className="related-card selected"><Users size={17} /><strong>Stakeholders</strong><span>Contacts, tracks, and RACI assignments</span><ArrowRight size={14} /></button><button onClick={() => setDrawer('vault')} className="related-card"><LockKeyhole size={17} /><strong>Private vault</strong><span>Collection defaults and access policies</span><ArrowRight size={14} /></button><Link href="/app/deliverables" className="related-card"><Layers3 size={17} /><strong>Project artifacts</strong><span>Documents, recordings, and raw inputs</span><ArrowRight size={14} /></Link><Link href="/app/deliverables" className="related-card"><ClipboardList size={17} /><strong>Deliverables</strong><span>BRDs, analysis, and generated outputs</span><ArrowRight size={14} /></Link></div>{drawer && <ProjectDrawer mode={drawer} onClose={() => setDrawer(null)} />}</>; }

function WorkCycles() { return <><PageTitle eyebrow="Workspace / Work cycles" title="Work cycles" detail="Focused delivery phases where agents turn project evidence into decisions and deliverables." action={<button className="primary-button" onClick={() => window.alert('Work cycle creation is available after connecting a persistent database.')}><Plus size={15} />New work cycle</button>} /><div className="cycle-list"><Link href="/app/cycles/lead-management" className="cycle-large"><div className="cycle-large-top"><div><Pill tone="amber">In progress</Pill><h2>Lead management: Discovery and Analysis — Sprint 01</h2><p>Apex Industrial Supplies · Dynamics 365 Sales Rollout</p></div><ArrowRight size={18} /></div><div className="cycle-large-bottom"><div><span>Goal</span><strong>Capture, deduplicate, scoring / routing, qualification outcomes</strong></div><div><span>Assets processed</span><strong className="text-emerald-600">100% <small>68 / 68</small></strong></div><div><span>Workshops</span><strong>8 / 8 completed</strong></div></div><div className="progress"><span style={{ width: '100%' }} /></div></Link><Link href="/app/cycles/customer-data" className="cycle-large"><div className="cycle-large-top"><div><Pill tone="purple">Ready</Pill><h2>Customer data migration — Sprint 02</h2><p>Apex Industrial Supplies · Dynamics 365 Sales Rollout</p></div><ArrowRight size={18} /></div><div className="cycle-large-bottom"><div><span>Goal</span><strong>Validate account, contact, and opportunity migration scope</strong></div><div><span>Assets processed</span><strong>72% <small>49 / 68</small></strong></div><div><span>Workshops</span><strong>5 / 7 completed</strong></div></div><div className="progress"><span style={{ width: '72%' }} /></div></Link></div></>; }

function CycleDetail() { const [chat, setChat] = useState('What did the discovery workshops say about duplicate lead handling?'); return <><PageTitle eyebrow="Back / Apex Industrial Supplies / Work cycles" title="Lead management: Discovery and Analysis — Sprint 01" detail="Apex Industrial Supplies · Dynamics 365 Sales Rollout" action={<div className="flex gap-2"><Pill tone="amber">In progress</Pill><button className="secondary-button">Edit</button></div>} /><div className="cycle-detail-grid"><section className="content-card cycle-profile"><div className="ai-assistant-card"><div className="ai-avatar"><Bot size={18} /></div><div className="flex-1"><div className="eyebrow">AI assistant</div><h3>BA Agent <Pill tone="green">Active</Pill></h3><p>Discovery & Analysis Agent grounded in 68 project assets.</p></div><button className="purple-button" onClick={() => document.getElementById('agent-chat')?.scrollIntoView({ behavior: 'smooth' })}>Chat with agent <ArrowRight size={14} /></button></div><div className="detail-stats"><div><span>Timeline</span><strong>Jan 14 → Jan 28</strong></div><div><span>Owner</span><strong>Maged Alsabri</strong></div><div><span>Deliverable</span><strong>BRD</strong></div><div><span>Template</span><strong>Default template</strong></div></div><div className="detail-section"><span className="section-label">Goal</span><p>Lead management: capture, deduplicate, scoring / routing, qualification outcomes.</p></div><div className="detail-section"><div className="flex justify-between"><span className="section-label">Assets processed</span><strong className="text-sm text-emerald-600">100%</strong></div><div className="progress mt-3"><span style={{ width: '100%' }} /></div><p className="mt-2 text-xs text-slate-400">68 of 68 assets processed · 8 workshops completed</p></div><div className="diagram-card"><div><span className="section-label">Generated process diagram</span><h3>Lead intake and qualification flow</h3></div><div className="diagram-flow"><span>Lead source</span><ArrowRight size={14} /><span>Deduplicate</span><ArrowRight size={14} /><span>Score & route</span><ArrowRight size={14} /><span className="diagram-end">Qualify</span></div></div></section><section className="content-card agent-chat" id="agent-chat"><div className="chat-header"><div className="flex items-center gap-2"><span className="ai-mark"><Bot size={14} /></span><div><h3>Chat with BA Agent</h3><p>Lead management · Discovery & Analysis</p></div></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><div className="chat-history"><button className="new-chat"><Plus size={13} />New chat</button>{['What did the discovery workshops say?', 'New conversation', 'Lead process diagram', 'Open gaps and decisions'].map((x, i) => <button className={cx('chat-thread', i === 0 && 'chat-thread-active')} key={x}><MessageCircle size={13} />{x}</button>)}</div><div className="chat-content"><div className="chat-bubble user-bubble">What did the discovery workshops say about duplicate lead handling?</div><div className="chat-bubble agent-bubble"><div className="chat-response-title"><Bot size={14} />BA Agent</div><p>Across the discovery workshops, duplicate handling is a high-confidence requirement. The team agreed that matching should happen before lead creation using email, company, and phone signals, with a review queue for ambiguous matches.</p><div className="chat-callout"><strong>Open decision</strong><span>Confirm the duplicate threshold and escalation owner before BRD generation.</span></div><div className="grounding"><span>Grounding sources</span><Pill tone="purple">DISC-WS-01.docx</Pill><Pill tone="purple">Lead_Intake_FieldMap</Pill><Pill tone="purple">+6 more</Pill></div></div></div><div className="chat-input"><button className="icon-button"><Paperclip size={15} /></button><input value={chat} onChange={(e) => setChat(e.target.value)} /><button className="prompt-send"><Send size={14} /></button></div></section></div></>; }

type AgentDiscoveryResult = {
  runId: string;
  status: string;
  summary: string;
  objectives: string[];
  stakeholders: string[];
  assumptions: string[];
  openQuestions: string[];
  risks: string[];
  requirementsCreated: number;
  completedAt: string;
};

type AgentRequirement = { id: string; title: string; description: string; priority: string; owner: string };

function ConnectedDeliverableViewer() {
  const [section, setSection] = useState('Executive Summary');
  const [questionBank, setQuestionBank] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AgentDiscoveryResult | null>(null);
  const [requirements, setRequirements] = useState<AgentRequirement[]>([]);
  const sections = ['Executive Summary', 'Business Perspective', 'User Perspective', 'Solution Perspective', 'Sales', 'Future State Business'];
  const projectId = 'proj-haier';

  const loadRequirements = async () => {
    const token = window.localStorage.getItem('delta_token');
    const response = await fetch(`/api/projects/${projectId}/requirements`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (response.ok) setRequirements(await response.json() as AgentRequirement[]);
  };

  useEffect(() => { void loadRequirements(); }, []);

  const regenerate = async () => {
    setRunning(true);
    setError('');
    try {
      const token = window.localStorage.getItem('delta_token');
      const response = await fetch(`/api/projects/${projectId}/discovery/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          sourceType: 'deliverable-regeneration',
          content: 'Lead management discovery for Apex Industrial Supplies Dynamics 365 Sales rollout. Analyze lead intake, duplicate detection, scoring, regional routing, qualification outcomes, required fields, ownership, approval boundaries, and reporting needs. Produce implementation-ready requirements and identify risks and open decisions.',
        }),
      });
      const payload = await response.json() as AgentDiscoveryResult | { error?: { message?: string } | string };
      if (!response.ok) {
        const errorPayload = payload as { error?: { message?: string } | string };
        const message = typeof errorPayload.error === 'string' ? errorPayload.error : errorPayload.error?.message;
        throw new Error(message ?? 'The Discovery Agent could not regenerate this deliverable.');
      }
      setResult(payload as AgentDiscoveryResult);
      await loadRequirements();
    } catch (agentError) {
      setError(agentError instanceof Error ? agentError.message : 'The Discovery Agent request failed.');
    } finally {
      setRunning(false);
    }
  };

  const questions = result?.openQuestions ?? ['Which fields are required before a lead can be created?', 'Who owns the manual review queue?', 'What is the acceptable match confidence threshold?'];
  const visibleRequirements = requirements.slice(0, 6);
  return <><PageTitle eyebrow="Back / Apex Industrial Supplies / Deliverables" title="BRD — Lead management: Discovery and Analysis — Sprint 01" detail={result ? `Generated by Discovery Agent · ${result.requirementsCreated} requirements · ${new Date(result.completedAt).toLocaleString()}` : 'Agent-grounded Business Requirements Document'} action={<div className="flex gap-2"><Pill tone={result ? 'green' : 'purple'}>{result ? 'Agent updated' : 'Draft Ready'}</Pill><button className="secondary-button" onClick={regenerate} disabled={running}>{running ? 'Agent working…' : 'Regenerate with Agent'} <Sparkles size={13} /></button></div>} />
    <div className="document-viewer">
      <aside className="document-outline"><div className="document-toolbar"><FileText size={15} /><span>Generated sections</span></div>{sections.map((x) => <button key={x} className={section === x ? 'outline-active' : ''} onClick={() => setSection(x)}><Check size={12} />{x}</button>)}<button className="question-bank-button" onClick={() => setQuestionBank(true)}><CircleHelp size={13} />Question bank <span className="ml-auto">{questions.length}</span></button></aside>
      <main className="document-page"><div className="document-page-head"><span>BRD · Discovery Agent output</span><span>{result ? `Run ${result.runId}` : 'Preview before first run'}</span></div><div className="paper"><div className="flex items-center justify-between gap-3"><h2>{section}</h2>{result && <Pill tone="green">Grounded output</Pill>}</div><p className="paper-lead">{result?.summary ?? 'Run the Discovery Agent to replace this preview with a grounded, reviewable deliverable.'}</p><h3>Requirements from the agent</h3>{visibleRequirements.length > 0 ? <div className="paper-table"><div><strong>Requirement</strong><strong>Priority</strong><strong>Owner</strong></div>{visibleRequirements.map((item) => <div key={item.id}><span>{item.title}</span><Pill tone={item.priority === 'high' ? 'amber' : 'purple'}>{item.priority}</Pill><span>{item.owner}</span></div>)}</div> : <div className="paper-callout"><Bot size={15} /><div><strong>Waiting for the Agent</strong><p>Regenerate this deliverable to create structured requirements from the project evidence.</p></div></div>}<h3>Agent review signals</h3><p>{result?.risks.length ?? 0} risks and {questions.length} open questions are attached to this output. Review them before promoting this BRD.</p>{result && <div className="paper-callout"><CircleHelp size={15} /><div><strong>Open decision</strong><p>{questions[0] ?? 'No open decisions were returned.'}</p></div></div>}{error && <div className="error-note" role="alert">{error}</div>}</div></main>
      <aside className="question-panel"><div className="card-heading"><div><h3>Question Bank — Lead Management</h3><p>{result ? 'Generated from the latest Agent run' : 'Awaiting Agent output'}</p></div><button className="icon-button"><X size={15} /></button></div><div className="question-block"><span className="section-label">Open questions from Agent</span>{questions.map((question) => <button key={question} onClick={() => setSection('Business Perspective')}>{question}<ChevronRight size={13} /></button>)}</div><div className="question-highlight"><strong>{result ? `${result.risks.length} risks require review` : 'Agent review required'}</strong><p>{result?.risks[0] ?? 'Run the Discovery Agent to identify risks, assumptions, and decisions from the project evidence.'}</p></div><Pill tone={result ? 'green' : 'purple'}>{result ? 'agent-grounded.docx' : 'draft-preview.docx'}</Pill></aside>
    </div>
    {questionBank && <div className="modal-backdrop" onClick={() => setQuestionBank(false)}><div className="modal-card" onClick={(event) => event.stopPropagation()}><div className="card-heading"><div><div className="eyebrow">Discovery Agent output</div><h3>Question bank ready</h3></div><button className="icon-button" onClick={() => setQuestionBank(false)}><X size={16} /></button></div><p className="mt-4 text-sm text-slate-600">{questions.length} questions were returned from the latest Agent run. Resolve them before approving the BRD.</p><button className="primary-button mt-5" onClick={() => setQuestionBank(false)}>Continue review</button></div></div>}
  </>;
}

function DeliverableViewer() { const [section, setSection] = useState('Executive Summary'); const [questionBank, setQuestionBank] = useState(false); const sections = ['Executive Summary', 'Business Perspective', 'User Perspective', 'Solution Perspective', 'Sales', 'Future State Business']; return <><PageTitle eyebrow="Back / Apex Industrial Supplies / Deliverables" title="BRD — Lead management: Discovery and Analysis — Sprint 01" detail="Generated Business Requirements Document · 202 pages · 19,602 words" action={<div className="flex gap-2"><Pill tone="purple">Draft Ready</Pill><button className="secondary-button">Export <ChevronDown size={13} /></button></div>} /><div className="document-viewer"><aside className="document-outline"><div className="document-toolbar"><FileText size={15} /><span>Regenerate sections</span></div>{sections.map((x) => <button key={x} className={section === x ? 'outline-active' : ''} onClick={() => setSection(x)}><Check size={12} />{x}</button>)}<button className="question-bank-button" onClick={() => setQuestionBank(true)}><CircleHelp size={13} />Question bank</button></aside><main className="document-page"><div className="document-page-head"><span>BRD_def2f12d_20260312.docx</span><span>Page 81 of 202 · 125%</span></div><div className="paper"><h2>{section}</h2><p className="paper-lead">Lead management discovery and analysis for the Apex Industrial Supplies Dynamics 365 Sales rollout.</p><h3>1. Context and intended outcome</h3><p>The implementation team needs a shared, traceable view of lead intake, deduplication, scoring, routing, and qualification outcomes. This document captures the validated requirements and the decisions still waiting for accountable owners.</p><div className="paper-table"><div><strong>Requirement</strong><strong>Priority</strong><strong>Owner</strong></div><div><span>Detect duplicate leads before creation</span><Pill tone="amber">High</Pill><span>Sales Operations</span></div><div><span>Route qualified leads to the correct regional queue</span><Pill tone="purple">Medium</Pill><span>CRM Product Owner</span></div><div><span>Report on conversion and exception rates</span><Pill tone="blue">Medium</Pill><span>Analytics Lead</span></div></div><h3>2. Acceptance criteria</h3><p>Each lead receives a visible disposition, an attributable owner, a confidence signal, and a grounding source. Ambiguous matches enter a review queue before downstream automation runs.</p><div className="paper-callout"><CircleHelp size={15} /><div><strong>Open decision</strong><p>Confirm duplicate threshold and escalation owner before BRD generation.</p></div></div></div></main><aside className="question-panel"><div className="card-heading"><div><h3>Question Bank — Lead Management</h3><p>Draft · confidence medium</p></div><button className="icon-button"><X size={15} /></button></div><div className="question-block"><span className="section-label">Coverage topics</span>{['Lead definition and lifecycle','Duplicate detection and matching','Qualification outcomes','Regional routing exceptions'].map((x) => <button key={x} onClick={() => setSection('Business Perspective')}>{x}<ChevronRight size={13} /></button>)}</div><div className="question-highlight"><strong>Questions to validate</strong><p>Which fields are required before a lead can be created? Who owns the manual review queue? What is the acceptable match confidence threshold?</p></div><Pill tone="purple">questions_20260312_124111.docx</Pill></aside></div>{questionBank && <div className="modal-backdrop" onClick={() => setQuestionBank(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}><div className="card-heading"><div><div className="eyebrow">AI-generated prep pack</div><h3>Question bank ready</h3></div><button className="icon-button" onClick={() => setQuestionBank(false)}><X size={16} /></button></div><p className="mt-4 text-sm text-slate-600">This question bank is grounded in the eight discovery workshop sources and highlights open decisions that block BRD finalization.</p><button className="primary-button mt-5" onClick={() => setQuestionBank(false)}>Continue review</button></div></div>}</>; }
function AuthCallback() { useEffect(() => { const token = new URLSearchParams(window.location.hash.slice(1)).get('token'); if (token) { window.localStorage.setItem('delta_token', token); window.location.replace('/app/dashboard'); } }, []); return <div className="min-h-screen grid place-items-center text-slate-600">Completing Microsoft sign-in…</div>; }
function LoginPage() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState(import.meta.env.DEV ? 'montaser.preview@delta.local' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'DeltaPreview2026!' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (demo = false) => {
    setLoading(true); setError('');
    const loginEmail = demo ? 'montaser.preview@delta.local' : email.trim().toLowerCase();
    const loginPassword = demo ? 'DeltaPreview2026!' : password;
    try {
      let result = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword }) });
      if (!result.ok && demo && import.meta.env.DEV) {
        result = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password: loginPassword, organization_name: 'DELTA Preview' }) });
      }
      const payload = await readAuthPayload(result);
      if (!result.ok || !payload.token) throw new Error(payload.error?.message ?? `Unable to sign in (server returned ${result.status}).`);
      window.localStorage.setItem('delta_token', payload.token); setLocation('/app/dashboard');
    } catch (loginError) { setError(loginError instanceof Error ? loginError.message : 'Unable to sign in.'); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen grid place-items-center bg-[#f7f9fc] p-5"><div className="entry-card w-full max-w-md"><LoginBrand /><Pill tone="blue">Workspace access</Pill><h1>Sign in to your workspace.</h1><p>Authenticate to access your tenant-scoped implementation workspace and agent runtime.</p><form className="mt-6 space-y-3" onSubmit={(event) => { event.preventDefault(); void submit(); }}><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" type="email" placeholder="Work email" value={email} onChange={(event) => setEmail(event.target.value)} required /><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" type="password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required /><button className="primary-button w-full justify-center" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'} <ArrowRight size={15} /></button></form>{import.meta.env.DEV && <button className="secondary-button mt-3 w-full justify-center" onClick={() => void submit(true)} disabled={loading}>Use local demo account</button>}<a className="mt-3 flex w-full justify-center rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700" href="/api/auth/entra/start">Continue with Microsoft Entra</a><Link href="/signup" className="mt-3 flex w-full justify-center text-sm font-semibold text-slate-600">Create a new account</Link>{error && <div className="error-note mt-4" role="alert">{error}</div>}</div></div>;
}
function SignupPage() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ email: '', password: '', organization_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setLoading(true); setError('');
    try {
      const result = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const payload = await readAuthPayload(result);
      if (!result.ok || !payload.token) throw new Error(payload.error?.message ?? 'Unable to create account.');
      window.localStorage.setItem('delta_token', payload.token); setLocation('/app/dashboard');
    } catch (signupError) { setError(signupError instanceof Error ? signupError.message : 'Unable to create account.'); }
    finally { setLoading(false); }
  };
  return <div className="min-h-screen grid place-items-center bg-[#f7f9fc] p-5"><div className="entry-card w-full max-w-md"><Logo /><Pill tone="purple">Create workspace</Pill><h1>Start with DELTA.</h1><p>Create your organization workspace and become its first delivery lead.</p><form className="mt-6 space-y-3" onSubmit={submit}><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" type="text" placeholder="Organization name" value={form.organization_name} onChange={(event) => setForm({ ...form, organization_name: event.target.value })} required /><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" type="email" placeholder="Work email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /><input className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm" type="password" placeholder="Password (minimum 10 characters)" minLength={10} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required /><button className="primary-button w-full justify-center" disabled={loading}>{loading ? 'Creating workspace…' : 'Create account'} <ArrowRight size={15} /></button></form><Link href="/login" className="secondary-button mt-3 w-full justify-center">Already have an account? Sign in</Link>{error && <div className="error-note mt-4" role="alert">{error}</div>}</div></div>;
}
function LandingPage() { return <div className="landing-page"><header className="landing-nav"><Logo /><nav><a href="#platform">Platform</a><a href="#workflow">Workflow</a><a href="#agents">Agents</a><a href="#security">Security</a></nav><div className="landing-actions"><a href="#contact">Contact</a><Link href="/app/dashboard" className="landing-login">Open workspace <ArrowRight size={14} /></Link></div></header><main><section className="landing-hero"><div className="hero-glow" /><div className="landing-hero-copy"><Pill tone="blue"><span className="live-dot" />DELTA / Operational intelligence</Pill><h1>The delivery layer for <em>complex change.</em></h1><p>DELTA turns enterprise ambiguity into an executable implementation path. Agents discover, analyze, and plan while your team keeps control of consequential decisions.</p><div className="hero-actions"><Link href="/app/dashboard" className="landing-primary">Enter the workspace <ArrowRight size={16} /></Link><a href="#platform" className="landing-secondary">Explore the platform</a></div><div className="hero-proof"><span><Check size={13} />Every output traceable</span><span><ShieldCheck size={13} />Human decisions stay explicit</span></div></div><div className="hero-console"><div className="console-top"><span>DELTA / LIVE WORKSPACE</span><Pill tone="green">Live system</Pill></div><div className="console-title"><span className="console-avatar"><Sparkles size={21} /></span><div><strong>Good afternoon, operator</strong><span>What should we move forward today?</span></div></div><div className="console-prompt"><Sparkles size={14} /><span>Ask anything about your implementation...</span><Send size={14} /></div><div className="console-metrics"><div><span>Active projects</span><strong>08</strong></div><div><span>Work cycles</span><strong>24</strong></div><div><span>Health</span><strong>92%</strong></div></div><div className="console-flow"><span className="flow-done">Discover</span><ArrowRight size={12} /><span className="flow-done">Analyze</span><ArrowRight size={12} /><span className="flow-wait">Approve</span><ArrowRight size={12} /><span>Plan</span></div></div></section><section id="platform" className="landing-section"><div className="section-intro"><span className="landing-eyebrow">One operating record</span><h2>From scattered context to a plan the team can execute.</h2><p>DELTA connects the evidence, decisions, ownership, requirements, and work cycles that make enterprise implementation move.</p></div><div className="feature-grid"><article><span className="feature-number">01</span><Bot size={21} /><h3>Intelligence</h3><p>AI assistants summarize source material, surface uncertainty, and answer questions using grounded workspace context.</p></article><article><span className="feature-number">02</span><GitBranchIcon /><h3>Traceability</h3><p>Objectives, requirements, stakeholders, RACI assignments, decisions, and deliverables stay connected end to end.</p></article><article><span className="feature-number">03</span><ShieldCheck size={21} /><h3>Human control</h3><p>Approvals, exceptions, vault policies, and audit-friendly ownership are visible at the moment they matter.</p></article></div></section><section id="workflow" className="landing-section workflow-section"><div className="section-intro"><span className="landing-eyebrow">The DELTA loop</span><h2>Every project follows a visible path from ambiguity to action.</h2></div><div className="workflow-track">{[['01','Discover','Map inputs, stakeholders, risks, and requirements.'],['02','Analyze','Test gaps, conflicts, dependencies, and recommendations.'],['03','Approve','Put decision rights in the hands of named owners.'],['04','Plan','Turn validated requirements into executable work.']].map(([num,title,body],i)=><div className={cx('workflow-step',i===3&&'workflow-last')} key={title}><span>{num}</span><div><h3>{title}</h3><p>{body}</p></div>{i<3&&<ArrowRight size={16}/>}</div>)}</div></section><section id="agents" className="landing-section agents-section"><div className="agent-banner"><div><span className="landing-eyebrow">A squad, not a copilot</span><h2>Focused agents hand useful work to one another.</h2><p>Discovery, analysis, and planning agents work inside the same implementation record, with your team deciding what happens next.</p></div><Link href="/app/agents" className="landing-secondary">Meet the agents <ArrowRight size={15} /></Link></div></section><section id="security" className="landing-section security-section"><div className="security-card"><LockKeyhole size={22} /><div><span className="landing-eyebrow">Built for consequence</span><h2>Speed without losing judgment.</h2><p>Private vault policies, approved assets, grounding sources, and explicit human approvals keep the system useful and accountable.</p></div><Link href="/app/projects" className="landing-primary">See a project <ArrowRight size={15} /></Link></div></section></main><footer id="contact" className="landing-footer"><Logo /><span>DELTA / Operational intelligence</span><Link href="/app/dashboard">Open workspace <ArrowRight size={14} /></Link></footer></div>; }
function GitBranchIcon() { return <GitBranch size={21} />; }
function LiveAnalysisCycle() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0);
  const stages = ['Loading project evidence', 'Extracting requirements', 'Testing dependencies and risks', 'Preparing human review'];
  useEffect(() => {
    if (!running || step >= stages.length) return;
    const timer = window.setTimeout(() => setStep((current) => current + 1), 900);
    return () => window.clearTimeout(timer);
  }, [running, step, stages.length]);
  const start = () => { setStep(0); setRunning(true); };
  const complete = !running && step === stages.length;
  return <><PageTitle eyebrow="Back / Apex Industrial Supplies / Work cycles" title="Lead management: Discovery and Analysis — Sprint 01" detail="Run the analysis in front of you, review the evidence, then decide what moves forward." action={<Pill tone={complete ? 'green' : 'amber'}>{complete ? 'Analysis complete' : running ? 'Agent working' : 'Ready to run'}</Pill>} /><section className="content-card live-analysis-card"><div className="live-analysis-head"><div><div className="eyebrow">Analysis agent</div><h2>Test the implementation evidence</h2><p>DELTA will inspect the 68 project assets, identify requirements and dependencies, then create a reviewable result.</p></div><button className="primary-button" onClick={start} disabled={running}>{running ? 'Analyzing…' : complete ? 'Run again' : 'Start analysis'} <Radar size={15} /></button></div><div className="analysis-progress"><div className="analysis-progress-top"><span>{running ? stages[Math.min(step, stages.length - 1)] : complete ? 'Result ready for your review' : 'Waiting for an analysis run'}</span><strong>{complete ? '100%' : `${Math.round((step / stages.length) * 100)}%`}</strong></div><div className="progress"><span style={{ width: `${complete ? 100 : (step / stages.length) * 100}%` }} /></div></div><div className="analysis-stages">{stages.map((stage, index) => <div className={index < step || complete ? 'analysis-stage done' : index === step && running ? 'analysis-stage active' : 'analysis-stage'} key={stage}><span>{index < step || complete ? <Check size={13} /> : index + 1}</span><div><strong>{stage}</strong><small>{index < step || complete ? 'Completed' : index === step && running ? 'In progress' : 'Waiting'}</small></div></div>)}</div>{complete && <div className="analysis-result"><div><Pill tone="green">Reviewable output</Pill><h3>Analysis found 6 requirements and 3 decision points</h3><p>Duplicate lead handling, routing ownership, and qualification thresholds need human approval before planning can begin.</p></div><Link href="/app/deliverables" className="secondary-button">Review result <ArrowRight size={14} /></Link></div>}</section></>;
}
type EnterpriseResource = {
  key: string;
  title: string;
  detail: string;
  icon: any;
  eyebrow?: string;
};

const enterpriseResources: Record<string, EnterpriseResource> = {
  agents: { key: 'agents', title: 'Agents', detail: 'Create and govern the specialist agents that operate on workspace context.', icon: Bot },
  knowledge: { key: 'knowledge', title: 'Knowledge', detail: 'Manage grounded sources, indexing status, and approved workspace context.', icon: Database },
  conversations: { key: 'conversations', title: 'Conversations', detail: 'Review operator conversations and the context used by each response.', icon: MessageSquare },
  runs: { key: 'runs', title: 'Runs', detail: 'Trace agent executions, tool calls, and outcomes across the workspace.', icon: Play },
  approvals: { key: 'approvals', title: 'Approvals', detail: 'Keep consequential decisions with named reviewers and an auditable record.', icon: CheckCircle2 },
  workflows: { key: 'workflows', title: 'Workflows', detail: 'Orchestrate repeatable delivery paths with explicit owners and checkpoints.', icon: Workflow },
  projects: { key: 'projects', title: 'Projects', detail: 'Connect implementation evidence, decisions, requirements, and delivery work.', icon: FolderKanban },
  tasks: { key: 'tasks', title: 'Tasks', detail: 'Track executable work generated from validated implementation context.', icon: ListTodo },
  integrations: { key: 'integrations', title: 'Integrations', detail: 'Connect systems that provide evidence or receive approved outputs.', icon: Link2 },
  analytics: { key: 'analytics', title: 'Analytics', detail: 'Understand workspace activity and delivery signals from connected data.', icon: BarChart3 },
  settings: { key: 'settings', title: 'Settings', detail: 'Configure workspace preferences, access, and delivery defaults.', icon: Settings },
};

function UnavailableState({ title }: { title: string }) {
  return <div className="enterprise-empty">
    <div className="enterprise-empty-icon"><Database size={22} /></div>
    <h2>No {title.toLowerCase()} data available</h2>
    <p>The backend endpoint for this workspace is not connected yet. Nothing has been fabricated here; connect the service to populate this view.</p>
    <span className="enterprise-empty-note"><CircleHelp size={14} /> Data will appear when the API is available</span>
  </div>;
}

function EnterpriseListPage({ resource }: { resource: EnterpriseResource }) {
  const [, setLocation] = useLocation();
  const [projects, setProjects] = useState<Array<{ id: string; name: string; description: string; industry: string; objective: string; status: string; progress: number; requirementsCount: number }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(resource.key === 'projects');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ name: '', description: '', industry: '', objective: '' });

  useEffect(() => {
    if (resource.key !== 'projects') return;
    const loadProjects = async () => {
      try {
        const token = window.localStorage.getItem('delta_token');
        const response = await fetch('/api/projects', { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) throw new Error('Projects could not be loaded.');
        setProjects(await response.json());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Projects could not be loaded.');
      } finally {
        setLoading(false);
      }
    };
    void loadProjects();
  }, [resource.key]);

  const createProject = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const token = window.localStorage.getItem('delta_token');
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(form),
      });
      const rawResponse = await response.text();
      let payload: { id?: string; error?: string | { message?: string } } = {};
      if (rawResponse.trim()) {
        try {
          payload = JSON.parse(rawResponse) as { id?: string; error?: string | { message?: string } };
        } catch {
          throw new Error(
            response.status >= 500
              ? 'The API server is unavailable. Check that the local API is running on port 3100.'
              : 'The server returned an invalid response. Please try again.',
          );
        }
      }
      if (response.status === 401) {
        window.localStorage.removeItem('delta_token');
        setLocation('/login');
        throw new Error('Your session is no longer valid. Please sign in again.');
      }
      if (!response.ok || !payload.id) {
        const message = typeof payload.error === 'string' ? payload.error : payload.error?.message;
        throw new Error(message ?? 'Project could not be created.');
      }
      setShowCreate(false);
      setForm({ name: '', description: '', industry: '', objective: '' });
      setLocation(`/app/projects/${payload.id}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Project could not be created.');
    } finally {
      setSaving(false);
    }
  };

  if (resource.key === 'projects') {
    return <><PageTitle eyebrow="Workspace / Projects" title="Projects" detail={resource.detail} action={<button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={14} />New project</button>} />
      <div className="enterprise-toolbar"><label className="enterprise-filter"><Search size={15} /><input placeholder="Search projects…" onChange={(event) => setProjects((items) => items.filter((project) => project.name.toLowerCase().includes(event.target.value.toLowerCase())))} /></label><span className="enterprise-api-state"><span className="status-dot" />{loading ? 'Loading live projects' : `${projects.length} projects`}</span></div>
      {error && <div className="error-note" role="alert">{error}</div>}
      <section className="enterprise-panel">{loading ? <div className="enterprise-empty"><h2>Loading projects…</h2></div> : projects.length === 0 ? <div className="enterprise-empty"><div className="enterprise-empty-icon"><FolderKanban size={22} /></div><h2>No projects yet</h2><p>Create your first project to give DELTA a workspace for evidence, requirements, and Agent runs.</p><button className="primary-button" onClick={() => setShowCreate(true)}><Plus size={14} />Create first project</button></div> : <div className="project-list">{projects.map((project) => <button className="project-list-row" key={project.id} onClick={() => setLocation(`/app/projects/${project.id}`)}><span className="project-list-icon"><FolderKanban size={17} /></span><span className="flex-1 text-left"><strong>{project.name}</strong><small>{project.industry || 'Industry not set'} · {project.requirementsCount} requirements · {project.progress}% complete</small></span><Pill tone={project.status === 'active' ? 'green' : 'slate'}>{project.status}</Pill><ChevronRight size={16} /></button>)}</div>}</section>
      {showCreate && <div className="modal-backdrop" onClick={() => setShowCreate(false)}><form className="modal-card project-create-modal" onSubmit={createProject} onClick={(event) => event.stopPropagation()}><div className="card-heading"><div><div className="eyebrow">Workspace setup</div><h3>Create a project</h3><p>Give DELTA the context it needs before the first Agent run.</p></div><button type="button" className="icon-button" onClick={() => setShowCreate(false)}><X size={16} /></button></div><label className="form-field"><span>Project name</span><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Customer Service Transformation" /></label><label className="form-field"><span>Company / industry</span><input required value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} placeholder="Manufacturing" /></label><label className="form-field"><span>Objective</span><input required value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} placeholder="Reduce manual support processing" /></label><label className="form-field"><span>Description</span><textarea required rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Describe the implementation challenge…" /></label>{error && <div className="error-note" role="alert">{error}</div>}<button className="primary-button" disabled={saving}>{saving ? 'Creating project…' : 'Create project'} <ArrowRight size={14} /></button></form></div>}
    </>;
  }
  return <><PageTitle eyebrow={`Workspace / ${resource.title}`} title={resource.title} detail={resource.detail} action={<button className="secondary-button" disabled><Plus size={14} />New {resource.title.slice(0, -1)}</button>} />
    <div className="enterprise-toolbar"><label className="enterprise-filter"><Search size={15} /><input placeholder={`Search ${resource.title.toLowerCase()}…`} disabled /></label><span className="enterprise-api-state"><span className="status-dot" />Awaiting API data</span></div>
    <section className="enterprise-panel"><UnavailableState title={resource.title} /></section>
  </>;
}

function EnterpriseDetailPage({ resource }: { resource: EnterpriseResource }) {
  const [, setLocation] = useLocation();
  const projectId = window.location.pathname.split('/').pop() ?? '';
  const [project, setProject] = useState<{ name: string; description: string; industry: string; objective: string; status: string; lifecycleStage: string; progress: number; requirementsCount: number; risks: number; openDecisions: number; pendingApprovals: number }>();
  const [error, setError] = useState('');

  useEffect(() => {
    if (resource.key !== 'projects' || !projectId) return;
    const token = window.localStorage.getItem('delta_token');
    void fetch(`/api/projects/${projectId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(async (response) => {
        const payload = await response.json() as typeof project & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? 'Project could not be loaded.');
        setProject(payload);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Project could not be loaded.'));
  }, [projectId, resource.key]);

  return <><PageTitle eyebrow={`Workspace / ${resource.title} / Detail`} title={project?.name ?? `${resource.title} detail`} detail={project?.description ?? 'Loading project details.'} action={<button className="secondary-button" onClick={() => setLocation(`/app/${resource.key}`)}><ArrowRight size={14} className="rotate-180" />Back to {resource.title}</button>} />
    <div className="enterprise-detail-grid"><section className="enterprise-panel"><div className="enterprise-detail-hero"><span className="enterprise-detail-icon"><resource.icon size={20} /></span><div><Pill tone={project ? 'green' : 'slate'}>{project?.status ?? 'Loading'}</Pill><h2>{project?.objective ?? (error || 'Loading project details…')}</h2><p>{project ? `${project.industry} · ${project.lifecycleStage} · ${project.progress}% complete` : 'Connecting to the project service.'}</p></div></div>{project && <div className="enterprise-metric-grid"><div><strong>{project.requirementsCount}</strong><span>Requirements</span></div><div><strong>{project.openDecisions}</strong><span>Open decisions</span></div><div><strong>{project.risks}</strong><span>Risks</span></div><div><strong>{project.pendingApprovals}</strong><span>Approvals</span></div></div>}</section>
      <aside className="enterprise-side-panel"><div className="eyebrow">Related context</div><h3>{project ? 'Demo project workspace' : 'Loading context'}</h3><p>{project ? 'Discovery, analysis, approvals, activity, and delivery planning will be connected here.' : 'Linked runs, approvals, tasks, and activity will appear here when the project is loaded.'}</p></aside></div>
  </>;
}

function WorkspaceModule({ title, icon: Icon, detail, action = 'Add first record' }: { title: string; icon: any; detail: string; action?: string }) {
  const [added, setAdded] = useState(false);
  return <><PageTitle eyebrow={`Workspace / ${title}`} title={title} detail={detail} /><div className="placeholder"><Icon size={26} /><h2>{added ? `${title} item created` : `${title} workspace`}</h2><p>{added ? 'The next step is ready for you to review.' : 'Use this workspace to keep project context, ownership, and actions connected.'}</p><button className="primary-button" onClick={() => setAdded(true)}><Plus size={15} />{added ? 'Add another record' : action}</button></div></>;
}
function ActivityInbox() { return <><PageTitle eyebrow="Workspace / Inbox" title="Inbox" detail="Review agent outputs, approvals, and project activity in one place." /><div className="activity-list">{[['Discovery Agent', 'Discovery run is ready for review.', 'Now'], ['Analysis Agent', '3 risks and 5 decisions need attention.', 'Today'], ['Workspace', 'New work cycle is ready to start.', 'Yesterday']].map(([actor, detail, time]) => <article className="activity-row" key={detail}><span className="activity-dot" /><div><strong>{actor}</strong><p>{detail}</p></div><time>{time}</time></article>)}</div></>; }
function ProjectDetailRoute() {
  const [, setLocation] = useLocation();
  if (!window.localStorage.getItem('delta_token')) {
    setLocation('/login');
    return null;
  }
  return <AppShell><EnterpriseDetailPage resource={enterpriseResources.projects} /></AppShell>;
}
function AppRouter() { const [, setLocation] = useLocation(); if (!window.localStorage.getItem('delta_token')) { setLocation('/login'); return null; } return <AppShell><Switch>
  <Route path="/app/dashboard" component={Dashboard} /><Route path="/app/discovery" component={DiscoveryAgent} />
  <Route path="/app/agents/:id" component={() => <EnterpriseDetailPage resource={enterpriseResources.agents} />} /><Route path="/app/agents" component={() => <EnterpriseListPage resource={enterpriseResources.agents} />} />
  <Route path="/app/knowledge/:id" component={() => <EnterpriseDetailPage resource={enterpriseResources.knowledge} />} /><Route path="/app/knowledge" component={() => <EnterpriseListPage resource={enterpriseResources.knowledge} />} />
  <Route path="/app/conversations/:id" component={() => <EnterpriseDetailPage resource={enterpriseResources.conversations} />} /><Route path="/app/conversations" component={() => <EnterpriseListPage resource={enterpriseResources.conversations} />} />
  <Route path="/app/runs/:id" component={() => <EnterpriseDetailPage resource={enterpriseResources.runs} />} /><Route path="/app/runs" component={() => <EnterpriseListPage resource={enterpriseResources.runs} />} />
  <Route path="/app/approvals" component={() => <EnterpriseListPage resource={enterpriseResources.approvals} />} />
  <Route path="/app/workflows/:id" component={() => <EnterpriseDetailPage resource={enterpriseResources.workflows} />} /><Route path="/app/workflows" component={() => <EnterpriseListPage resource={enterpriseResources.workflows} />} />
  <Route path="/app/projects/:id" component={() => <EnterpriseDetailPage resource={enterpriseResources.projects} />} /><Route path="/app/projects" component={() => <EnterpriseListPage resource={enterpriseResources.projects} />} />
  <Route path="/app/tasks" component={() => <EnterpriseListPage resource={enterpriseResources.tasks} />} />
  <Route path="/app/cycles/lead-management" component={LiveAnalysisCycle} /><Route path="/app/cycles/:id" component={LiveAnalysisCycle} /><Route path="/app/cycles" component={WorkCycles} /><Route path="/app/deliverables" component={ConnectedDeliverableViewer} />
  <Route path="/app/analytics" component={() => <EnterpriseListPage resource={enterpriseResources.analytics} />} /><Route path="/app/inbox" component={ActivityInbox} />
  <Route path="/app/calendar" component={() => <WorkspaceModule title="Calendar" icon={CalendarDays} detail="Plan work cycles, milestones, and customer checkpoints." action="Create a work cycle" />} /><Route path="/app/customers" component={() => <WorkspaceModule title="Customers" icon={BriefcaseIcon} detail="Keep customer stakeholders and implementation context connected." action="Add a customer" />} /><Route path="/app/members" component={() => <WorkspaceModule title="Members" icon={Users} detail="Manage workspace owners, delivery leads, and reviewers." action="Invite a member" />} /><Route path="/app/vault" component={() => <WorkspaceModule title="Private vault" icon={LockKeyhole} detail="Control which approved assets can ground generated outputs." action="Add approved asset" />} /><Route path="/app/security" component={() => <WorkspaceModule title="Security" icon={ShieldCheck} detail="Review access boundaries, approvals, and audit-ready ownership." action="Review access policy" />} />
  <Route path="/app/integrations" component={() => <EnterpriseListPage resource={enterpriseResources.integrations} />} /><Route path="/app/settings" component={() => <EnterpriseListPage resource={enterpriseResources.settings} />} /><Route component={Dashboard} />
</Switch></AppShell>; }
function AppEntry() { const [, setLocation] = useLocation(); return <div className="grid min-h-screen place-items-center bg-[#f7f9fc] p-5"><div className="entry-card"><Logo /><Pill tone="blue">Local workspace</Pill><h1>Enter DELTA operations.</h1><p>Explore the implementation workspace with the reference dashboard core: projects, work cycles, stakeholders, and AI-grounded delivery context.</p><div className="entry-user"><Avatar initials="MA" tone="dark" /><div><strong>MONTASER ABDALLA</strong><span>Platform owner</span></div><Check className="ml-auto text-emerald-500" size={17} /></div><button className="primary-button w-full justify-center" onClick={() => setLocation(window.localStorage.getItem('delta_token') ? '/app/dashboard' : '/login')}>{window.localStorage.getItem('delta_token') ? 'Continue to workspace' : 'Sign in to workspace'} <ArrowRight size={15} /></button></div></div>; }
function Router() { return <Switch><Route path="/" component={MarketingHome} /><Route path="/platform" component={() => <MarketingPage kind="platform" />} /><Route path="/workflow" component={() => <MarketingPage kind="workflow" />} /><Route path="/agents" component={() => <MarketingPage kind="agents" />} /><Route path="/security" component={() => <MarketingPage kind="security" />} /><Route path="/contact" component={() => <MarketingPage kind="contact" />} /><Route path="/login" component={LoginPage} /><Route path="/signup" component={SignupPage} /><Route path="/auth/callback" component={AuthCallback} /><Route path="/app/projects/:id" component={ProjectDetailRoute} /><Route path="/app" component={AppEntry} /><Route path="/app/:rest*" component={AppRouter} /><Route component={MarketingHome} /></Switch>; }
export default function App() { return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><Router /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>; }
