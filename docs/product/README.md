# Product

DELTA is an AI company building a platform that combines:

- **Knowledge management** — capturing, structuring, and retrieving
  organizational knowledge.
- **Intelligent agent execution** — a provider-independent AI runtime
  (model providers such as NVIDIA and OpenAI-compatible endpoints) that
  executes tasks in the context of that knowledge.
- **Workflow automation** — versioned, auditable workflows that connect
  agents, people, and systems.

## Current scope

The current application implements the core delivery workflow:

1. Create a project.
2. Capture and manage requirements.
3. Run the discovery step to structure the project input.
4. Run analysis against the requirements.
5. Review and decide approvals.
6. Generate an implementation plan with traceability back to requirements.
7. Track all of it on the dashboard (projects, activity, metrics).

The knowledge, agent-runtime, and workflow domains are the next phases; their
earlier prototype implementations are preserved under `packages/_legacy/`
as reference for the upcoming consolidation.
