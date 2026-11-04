#ifndef SCHEDULING_H
#define SCHEDULING_H

#include <string>
#include <vector>

// A production order modelled as an Operating-System process (PCB).
struct Process {
    int   pid         = 0;   // process / order id
    int   arrival     = 0;   // arrival time
    int   burst       = 0;   // execution (burst) time
    int   priority    = 3;   // 1 = highest priority
    int   machineType = -1;  // required machine type id, -1 = any machine
    // ----- filled in by the scheduler -----
    int   start       = -1;  // first time the process got a machine and worker
    int   completion  = 0;   // time it finished
    int   turnaround  = 0;   // completion - arrival
    int   waiting     = 0;   // turnaround - burst
    int   response    = 0;   // start - arrival
    int   remaining   = 0;   // burst time still to run
    int   lastMachine = -1;  // index of the machine it last ran on
    int   lastWorker  = -1;  // index of the worker it last ran with
};

// A worker. `type` is the machine type the worker is trained on, or -1 for a
// worker who can run any machine.
struct Worker {
    int id   = 0;
    int type = -1;
};

// A physical machine: runs up to `capacity` orders at the same time.
struct Machine {
    int id       = 0;
    int capacity = 1;
    int type     = 0;
};

// One continuous slice of execution for the Gantt chart.
struct GanttSlice {
    int pid;
    int start;
    int end;
    int machine;  // machine id
    int worker;   // worker id
};

// An order that can never run with the current machines and workers.
struct Unschedulable {
    int         pid;
    std::string reason;  // NO_MACHINE | NO_WORKER | INVALID_BURST
};

// Result of running one scheduling policy.
struct ScheduleResult {
    std::string                algorithm;
    std::vector<Process>       processes;      // scheduled orders, with metrics filled
    std::vector<GanttSlice>    gantt;          // execution timeline, ordered by start
    std::vector<Unschedulable> unschedulable;  // orders left out of the timeline
    double avgWaiting    = 0.0;
    double avgTurnaround = 0.0;
    double avgResponse   = 0.0;
    double throughput    = 0.0;                // processes per unit time
    int    makespan      = 0;                  // total time from 0 to last completion
};

// algorithm: FCFS | SJF | SRTF | PRIORITY | PRIORITYP | RR
// quantum is used only by RR (ignored otherwise).
//
// Machines and workers are limited resources. An order only runs while it holds
// one machine slot of its required type and one worker trained for that machine
// type, so several orders can run in parallel but never more than the factory
// can staff and equip.
ScheduleResult runSchedule(std::vector<Process> procs,
                           const std::vector<Machine>& machines,
                           const std::vector<Worker>& workers,
                           const std::string& algorithm,
                           int quantum);

#endif
