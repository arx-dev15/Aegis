📁 Final architecture

Something approximately like:

aegis/
│
├── apps/
│   ├── web/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── lib/
│   │
│   └── api/
│       ├── routes/
│       ├── controllers/
│       ├── middleware/
│       └── server.ts
│
├── agents/
│   ├── planner/
│   ├── researcher/
│   ├── architect/
│   ├── developer/
│   ├── reviewer/
│   ├── tester/
│   └── security/
│
├── graph/
│   ├── state.ts
│   ├── nodes/
│   ├── edges/
│   └── workflow.ts
│
├── tools/
│   ├── filesystem/
│   ├── github/
│   ├── search/
│   ├── terminal/
│   ├── database/
│   └── browser/
│
├── rag/
│   ├── loaders/
│   ├── chunkers/
│   ├── embeddings/
│   ├── retriever/
│   └── vector-store/
│
├── memory/
│   ├── short-term/
│   └── long-term/
│
├── models/
│   ├── gemini/
│   └── embeddings/
│
├── evaluation/
│   ├── datasets/
│   ├── evaluators/
│   └── benchmarks/
│
├── observability/
│
├── database/
│
├── shared/
│   ├── types/
│   ├── utils/
│   └── config/
│
├── docker/
│
└── package.json