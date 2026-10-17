# C++ scheduling engine
This module is the first working backend milestone. It is a standalone C++17 program, not yet an HTTP server.

Compile from project root:
`g++ -std=c++17 -Ibackend/include backend/src/main.cpp backend/src/scheduler.cpp -o scheduler`

Scheduling policies:
- FCFS: increasing arrival time, stable for ties.
- SJF: shortest execution time first, stable for ties.
- Priority: lower numeric priority value means more urgent; ties use arrival time.
All policies are non-preemptive and assume the scheduler can run one order at a time. Resource requirements are displayed but capacity-aware blocking is not yet part of scheduling.
