import { Router, type IRouter } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db, deltaProjectsTable, type DeltaProject } from "@workspace/db";
import {
  CreateProjectBody,
  CreateProjectResponse,
  DecideApprovalBody,
  DecideApprovalParams,
  DecideApprovalResponse,
  GenerateImplementationPlanParams,
  GenerateImplementationPlanResponse,
  GetAnalysisParams,
  GetAnalysisResponse,
  GetDashboardResponse,
  GetImplementationPlanParams,
  GetImplementationPlanResponse,
  GetProjectParams,
  GetProjectResponse,
  GetTraceabilityParams,
  GetTraceabilityResponse,
  ListActivityParams,
  ListActivityResponse,
  ListApprovalsParams,
  ListApprovalsResponse,
  ListProjectsResponse,
  ListRequirementsParams,
  ListRequirementsResponse,
  RunAnalysisParams,
  RunAnalysisResponse,
  RunDiscoveryBody,
  RunDiscoveryParams,
  RunDiscoveryResponse,
  UpdateProjectBody,
  UpdateProjectParams,
  UpdateProjectResponse,
  UpdateRequirementBody,
  UpdateRequirementParams,
  UpdateRequirementResponse,
} from "@workspace/api-zod";
import {
  type DeltaActivity,
  type DeltaAnalysis,
  type DeltaApproval,
  type DeltaDiscovery,
  type DeltaPlan,
  type DeltaRequirement,
  type DeltaTask,
  type DeltaTraceability,
} from "@workspace/db";

const router: IRouter = Router();
let seedPromise: Promise<void> | undefined;

const nowIso = () => new Date().toISOString();
const id = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const seedRequirements = (projectId: string): DeltaRequirement[] => [
  {
    id: "REQ-024",
    projectId,
    title: "Enable customers to upload appliance images",
    description:
      "Customers should be able to share a clear appliance image before a service visit is scheduled.",
    source: "Workshop 03",
    priority: "high",
    status: "validated",
    owner: "Customer Operations",
    confidence: 94,
    dependencies: ["Knowledge Base", "Vision Service", "CRM"],
    linkedProcess: "Issue triage",
    linkedDecision: "DEC-005",
    linkedOutput: "Image intake workflow",
  },
  {
    id: "REQ-031",
    projectId,
    title: "Retrieve product knowledge during intake",
    description:
      "The workflow should ground issue analysis in current appliance manuals and service bulletins.",
    source: "Transcript 02",
    priority: "high",
    status: "validated",
    owner: "Product Knowledge",
    confidence: 91,
    dependencies: ["Knowledge Base"],
    linkedProcess: "Knowledge retrieval",
    linkedDecision: "DEC-003",
    linkedOutput: "Grounded recommendation",
  },
  {
    id: "REQ-037",
    projectId,
    title: "Create a CRM service ticket after approval",
    description:
      "Once the recommendation is approved, create a traceable service ticket with the evidence used.",
    source: "Workshop 04",
    priority: "medium",
    status: "needs-review",
    owner: "Service Operations",
    confidence: 78,
    dependencies: ["CRM", "Approval policy"],
    linkedProcess: "Service dispatch",
    linkedDecision: "Open decision",
    linkedOutput: "Implementation task 02",
  },
];

const seedActivity = (projectId: string): DeltaActivity[] => [
  {
    id: "ACT-006",
    projectId,
    timestamp: "2026-09-15T08:49:00.000Z",
    actor: "Analysis Agent",
    title: "Recommendation prepared",
    detail: "3 risks and 5 open decisions are ready for human review.",
    type: "agent",
  },
  {
    id: "ACT-005",
    projectId,
    timestamp: "2026-09-15T08:44:00.000Z",
    actor: "Discovery Agent",
    title: "37 requirements structured",
    detail: "Source references and confidence scores were attached to each output.",
    type: "agent",
  },
  {
    id: "ACT-004",
    projectId,
    timestamp: "2026-09-15T08:41:00.000Z",
    actor: "Discovery Agent",
    title: "Source material ingested",
    detail: "Workshop notes and project context are ready for analysis.",
    type: "system",
  },
];

