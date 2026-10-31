#ifndef SCHEDULING_H
#define SCHEDULING_H

#include <string>
#include <vector>

// A production order modelled as an Operating-System process (PCB).
struct Process {
    int   pid        = 0;   // process / order id
    int   arrival    = 0;   // arrival time
    int   burst      = 0;   // execution (burst) time
    int   priority   = 3;   // 1 = highest priority
    // ----- filled in by the scheduler -----
    int   start      = -1;  // first time the process got the CPU
    int   completion = 0;   // time it finished
    int   turnaround = 0;   // completion - arrival
    int   waiting    = 0;   // turnaround - burst
    int   response   = 0;   // start - arrival
    int   remaining  = 0;   // used by preemptive policies
};

// One continuous slice of CPU time for the Gantt chart.
struct GanttSlice {
    int pid;
    int start;
    int end;
};

// Result of running one scheduling policy.
struct ScheduleResult {
    std::string             algorithm;
    std::vector<Process>    processes;   // in original (pid) order, with metrics filled
    std::vector<GanttSlice> gantt;       // execution timeline
    double avgWaiting    = 0.0;
    double avgTurnaround = 0.0;
    double avgResponse   = 0.0;
    double throughput    = 0.0;          // processes per unit time
    int    makespan      = 0;            // total time from 0 to last completion
};

// algorithm: FCFS | SJF | SRTF | PRIORITY | PRIORITYP | RR
// quantum is used only by RR (ignored otherwise).
ScheduleResult runSchedule(std::vector<Process> procs,
                           const std::string& algorithm,
                           int quantum);

#endif
