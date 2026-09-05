# Aegis Workspace Directory Architecture

> **Job**: *Where things live*

This document provides the complete, exhaustive file-by-file directory layout of the **Aegis** codebase (`d:\Rakshith\Code Playback\Aegis`).

---

```text
Aegis/
│
├── 📄 AGENT_BUILD_CONTEXT.md          # Current implementation & feature history (Features 01–27)
├── 📄 Agent_Flow.md                   # How agents & workflows interact
├── 📄 Architecture.md                 # How AEGIS is architected
├── 📄 Build_plan.md                   # Original sequential build strategy
├── 📄 Directory-architecture.md       # Where things live (Workspace layout)
├── 📄 Implementation_Plan.md          # Technical implementation details
├── 📄 Must_build.md                   # Non-negotiable product requirements
├── 📄 Next_builds.md                  # Immediate upcoming work (Builds 28–33)
├── 📄 PR.md                           # PR & verification procedure
├── 📄 README.md                       # What AEGIS is (Public entrypoint)
├── 📄 cli.ts                          # End-user interactive CLI (connect, status, search, impact)
├── 📄 demoGithub.ts                   # Interactive GitHub ingestion demo runner
├── 📄 inspectRepo.ts                  # Workspace structure analysis script
├── 📄 runDemo.ts                      # Multi-agent workflow demo script
├── 📄 testAll.ts                      # Master test runner (Runs all 25 test suites for Features 01–26)
├── 📄 testLiveGithub.ts               # Live GitHub API integration test
├── 📄 tsconfig.json                   # TypeScript compiler configuration
├── 📄 tsconfig.agentic.json           # Agentic compiler settings
├── 📄 package.json                    # Node.js dependencies & scripts
├── 📄 package-lock.json               # Dependency lockfile
├── 📄 .env                            # Environment variables (API keys, ports, DB secrets)
├── 📄 .env.example                    # Environment variable template
│
├── 📁 agents/                         # Core Autonomous AI Agent System
│   ├── 📄 agent.ts                    # Base agent abstraction, LLM binding, & structured output logic
│   ├── 📄 index.ts                    # Agent exporter registry
│   ├── 📄 test.ts                     # Base agent test suite
│   ├── 📁 planner/                    # Planner Agent (Task Decomposition)
│   │   ├── 📄 index.ts                # Entrypoint
│   │   ├── 📄 planner.ts              # Implementation
│   │   ├── 📄 prompt.ts               # System prompts
│   │   ├── 📄 schema.ts               # Output Zod schema
│   │   ├── 📄 test.ts                 # Agent unit test
│   │   └── 📄 types.ts                # Type definitions
│   ├── 📁 researcher/                 # Researcher Agent (Codebase & Doc Analysis)
│   │   ├── 📄 index.ts
│   │   ├── 📄 prompt.ts
│   │   ├── 📄 researcher.ts
│   │   ├── 📄 schema.ts
│   │   ├── 📄 test.ts
│   │   └── 📄 types.ts
│   ├── 📁 architect/                  # Architect Agent (System & API Design)
│   │   ├── 📄 architect.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 prompt.ts
│   │   ├── 📄 schema.ts
│   │   ├── 📄 test.ts
│   │   └── 📄 types.ts
│   ├── 📁 developer/                  # Developer Agent (Code Implementation)
│   │   ├── 📄 developer.ts
│   │   ├── 📄 index.ts
│   │   ├── 📄 prompt.ts
│   │   ├── 📄 schema.ts
│   │   ├── 📄 test.ts
│   │   └── 📄 types.ts
│   ├── 📁 tester/                     # Tester Agent (Test Suite Generation)
│   │   ├── 📄 index.ts
│   │   ├── 📄 prompt.ts
│   │   ├── 📄 schema.ts
│   │   ├── 📄 test.ts
│   │   ├── 📄 tester.ts
│   │   └── 📄 types.ts
│   ├── 📁 reviewer/                   # Reviewer Agent (Code Quality & Diff Review)
│   │   ├── 📄 index.ts
│   │   ├── 📄 prompt.ts
│   │   ├── 📄 reviewer.ts
│   │   ├── 📄 schema.ts
│   │   ├── 📄 test.ts
│   │   └── 📄 types.ts
│   └── 📁 security/                   # Security Agent (Vulnerability & Token Guard)
│       ├── 📄 index.ts
│       ├── 📄 prompt.ts
│       ├── 📄 schema.ts
│       ├── 📄 security.ts
│       ├── 📄 test.ts
│       └── 📄 types.ts
│
├── 📁 repo-intelligence/              # Repository Intelligence Engine (Feature 26)
│   ├── 📄 index.ts                    # Main module export
│   ├── 📄 types.ts                    # Data models (FileRecord, SymbolRecord, EvidenceRecord, etc.)
│   ├── 📄 repoIntelligence.test.ts    # Comprehensive test suite for Feature 26
│   ├── 📁 connection/                 # Access Validation & Remote Ingestion
│   │   ├── 📄 connectionManager.ts    # Validate local paths & remote GitHub repository access
│   │   └── 📄 remoteIngestion.ts      # Temporary workspace cloning & archive ingestion
│   ├── 📁 scanner/                    # File Tree Scanner & Classification
│   │   ├── 📄 classifier.ts           # File type & language category classifier
│   │   ├── 📄 fileScanner.ts          # File tree walker & .gitignore ignore rule parser
│   │   └── 📄 security.ts            # Hardcoded secret & credential redaction
│   ├── 📁 parsers/                    # AST Symbol Parsers
│   │   └── 📄 tsParser.ts             # TypeScript/JavaScript symbol parser (ts-morph)
│   ├── 📁 extractors/                 # Domain Feature Extractors
│   │   ├── 📄 apiExtractor.ts         # Express & Next.js API route extractor
│   │   ├── 📄 databaseExtractor.ts    # SQL tables & Prisma database model extractor
│   │   ├── 📄 dependencyExtractor.ts  # Package dependency & import extractor
│   │   ├── 📄 importExportExtractor.ts# Module import/export relationship extractor
│   │   └── 📄 testExtractor.ts        # Test file & test suite extractor
│   ├── 📁 git/                        # Git Intelligence Engine
│   │   └── 📄 gitAnalyzer.ts          # Commit history & author blameline analyzer
│   ├── 📁 relationships/              # Provenanced Code Graph
│   │   └── 📄 graphEngine.ts          # Typed relationship edge generator (CALLS, IMPORTS, etc.)
│   ├── 📁 storage/                    # Persistence Adapters
│   │   ├── 📄 jsonStore.ts            # File-backed JSON repository snapshot store
│   │   └── 📄 pgStore.ts              # PostgreSQL persistence adapter
│   ├── 📁 retrieval/                  # Retrieval Engine & Dynamic Impact Analysis
│   │   └── 📄 hybridRetriever.ts      # Hybrid graph search + semantic vector RAG & impact report
│   └── 📁 incremental/                # Incremental Re-Analysis
│       └── 📄 reanalyzer.ts           # Re-indexes changed files on git diff deltas
│
├── 📁 graph/                          # LangGraph Workflow Engine & Handoff Routing
│   ├── 📄 state.ts                    # Global agentic state definition
│   ├── 📄 index.ts                    # Workflow exporter
│   ├── 📄 approvalTypes.ts            # Human-in-the-loop approval definitions
│   ├── 📄 approvalWorkflow.ts         # Human-in-the-loop decision workflow
│   ├── 📄 approvalWorkflow.test.ts    # Approval workflow test
│   ├── 📄 plannerWorkflow.ts          # Planner agent workflow sub-graph
│   ├── 📄 plannerWorkflow.test.ts     # Planner workflow test
│   ├── 📄 researcherWorkflow.ts       # Researcher agent workflow sub-graph
│   ├── 📄 researcherWorkflow.test.ts  # Researcher workflow test
│   ├── 📄 architectWorkflow.ts        # Architect agent workflow sub-graph
│   ├── 📄 architectWorkflow.test.ts   # Architect workflow test
│   ├── 📄 developerWorkflow.ts        # Developer coding loop workflow sub-graph
│   ├── 📄 developerWorkflow.test.ts   # Developer workflow test
│   ├── 📄 testerWorkflow.ts           # Tester workflow sub-graph
│   ├── 📄 testerWorkflow.test.ts      # Tester workflow test
│   ├── 📄 reviewerWorkflow.ts         # Reviewer workflow sub-graph
│   ├── 📄 reviewerWorkflow.test.ts    # Reviewer workflow test
│   ├── 📄 securityWorkflow.ts         # Security workflow sub-graph
│   ├── 📄 securityWorkflow.test.ts    # Security workflow test
│   ├── 📄 multiAgentWorkflow.ts       # Full end-to-end multi-agent orchestration
│   ├── 📄 multiAgentWorkflow.test.ts  # Multi-agent workflow test
│   ├── 📄 dynamicRoutingWorkflow.ts   # Dynamic handoff & adaptive routing
│   ├── 📄 dynamicRoutingWorkflow.test.ts # Routing test suite
│   ├── 📄 failureRecovery.test.ts     # Resilient retry & failure recovery test suite
│   └── 📁 edges/                      # Routing Graph Edges
│       ├── 📄 agentRouter.ts          # Agent handoff router logic
│       └── 📄 agentRouter.test.ts     # Router test suite
│
├── 📁 rag/                            # RAG Pipeline & Project Knowledge Base (Features 19 & 20)
│   ├── 📄 index.ts                    # RAG exports
│   ├── 📄 pipeline.ts                 # Central RAG Pipeline coordinator
│   ├── 📄 projectKnowledge.ts         # High-level project knowledge ingestion & context enhancer
│   ├── 📄 projectKnowledge.test.ts    # Project knowledge test suite
│   ├── 📄 rag.test.ts                 # RAG pipeline test suite
│   ├── 📄 types.ts                    # RAG data types
│   ├── 📁 loaders/                    # Document Loaders
│   │   ├── 📄 fileLoader.ts           # Directory & file loader
│   │   └── 📄 textLoader.ts           # Plain text loader
│   ├── 📁 splitters/                  # Code & Document Splitters
│   │   ├── 📄 codeSplitter.ts         # AST-aware code block splitter
│   │   └── 📄 textSplitter.ts         # Recursive character text splitter
│   ├── 📁 embeddings/                 # Embeddings Providers
│   │   └── 📄 mockEmbeddings.ts       # Deterministic embedding provider
│   ├── 📁 vector-store/               # Vector Indexes
│   │   └── 📄 memoryVectorStore.ts    # In-memory cosine similarity vector index
│   └── 📁 retriever/                  # Similarity Retriever
│       └── 📄 vectorRetriever.ts      # Vector search retriever
│
├── 📁 memory/                         # Epistemic Agent Memory System (Features 21 & 22)
│   ├── 📄 index.ts                    # Memory system exporter
│   ├── 📄 memoryManager.ts            # Dual short-term & long-term memory coordinator
│   ├── 📄 memory.test.ts              # Memory test suite
│   ├── 📄 types.ts                    # Memory item interfaces
│   ├── 📁 short-term/                 # Working Conversation Memory
│   │   └── 📄 shortTermMemory.ts      # Sliding window conversation buffer
│   └── 📁 long-term/                  # Persistent Epistemic Memory
│       └── 📄 longTermMemory.ts       # Structured key-value long-term memory store
│
├── 📁 tools/                          # Aegis Agent Tool Ecosystem & Guardrails
│   ├── 📄 index.ts                    # Tools registry exporter
│   ├── 📄 types.ts                    # Tool schema definitions
│   ├── 📁 guardrails/                 # Execution Permissions & Safety Guardrails
│   │   ├── 📄 guardrails.ts           # Command validation, path restrictions, & permissions
│   │   └── 📄 guardrails.test.ts      # Guardrails test suite
│   ├── 📁 github/                     # GitHub REST Integration Tools (Feature 25)
│   │   ├── 📄 githubTools.ts          # PR creation, issue fetching, branch management tools
│   │   └── 📄 github.test.ts          # GitHub tools test suite
│   └── 📁 repoIntelligence/           # Repository Explorer Tool
│       └── 📄 repoExplorerTool.ts     # Agent tool for querying codebase symbols & impact
│
├── 📁 apps/                           # Application Entrypoints & Endpoints
│   ├── 📁 api/                        # Express HTTP & WebSocket Backend Server
│   │   ├── 📄 server.ts               # HTTP & WebSocket server entrypoint (Port 3000/4000)
│   │   ├── 📄 db.ts                   # PostgreSQL client pool & in-memory database fallback
│   │   ├── 📄 config.ts               # Environment configuration loader
│   │   ├── 📄 seed.ts                 # Demo seed data loader
│   │   ├── 📄 ws.ts                   # Real-time WebSocket connection handler
│   │   ├── 📄 migrate.ts              # Automatic SQL migration runner
│   │   ├── 📁 controllers/            # API Route Controllers
│   │   │   ├── 📄 repoIntelligence.ts # Repository Intelligence API controller
│   │   │   ├── 📄 approvals.ts        # Human-in-the-loop approvals controller
│   │   │   ├── 📄 runs.ts             # Agent run execution controller
│   │   │   └── 📄 files.ts            # File management controller
│   │   ├── 📁 routes/                 # Express API Routes
│   │   │   ├── 📄 index.ts            # Primary route aggregator
│   │   │   ├── 📄 repoIntelligence.ts # Repository Intelligence API endpoints
│   │   │   ├── 📄 approvals.ts        # Approvals API endpoints
│   │   │   └── 📄 runs.ts             # Agent runs endpoints
│   │   └── 📁 middleware/             # Middleware
│   │       ├── 📄 errorHandler.ts     # Error handling middleware
│   │       └── 📄 validate.ts         # Zod schema validation middleware
│   └── 📁 web/                        # React / Next.js Web User Dashboard
│       ├── 📄 package.json
│       └── 📁 src/                    # Frontend source components & pages
│
└── 📁 database/                       # PostgreSQL Migrations & Database Pool
    ├── 📄 pool.ts                     # Database connection pool manager
    └── 📁 migrations/                 # SQL Migration Files
        ├── 📄 001_initial.sql         # Initial tables (runs, logs, approvals)
        └── 📄 002_repo_intelligence.sql # Repository Intelligence tables (snapshots, symbols, edges)
```