const seedApprovals = (projectId: string): DeltaApproval[] => [
  {
    id: "APR-002",
    projectId,
    title: "Approve image intake as a required service step",
    description:
      "The Analysis Agent recommends making image collection a required step before dispatch.",
    source: "Analysis Agent · 15 Sep 2026",
    status: "pending",
    requestedAt: "2026-09-15T08:49:00.000Z",
    decidedAt: null,
    decisionBy: "Workspace owner",
    comment: "",
  },
  {
    id: "APR-003",
    projectId,
    title: "Confirm CRM ticket creation boundary",
    description:
      "Confirm that DELTA may prepare a ticket but a human must approve the final dispatch.",
    source: "Governance preview · 15 Sep 2026",
    status: "pending",
    requestedAt: "2026-09-15T08:49:00.000Z",
    decidedAt: null,
    decisionBy: "Workspace owner",
    comment: "",
  },
];

const seedTraceability = (projectId: string): DeltaTraceability[] => [
  {
    objective: "Reduce unnecessary service calls",
    source: "Workshop 03",
    requirement: "REQ-024 · Appliance image intake",
    analysis: "Image evidence can resolve common issues before dispatch",
    decision: "APR-002 · Pending human approval",
    task: "PLAN-01 · Configure image intake workflow",
    outcome: "Ready for implementation",
  },
  {
    objective: "Improve after-sales resolution",
    source: "Transcript 02",
    requirement: "REQ-031 · Product knowledge retrieval",
    analysis: "Grounding reduces unsupported recommendations",
    decision: "DEC-003 · Knowledge source policy",
    task: "PLAN-02 · Connect service knowledge",
    outcome: "Ready for implementation",
  },
];

const ensureSeed = async (): Promise<void> => {
  if (!seedPromise) {
    seedPromise = (async () => {
      const existing = await db
        .select({ id: deltaProjectsTable.id })
        .from(deltaProjectsTable)
        .limit(1);
      if (existing.length > 0) return;

      const projectId = "proj-haier";
      await db.insert(deltaProjectsTable).values({
        id: projectId,
        name: "Haier After-Sales AI Transformation",
        description:
          "A focused implementation to reduce unnecessary service calls and improve after-sales resolution.",
        industry: "Consumer Electronics",
        objective:
          "Reduce unnecessary service calls and improve after-sales resolution.",
        status: "active",
        lifecycleStage: "analysis",
        progress: 68,
        requirementsCount: 37,
        openDecisions: 5,
        risks: 3,
        pendingApprovals: 2,
        owner: "Workspace owner",
        discovery: {
          runId: "RUN-009",
          status: "awaiting-review",
          summary:
            "The current service journey is fragmented across customer support, product knowledge, warranty policy, and dispatch tools. DELTA identified a high-confidence opportunity to collect evidence earlier and route only the right cases to technicians.",
          objectives: [
            "Reduce avoidable technician dispatches",
            "Improve first-contact resolution",
            "Make service decisions traceable",
          ],
          stakeholders: [
            "Customer Operations",
            "Service Operations",
            "Product Knowledge",
            "Warranty Team",
          ],
          assumptions: [
            "Customers can provide a usable appliance image",
            "Service bulletins are available to the knowledge layer",
          ],
          openQuestions: [
            "Which image quality threshold should trigger a human review?",
            "Which warranty exceptions need a policy override?",
          ],
          risks: [
            "Incomplete images may increase manual review volume",
            "CRM boundary needs an explicit approval policy",
          ],
          requirementsCreated: 37,
          completedAt: "2026-09-15T08:44:00.000Z",
        },
        requirements: seedRequirements(projectId),
        analysis: {
          id: "ANL-004",
          projectId,
          status: "awaiting-approval",
          requirementsAnalyzed: 37,
          validated: 32,
          ambiguous: 3,
          conflicts: 2,
          missingDependencies: 1,
          risks: [
            "Image quality policy is not explicit",
            "CRM write boundary needs governance approval",
            "Warranty exception routing is underspecified",
          ],
          recommendations: [
            "Make evidence collection an explicit step before dispatch",
            "Keep CRM ticket creation behind a human approval boundary",
            "Resolve warranty exceptions with a governed decision table",
          ],
          openDecisions: [
            "Approve image intake requirement",
            "Confirm CRM ticket creation boundary",
            "Define fallback for low-confidence image analysis",
            "Assign warranty policy owner",
            "Set service-level target for human review",
          ],
          completedAt: "2026-09-15T08:49:00.000Z",
        },
        approvals: seedApprovals(projectId),
        activity: seedActivity(projectId),
        traceability: seedTraceability(projectId),
      });
    })();
  }
  await seedPromise;
};

