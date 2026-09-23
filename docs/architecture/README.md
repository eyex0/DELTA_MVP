# DELTA Architecture

DELTA is a multi-tenant Enterprise AI Agent Platform.

## High-Level Architecture

Client
  |
  v
Web Application
  |
  v
API
  |
  +---- Authentication
  |
  +---- Organizations / RBAC
  |
  +---- Agent Runtime
  |
  +---- Knowledge / RAG
  |
  +---- Workflows
  |
  +---- Integrations
  |
  v
Database / Queue / Workers

## Core Principles

- Multi-tenancy
- Server-side authorization
- Database-level isolation
- Provider-independent AI runtime
- Observable agent execution
- Versioned workflows
- Reliable background jobs
- Testable business logic
