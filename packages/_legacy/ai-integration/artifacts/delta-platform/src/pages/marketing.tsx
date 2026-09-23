import { type ReactNode, useState } from 'react';
import { ArrowRight, BarChart3, Bot, Check, ChevronDown, ChevronRight, ClipboardCheck, Code2, LockKeyhole, Search, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import { Link } from 'wouter';
import deltaLogo from '@assets/delta-brand-logo-cropped.png';
import '../marketing-sections.css';
import '../marketing-copy.css';
import '../marketing-home.css';

type MarketingKind = 'platform' | 'workflow' | 'agents' | 'security' | 'contact';

const pageContent: Record<MarketingKind, { eyebrow: string; title: string; accent: string; description: string; points: string[] }> = {
  platform: {
    eyebrow: 'DELTA / Platform',
    title: 'One operating layer for every implementation.',
    accent: 'implementation.',
    description: 'Bring requirements, evidence, decisions, and delivery into one living workspace. DELTA gives every team a shared view of what is known, what is changing, and what must happen next.',
    points: ['Projects and work cycles in one operational view', 'Traceable requirements, decisions, and deliverables', 'A shared workspace for customers, partners, and delivery teams'],
  },
  workflow: {
    eyebrow: 'DELTA / Workflow',
    title: 'Move from ambiguity to accountable action.',
    accent: 'accountable action.',
    description: 'The workflow keeps momentum without hiding uncertainty. Each stage creates a useful next state and keeps human approval exactly where it belongs.',
    points: ['Discover the signals inside workshops and source material', 'Analyze conflicts, gaps, risks, and dependencies', 'Approve the decisions that shape the implementation plan'],
  },
  agents: {
    eyebrow: 'DELTA / Agents',
    title: 'A delivery squad that supports every team.',
    accent: 'every team.',
    description: 'Discovery, analysis, planning, and delivery agents handle the heavy lifting while operators retain context, judgment, and control over the outcome.',
    points: ['Business analysis grounded in your project evidence', 'Planning that turns validated requirements into next work', 'Outputs that are reviewable, editable, and ready to use'],
  },
  security: {
    eyebrow: 'DELTA / Trust',
    title: 'Support every stakeholder without losing control.',
    accent: 'losing control.',
    description: 'DELTA is designed for customer teams, implementation partners, system integrators, and internal operators who need collaboration with clear boundaries.',
    points: ['Explicit approvals and accountable decision ownership', 'Private vault controls for sensitive project assets', 'Traceability across evidence, outputs, and changes'],
  },
  contact: {
    eyebrow: 'DELTA / Contact',
    title: 'Build the next implementation with us.',
    accent: 'with us.',
    description: 'Tell us where your delivery process is carrying too much ambiguity. We will map the first useful workflow together, from discovery through an implementation-ready plan.',
    points: ['Dynamics 365 and enterprise implementation partners', 'Customer delivery and transformation teams', 'System integrators building repeatable delivery operations'],
  },
};

function DashboardPreview() {
  return <div className="marketing-dashboard-preview" aria-label="DELTA dashboard preview">
    <div className="preview-topline"><span><span className="preview-live" /> DELTA / LIVE WORKSPACE</span><span className="preview-status">Operational</span></div>
    <div className="preview-heading"><span className="preview-spark"><Sparkles size={17} /></span><div><strong>Good afternoon, MONTASER ABDALLA</strong><small>Here is what needs attention next.</small></div></div>
    <div className="preview-prompt"><Sparkles size={13} /><span>Ask about a project, decision, or risk...</span><ArrowRight size={13} /></div>
    <div className="preview-metrics"><div><small>Active projects</small><strong>08</strong><span>+2 this month</span></div><div><small>Work cycles</small><strong>24</strong><span>6 ready for review</span></div><div><small>Delivery health</small><strong>92%</strong><span>On track</span></div></div>
    <div className="preview-flow"><div className="preview-flow-label">Implementation path</div><div className="preview-flow-steps"><span className="is-done">Discover</span><ChevronRight size={13} /><span className="is-done">Analyze</span><ChevronRight size={13} /><span className="is-wait">Approve</span><ChevronRight size={13} /><span>Plan</span></div></div>
    <div className="preview-table"><div><span><Target size={13} /> Lead management</span><b>100%</b></div><div><span><ClipboardCheck size={13} /> Customer data migration</span><b>72%</b></div><div><span><Users size={13} /> Stakeholder alignment</span><b>Ready</b></div></div>
  </div>;
}

function MarketingNav() {
  return <header className="marketing-nav"><Link href="/" className="marketing-logo"><img src={deltaLogo} alt="DELTA" /></Link><nav><Link href="/platform">Platform</Link><Link href="/workflow">Workflow</Link><Link href="/agents">Agents</Link><Link href="/security">Security</Link></nav><div className="marketing-actions"><Link href="/contact">Contact</Link><Link href="/app/dashboard" className="marketing-login">Open workspace <ArrowRight size={14} /></Link></div></header>;
}

function MarketingFooter() {
  return <footer className="marketing-footer"><div><Link href="/" className="marketing-logo"><img src={deltaLogo} alt="DELTA" /></Link><p>The delivery layer for complex change.</p></div><div className="footer-contact"><Link href="/contact" className="marketing-footer-cta">Talk to the delivery team <ArrowRight size={14} /></Link><span>Support for customers, partners, and system integrators.</span></div><div className="footer-links"><Link href="/platform">Platform</Link><Link href="/workflow">Workflow</Link><Link href="/agents">Agents</Link><Link href="/security">Security</Link><Link href="/contact">Contact</Link></div></footer>;
}

const agentRoadmap = [
  { icon: Search, title: 'Discovery & Analysis Agent', status: 'Live', text: 'Turns workshop signals into structured requirements, scope boundaries, and open items.' },
  { icon: PencilIcon, title: 'Design Agent', status: 'Roadmap', text: 'Translates approved scope into solution design deliverables and implementation-ready specifications.' },
  { icon: Code2, title: 'Build Agent', status: 'Roadmap', text: 'Assists execution with guided build workflows and guardrails inside engineering environments.' },
  { icon: ShieldCheck, title: 'Quality & Readiness Agent', status: 'Roadmap', text: 'Tests coverage, tracks readiness, and supports cutover and stabilization through go-live.' },
];

function PencilIcon({ size, className }: { size?: number; className?: string }) { return <Target size={size} className={className} />; }

function AgentRoadmap() {
  return <section className="agent-roadmap"><div className="marketing-section-heading"><span className="marketing-eyebrow"><Bot size={13} />DELTA / Agent lifecycle</span><h2>One delivery squad, expanding with your work.</h2><p>The first agent is live today. The roadmap extends coverage across design, build, quality, and governance without losing the human owner.</p></div><div className="agent-live-card"><AgentCard agent={agentRoadmap[0]} featured /><div className="agent-live-output"><span className="output-label">Generated output</span><strong>Draft BRD</strong><span>68 artifacts analyzed · 8 workshops · traceable requirements</span><Link href="/app/deliverables">Open deliverable <ArrowRight size={13} /></Link></div></div><div className="agent-roadmap-grid">{agentRoadmap.slice(1).map((agent) => <AgentCard key={agent.title} agent={agent} />)}</div><div className="governance-agent"><ShieldCheck size={20} /><div><span className="output-label">Cross-cutting layer</span><h3>Governance Agent</h3><p>Keeps decisions, risks, scope changes, approvals, and audit trails connected across every phase.</p></div></div></section>;
}

function LifecycleCapabilities() {
  return <section className="lifecycle-capabilities" aria-labelledby="lifecycle-capabilities-title">
    <div className="marketing-section-heading centered">
      <span className="marketing-eyebrow"><Bot size={13} />Features</span>
      <h2 id="lifecycle-capabilities-title">Practical lifecycle capabilities</h2>
      <p>Tools designed to support every stage of the requirements lifecycle.</p>
    </div>
    <div className="lifecycle-feature-grid">
      <article className="lifecycle-feature lifecycle-feature-live">
        <Link href="/app/discovery" className="lifecycle-agent-link"><AgentCard agent={agentRoadmap[0]} featured /></Link>
        <div className="lifecycle-output">
          <div className="lifecycle-output-heading">
            <span className="output-label">Live output</span>
            <span className="lifecycle-output-status"><i />Ready</span>
          </div>
          <div className="lifecycle-output-stats">
            <div><strong>68</strong><span>Artifacts analyzed</span></div>
            <div><strong>8</strong><span>Workshops captured</span></div>
          </div>
          <Link className="lifecycle-output-link" href="/app/deliverables">Generate Draft BRD <ArrowRight size={13} /></Link>
        </div>
      </article>
      {agentRoadmap.slice(1).map((agent) => <AgentCard key={agent.title} agent={agent} />)}
      <div className="lifecycle-connectors" aria-hidden="true"><span /><span /><span /><i /></div>
      <article className="lifecycle-governance">
        <ShieldCheck size={20} />
        <div><span className="output-label">Cross-cutting layer</span><h3>Governance Agent</h3><p>Keeps decisions, risks, scope changes, approvals, and audit trails connected across every phase.</p></div>
      </article>
    </div>
  </section>;
}

function AgentCard({ agent, featured = false }: { agent: (typeof agentRoadmap)[number]; featured?: boolean }) {
  const Icon = agent.icon;
  return <article className={featured ? 'agent-card agent-card-featured' : 'agent-card'}><span className="agent-icon"><Icon size={19} /></span><div><span className={agent.status === 'Live' ? 'agent-status live' : 'agent-status'}>{agent.status}</span><h3>{agent.title}</h3><p>{agent.text}</p></div></article>;
}

function OperationsSection() {
  const cards = [
    ['Operating model', 'Agents accelerate the work; humans remain accountable for decisions and outcomes.', Target],
    ['Governance system', 'Approvals, decision history, scope boundaries, and traceability stay connected.', ShieldCheck],
    ['Execution handovers', 'Phase-ready deliverables keep project truth intact across discovery, design, build, and go-live.', ClipboardCheck],
    ['Workflow connectivity', 'Read inputs and push outputs into the tools teams already use without re-documenting.', Code2],
    ['Delivery scale', 'Repeatable standards across projects, teams, and geographies without bottlenecks.', BarChart3],
    ['Lifecycle squad roadmap', 'Discovery and Analysis is live in early access; additional agents extend coverage over time.', Users],
  ] as const;
  return <section className="operations-section"><div className="marketing-section-heading centered"><span className="marketing-eyebrow"><Target size={13} />The operating model</span><h2>Built for delivery operations.</h2><p>DELTA supports the full implementation ecosystem, from the first workshop to a stable handover.</p></div><div className="operations-grid">{cards.map(([title, text, Icon]) => <article className="operation-card" key={title}><span className="operation-icon"><Icon size={19} /></span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>;
}

function FrequentlyAskedQuestions() {
  const [open, setOpen] = useState(0);
  const questions = [
    ['What problem is DELTA solving?', 'Enterprise delivery breaks down when project truth fragments across the lifecycle. DELTA keeps evidence, decisions, handovers, and actions connected so teams can move with clarity.'],
    ['What does DELTA do?', 'DELTA turns implementation input into structured discovery, analysis, human decisions, and implementation-ready plans.'],
    ['What does human-led mean?', 'Agents handle structured work and surface useful next states. People still own approvals, exceptions, scope, and the consequences of decisions.'],
    ['Who is DELTA for?', 'Customer teams, implementation partners, system integrators, delivery leads, analysts, and operators who need one shared operating language.'],
    ['How does access work?', 'The workspace starts with controlled local access and is designed to grow into organization-scoped authentication, approvals, and audit controls.'],
  ];
  return <section className="faq-section"><div className="marketing-section-heading centered"><span className="marketing-eyebrow"><ShieldCheck size={13} />FAQs</span><h2>Clear answers for the delivery team.</h2><p>Understand how the workflow, agents, and human controls fit together.</p></div><div className="faq-list">{questions.map(([question, answer], index) => <div className={open === index ? 'faq-item open' : 'faq-item'} key={question}><button onClick={() => setOpen(open === index ? -1 : index)} aria-expanded={open === index}><span>{question}</span>{open === index ? <ChevronDown size={17} /> : <ChevronRight size={17} />}</button>{open === index && <p>{answer}</p>}</div>)}</div><div className="faq-contact"><div><h3>Have more questions?</h3><p>Bring us the delivery workflow that needs more clarity.</p></div><Link href="/contact" className="marketing-primary">Talk to us <ArrowRight size={14} /></Link></div></section>;
}

export function MarketingPage({ kind }: { kind: MarketingKind }) {
  const content = pageContent[kind];
  const isContact = kind === 'contact';
  return <div className="marketing-page"><MarketingNav /><main>
    <section className="marketing-hero marketing-page-hero"><div className="marketing-copy"><span className="marketing-eyebrow"><span className="marketing-dot" />{content.eyebrow}</span><h1>{content.title.replace(content.accent, '')}<em>{content.accent}</em></h1><p>{content.description}</p><div className="marketing-actions-row"><Link href={isContact ? '/app/dashboard' : '/contact'} className="marketing-primary">{isContact ? 'Open the workspace' : 'Talk through your workflow'} <ArrowRight size={16} /></Link><Link href="/app/dashboard" className="marketing-secondary">See the live workspace</Link></div><div className="marketing-proof">{content.points.map((point) => <span key={point}><Check size={14} />{point}</span>)}</div></div></section>
    {kind === 'agents' ? <AgentRoadmap /> : <OperationsSection />}
    {kind === 'contact' && <FrequentlyAskedQuestions />}
  </main><MarketingFooter /></div>;
}

function DetailCard({ icon: Icon, title, text }: { icon: typeof BarChart3; title: string; text: string }) {
  return <article className="marketing-detail-card"><span className="marketing-card-icon"><Icon size={18} /></span><h3>{title}</h3><p>{text}</p><Link href="/app/dashboard">Explore workspace <ArrowRight size={14} /></Link></article>;
}

function FreshHero() {
  return <section className="fresh-hero"><div className="fresh-hero-copy"><span className="fresh-eyebrow"><span className="fresh-dot" />DELTA / Building the execution layer</span><h1>The AI <em>implementation squad</em> for complex change.</h1><p>Specialist agents turn discovery into decisions, plans, and delivery while human owners stay in control of every consequential move.</p><div className="fresh-divider" /><strong className="fresh-launch">Our first Discovery / Analysis Agent is live today.</strong><div className="fresh-actions"><Link href="/agents" className="fresh-primary">Early access <ArrowRight size={16} /></Link><Link href="/contact" className="fresh-secondary">Book a demo</Link></div><small className="fresh-support">Built for real implementation work. Human authority stays explicit.</small></div></section>;
}

export function MarketingHome() {
  return <div className="marketing-page"><MarketingNav /><main><FreshHero /><LifecycleCapabilities /><OperationsSection /><FrequentlyAskedQuestions /></main><MarketingFooter /></div>;
}