const getProject = async (projectId: string): Promise<DeltaProject | undefined> => {
  const [project] = await db
    .select()
    .from(deltaProjectsTable)
    .where(eq(deltaProjectsTable.id, projectId))
    .limit(1);
  return project;
};

const toProject = (project: DeltaProject) => ({
  id: project.id,
  name: project.name,
  description: project.description,
  industry: project.industry,
  objective: project.objective,
  status: project.status,
  lifecycleStage: project.lifecycleStage,
  progress: project.progress,
  requirementsCount: project.requirementsCount,
  openDecisions: project.openDecisions,
  risks: project.risks,
  pendingApprovals: project.pendingApprovals,
  updatedAt: project.updatedAt.toISOString(),
});

const toProjectDetail = (project: DeltaProject) => ({
  ...toProject(project),
  owner: project.owner,
  createdAt: project.createdAt.toISOString(),
});

const appendActivity = (
  project: DeltaProject,
  event: Omit<DeltaActivity, "id" | "projectId" | "timestamp">,
): DeltaActivity[] => [
  {
    id: id("ACT"),
    projectId: project.id,
    timestamp: nowIso(),
    ...event,
  },
  ...(project.activity ?? []),
];

const getParams = (value: unknown) =>
  typeof value === "object" && value !== null ? value : {};

router.get("/dashboard", async (_req, res): Promise<void> => {
  await ensureSeed();
  const projects: DeltaProject[] = await db
    .select()
    .from(deltaProjectsTable)
    .orderBy(desc(deltaProjectsTable.updatedAt));
  const activity: DeltaActivity[] = projects
    .flatMap((project: DeltaProject) => project.activity ?? [])
    .sort((a: DeltaActivity, b: DeltaActivity) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 6);
  const response = GetDashboardResponse.parse({
    activeProjects: projects.filter((project: DeltaProject) => project.status === "active").length,
    agentsWorking: 2,
    pendingApprovals: projects.reduce((sum: number, project: DeltaProject) => sum + project.pendingApprovals, 0),
    requirements: projects.reduce((sum: number, project: DeltaProject) => sum + project.requirementsCount, 0),
    risks: projects.reduce((sum: number, project: DeltaProject) => sum + project.risks, 0),
    decisions: projects.reduce((sum: number, project: DeltaProject) => sum + project.openDecisions, 0),
    completionRate: 68,
    recentActivity: activity,
    projects: projects.map(toProject),
  });
  res.json(response);
});

router.get("/projects", async (_req, res): Promise<void> => {
  await ensureSeed();
  const projects: DeltaProject[] = await db.select().from(deltaProjectsTable).orderBy(desc(deltaProjectsTable.updatedAt));
  res.json(ListProjectsResponse.parse(projects.map((project: DeltaProject) => toProject(project))));
});

router.post("/projects", async (req, res): Promise<void> => {
  const parsed = CreateProjectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const projectId = id("proj");
  const [project] = await db
    .insert(deltaProjectsTable)
    .values({
      id: projectId,
      ...parsed.data,
      status: "active",
      lifecycleStage: "discovery",
      progress: 8,
      requirementsCount: 0,
      openDecisions: 0,
      risks: 0,
      pendingApprovals: 0,
      owner: "Workspace owner",
      activity: [
        {
          id: id("ACT"),
          projectId,
          timestamp: nowIso(),
          actor: "Workspace owner",
          title: "Implementation created",
          detail: "Project is ready for discovery input.",
          type: "human",
        },
      ],
      requirements: [],
      approvals: [],
      traceability: [],
    })
    .returning();
  res.status(201).json(CreateProjectResponse.parse(toProject(project)));
});

