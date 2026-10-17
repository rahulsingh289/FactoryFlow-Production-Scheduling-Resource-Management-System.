# Implementation status — honest 50% checkpoint

| Proposal component | Status | Evidence |
|---|---|---|
| Process/order model | Implemented (basic) | `backend/include/scheduler.h` |
| FCFS | Implemented | `backend/src/scheduler.cpp` |
| SJF | Implemented, non-preemptive | `backend/src/scheduler.cpp` |
| Priority scheduling | Implemented, 1 = highest | `backend/src/scheduler.cpp` |
| Basic schedule metrics | Implemented | start, finish, wait, deadline flag |
| React dashboard | Prototype | `frontend/src/main.jsx` |
| Add order and search | Implemented in frontend state | Dashboard interactions |
| MySQL relational design | Schema drafted | `database/schema.sql` |
| Seed data | Provided | `database/seed.sql` |
| C++ REST API | Not yet implemented | Next milestone |
| C++ ↔ MySQL connection | Not yet implemented | Next milestone |
| Banker's algorithm | Not yet implemented | Next milestone |
| Deadlock detection | Not yet implemented | Next milestone |
| Authentication | Not yet implemented | Next milestone |
| Resource synchronization / locking | Not yet implemented | Next milestone |
| Automated tests | Not yet implemented | Next milestone |

Important: the frontend schedule is a demonstration approximation. The C++ engine sorts according to the chosen policy; neither currently implements a complete ready-queue simulation with dynamic arrivals and resource-aware dispatch. SJF/Priority ordering is simplified for the first milestone.
