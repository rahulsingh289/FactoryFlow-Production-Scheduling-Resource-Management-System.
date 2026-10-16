// Scheduler.h
// Member: Aman Singh Rawat
// Description: Declares the Scheduler class that holds the ready queue and
//              implements FCFS, SJF, and Priority Scheduling algorithms.
//              20% foundation — queue management + algorithm selection interface.

#ifndef SCHEDULER_H
#define SCHEDULER_H

#include <queue>
#include <vector>
#include <memory>
#include <string>
#include "PCB.h"

// Enum for choosing which scheduling algorithm to run
enum class SchedulingAlgorithm {
    FCFS,      // First Come First Served — ordered by arrival_time
    SJF,       // Shortest Job First — ordered by execution_time (burst_time)
    PRIORITY   // Priority Scheduling — ordered by priority value (1 = highest)
};

// Comparator for SJF — shortest burst time first
struct SJFComparator {
    bool operator()(const std::shared_ptr<PCB>& a, const std::shared_ptr<PCB>& b) const;
};

// Comparator for Priority Scheduling — lowest priority number = highest urgency
struct PriorityComparator {
    bool operator()(const std::shared_ptr<PCB>& a, const std::shared_ptr<PCB>& b) const;
};

class Scheduler {
public:
    explicit Scheduler(SchedulingAlgorithm algo = SchedulingAlgorithm::FCFS);

    // Add a new process to the ready queue
    void addProcess(std::shared_ptr<PCB> process);

    // Pick and return the next process to execute (does NOT remove from queue)
    std::shared_ptr<PCB> peekNext() const;

    // Pick and remove the next process to execute
    std::shared_ptr<PCB> dispatchNext();

    // Change the scheduling algorithm at runtime (triggers re-sort)
    void setAlgorithm(SchedulingAlgorithm algo);

    // Get current algorithm in use
    SchedulingAlgorithm getAlgorithm() const;

    // Get algorithm name as string (for API responses)
    std::string getAlgorithmName() const;

    // Return number of processes currently in the ready queue
    int queueSize() const;

    // Check if the ready queue is empty
    bool isEmpty() const;

    // Get a snapshot of the entire ready queue (for dashboard display)
    std::vector<std::shared_ptr<PCB>> getQueueSnapshot() const;

    // Calculate and update waiting_time and turnaround_time for all processes
    void calculateMetrics();

private:
    SchedulingAlgorithm                  algorithm_;
    std::vector<std::shared_ptr<PCB>>    readyQueue_;   // backing store (sorted on dispatch)

    // Internal: sort readyQueue_ based on current algorithm
    void sortQueue();
};

#endif // SCHEDULER_H