router.get("/projects/:projectId", async (req, res): Promise<void> => {
  const params = GetProjectParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(GetProjectResponse.parse(toProjectDetail(project)));
});

router.patch("/projects/:projectId", async (req, res): Promise<void> => {
  const params = UpdateProjectParams.safeParse(getParams(req.params));
  const body = UpdateProjectBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : (body.error?.message ?? "Invalid request body") });
    return;
  }
  const [project] = await db
    .update(deltaProjectsTable)
    .set({ ...body.data, updatedAt: new Date() })
    .where(eq(deltaProjectsTable.id, params.data.projectId))
    .returning();
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(UpdateProjectResponse.parse(toProject(project)));
});

router.post("/projects/:projectId/discovery/run", async (req, res): Promise<void> => {
  const params = RunDiscoveryParams.safeParse(getParams(req.params));
  const body = RunDiscoveryBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : (body.error?.message ?? "Invalid request body") });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const result: DeltaDiscovery = {
    runId: id("RUN"),
    status: "awaiting-review",
    summary:
      "DELTA converted the supplied implementation material into a structured discovery baseline. It found a clear service-operations objective, identified the teams involved, and surfaced the decisions that need human ownership.",
    objectives: [
      project.objective,
      "Make implementation evidence traceable from input to outcome",
      "Reduce manual handoffs across service operations",
    ],
    stakeholders: [
      "Customer Operations",
      "Service Operations",
      "Product Knowledge",
      "Warranty Team",
    ],
    assumptions: [
      "The supplied source material represents the current operating model",
      "Human review remains required for policy and CRM boundaries",
    ],
    openQuestions: [
      "Which cases require a mandatory human review?",
      "What service-level target should govern escalations?",
      `What additional evidence should be collected from ${body.data.sourceType ?? "the source material"}?`,
    ],
    risks: [
      "Low-confidence evidence may increase manual review volume",
      "External system actions require a governed approval boundary",
    ],
    requirementsCreated: Math.max(project.requirementsCount, 37),
    completedAt: nowIso(),
  };
  const requirements =
    project.requirements.length > 0 ? project.requirements : seedRequirements(project.id);
  const [updated] = await db
    .update(deltaProjectsTable)
    .set({
      discovery: result,
      requirements,
      requirementsCount: result.requirementsCreated,
      lifecycleStage: "discovery",
      progress: Math.max(project.progress, 34),
      activity: appendActivity(project, {
        actor: "Discovery Agent",
        title: "Discovery run completed",
        detail: `${result.requirementsCreated} structured requirements are ready for review.`,
        type: "agent",
      }),
      updatedAt: new Date(),
    })
    .where(eq(deltaProjectsTable.id, project.id))
    .returning();
  res.json(RunDiscoveryResponse.parse(updated.discovery));
});

router.get("/projects/:projectId/requirements", async (req, res): Promise<void> => {
  const params = ListRequirementsParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(ListRequirementsResponse.parse(project.requirements));
});

router.patch("/requirements/:requirementId", async (req, res): Promise<void> => {
  const params = UpdateRequirementParams.safeParse(getParams(req.params));
  const body = UpdateRequirementBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : (body.error?.message ?? "Invalid request body") });
    return;
  }
  await ensureSeed();
  const projects: DeltaProject[] = await db.select().from(deltaProjectsTable);
  const project = projects.find((item: DeltaProject) =>
    item.requirements.some((requirement: DeltaRequirement) => requirement.id === params.data.requirementId),
  );
  if (!project) {
    res.status(404).json({ error: "Requirement not found" });
    return;
  }
  const requirements = project.requirements.map((requirement: DeltaRequirement) =>
    requirement.id === params.data.requirementId ? { ...requirement, ...body.data } : requirement,
  );
  const [updated] = await db
    .update(deltaProjectsTable)
    .set({ requirements, updatedAt: new Date() })
    .where(eq(deltaProjectsTable.id, project.id))
    .returning();
  const requirement = requirements.find((item: DeltaRequirement) => item.id === params.data.requirementId);
  res.json(UpdateRequirementResponse.parse({ ...requirement, projectId: updated.id }));
});

