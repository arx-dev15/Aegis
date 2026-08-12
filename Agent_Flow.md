                    USER
                      │
                      ▼
              ┌──────────────┐
              │   ORCHESTRATOR │
              │   LangGraph    │
              └───────┬──────┘
                      │
                      ▼
                ┌───────────┐
                │  PLANNER  │
                │   Agent   │
                └─────┬─────┘
                      │
                 creates plan
                      │
                      ▼
              ┌───────────────┐
              │   RESEARCHER  │
              │     Agent     │
              └───────┬───────┘
                      │
                research/context
                      │
                      ▼
              ┌───────────────┐
              │   ARCHITECT   │
              │     Agent     │
              └───────┬───────┘
                      │
                 architecture
                      │
                      ▼
              ┌───────────────┐
              │   DEVELOPER   │
              │     Agent     │
              └───────┬───────┘
                      │
                    code
                      │
                      ▼
              ┌───────────────┐
              │    TESTER     │
              │     Agent     │
              └───────┬───────┘
                      │
                 tests pass?
                  /       \
                NO         YES
                │           │
                ▼           ▼
           DEVELOPER     REVIEWER
                ▲           │
                └───────────┘
                            │
                            ▼
                    HUMAN APPROVAL
                            │
                            ▼
                          DONE


🔥 The Agent Loop

Every agent basically follows this pattern:

┌───────────────┐
│     INPUT     │
└───────┬───────┘
        ↓
      LLM
        ↓
   Need a tool?
    /       \
  YES        NO
   ↓          ↓
 TOOL       OUTPUT
   ↓
 RESULT
   │
   └──────→ LLM

That's the fundamental agentic loop we're going to understand deeply.