router.get("/projects/:projectId/analysis", async (req, res): Promise<void> => {
  const params = GetAnalysisParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(
    GetAnalysisResponse.parse(
      project.analysis ?? {
        id: "ANL-PENDING",
        projectId: project.id,
        status: "not-started",
        requirementsAnalyzed: 0,
        validated: 0,
        ambiguous: 0,
        conflicts: 0,
        missingDependencies: 0,
        risks: [],
        recommendations: [],
        openDecisions: [],
        completedAt: "",
      },
    ),
  );
});

router.post("/projects/:projectId/analysis", async (req, res): Promise<void> => {
  const params = RunAnalysisParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const analyzed: DeltaAnalysis = {
    id: id("ANL"),
    projectId: project.id,
    status: "awaiting-approval",
    requirementsAnalyzed: Math.max(project.requirementsCount, 37),
    validated: 32,
    ambiguous: 3,
    conflicts: 2,
    missingDependencies: 1,
    risks: [
      "Image quality policy is not explicit",
      "CRM write boundary needs governance approval",
      "Warranty exception routing is underspecified",
    ],
    recommendations: [
      "Make evidence collection an explicit step before dispatch",
      "Keep CRM ticket creation behind a human approval boundary",
      "Resolve warranty exceptions with a governed decision table",
    ],
    openDecisions: [
      "Approve image intake requirement",
      "Confirm CRM ticket creation boundary",
      "Define fallback for low-confidence image analysis",
      "Assign warranty policy owner",
      "Set service-level target for human review",
    ],
    completedAt: nowIso(),
  };
  const approvals = project.approvals.length > 0 ? project.approvals : seedApprovals(project.id);
  const [updated] = await db
    .update(deltaProjectsTable)
    .set({
      analysis: analyzed,
      approvals,
      lifecycleStage: "analysis",
      progress: 68,
      openDecisions: analyzed.openDecisions.length,
      risks: analyzed.risks.length,
      pendingApprovals: approvals.filter((approval: DeltaApproval) => approval.status === "pending").length,
      activity: appendActivity(project, {
        actor: "Analysis Agent",
        title: "Analysis run completed",
        detail: "Risks, conflicts, dependencies and recommendations are ready for human review.",
        type: "agent",
      }),
      updatedAt: new Date(),
    })
    .where(eq(deltaProjectsTable.id, project.id))
    .returning();
  res.json(RunAnalysisResponse.parse(updated.analysis));
});

router.get("/projects/:projectId/approvals", async (req, res): Promise<void> => {
  const params = ListApprovalsParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(ListApprovalsResponse.parse(project.approvals));
});

router.post("/approvals/:approvalId/decision", async (req, res): Promise<void> => {
  const params = DecideApprovalParams.safeParse(getParams(req.params));
  const body = DecideApprovalBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: !params.success ? params.error.message : (body.error?.message ?? "Invalid request body") });
    return;
  }
  await ensureSeed();
  const projects: DeltaProject[] = await db.select().from(deltaProjectsTable);
  const project = projects.find((item: DeltaProject) =>
    item.approvals.some((approval: DeltaApproval) => approval.id === params.data.approvalId),
  );
  if (!project) {
    res.status(404).json({ error: "Approval not found" });
    return;
  }
  const approvals = project.approvals.map((approval: DeltaApproval) =>
    approval.id === params.data.approvalId
      ? {
          ...approval,
          status: body.data.decision,
          decidedAt: nowIso(),
          comment: body.data.comment ?? "",
        }
      : approval,
  );
  const pendingApprovals = approvals.filter((approval: DeltaApproval) => approval.status === "pending").length;
  const approved = body.data.decision === "approved";
  const [updated] = await db
    .update(deltaProjectsTable)
    .set({
      approvals,
      pendingApprovals,
      lifecycleStage: approved && pendingApprovals === 0 ? "plan" : project.lifecycleStage,
      progress: approved && pendingApprovals === 0 ? 76 : project.progress,
      activity: appendActivity(project, {
        actor: "Workspace owner",
        title: approved ? "Approval recorded" : "Approval decision updated",
        detail: `${body.data.decision.replace("_", " ")} · ${params.data.approvalId}`,
        type: "human",
      }),
      updatedAt: new Date(),
    })
    .where(eq(deltaProjectsTable.id, project.id))
    .returning();
  const approval = updated.approvals.find((item: DeltaApproval) => item.id === params.data.approvalId);
  res.json(DecideApprovalResponse.parse(approval));
});

router.get("/projects/:projectId/implementation-plan", async (req, res): Promise<void> => {
  const params = GetImplementationPlanParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(
    GetImplementationPlanResponse.parse(
      project.plan ?? {
        id: "PLAN-PENDING",
        projectId: project.id,
        status: "not-started",
        summary: "Approve the analysis recommendation to generate an implementation-ready plan.",
        generatedAt: "",
        tasks: [],
      },
    ),
  );
});

router.post("/projects/:projectId/implementation-plan", async (req, res): Promise<void> => {
  const params = GenerateImplementationPlanParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const tasks: DeltaTask[] = [
    {
      id: "PLAN-01",
      title: "Configure evidence intake workflow",
      workstream: "Knowledge integration",
      owner: "Workflow Agent",
      status: "ready",
      priority: "high",
      dependencies: ["REQ-024"],
      sequence: 1,
      linkedRequirements: ["REQ-024", "REQ-031"],
    },
    {
      id: "PLAN-02",
      title: "Connect service knowledge sources",
      workstream: "Knowledge integration",
      owner: "Knowledge Agent",
      status: "blocked",
      priority: "high",
      dependencies: ["PLAN-01"],
      sequence: 2,
      linkedRequirements: ["REQ-031"],
    },
    {
      id: "PLAN-03",
      title: "Define governed CRM ticket boundary",
      workstream: "CRM integration",
      owner: "Governance Agent",
      status: "needs-decision",
      priority: "medium",
      dependencies: ["APR-003"],
      sequence: 3,
      linkedRequirements: ["REQ-037"],
    },
    {
      id: "PLAN-04",
      title: "Prepare user acceptance test scenarios",
      workstream: "Quality preview",
      owner: "Quality Agent",
      status: "roadmap",
      priority: "medium",
      dependencies: ["PLAN-02"],
      sequence: 4,
      linkedRequirements: ["REQ-024", "REQ-031", "REQ-037"],
    },
  ];
  const plan: DeltaPlan = {
    id: id("PLAN"),
    projectId: project.id,
    status: "ready-for-execution",
    summary:
      "A sequenced implementation plan connecting approved requirements to accountable workstreams, dependencies, and the next human decision boundary.",
    generatedAt: nowIso(),
    tasks,
  };
  const [updated] = await db
    .update(deltaProjectsTable)
    .set({
      plan,
      lifecycleStage: "plan",
      progress: 84,
      activity: appendActivity(project, {
        actor: "Planning Agent",
        title: "Implementation plan generated",
        detail: "4 work items are sequenced with dependencies and ownership.",
        type: "agent",
      }),
      updatedAt: new Date(),
    })
    .where(eq(deltaProjectsTable.id, project.id))
    .returning();
  res.json(GenerateImplementationPlanResponse.parse(updated.plan));
});

router.get("/projects/:projectId/activity", async (req, res): Promise<void> => {
  const params = ListActivityParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  const activity = [...project.activity].sort((a: DeltaActivity, b: DeltaActivity) => b.timestamp.localeCompare(a.timestamp));
  res.json(ListActivityResponse.parse(activity));
});

router.get("/projects/:projectId/traceability", async (req, res): Promise<void> => {
  const params = GetTraceabilityParams.safeParse(getParams(req.params));
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  await ensureSeed();
  const project = await getProject(params.data.projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  res.json(GetTraceabilityResponse.parse(project.traceability));
});

export default router;