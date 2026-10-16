// PCB.h
// Member: Aman Singh Rawat
// Description: Process Control Block — the core data structure that represents
//              a single production order as an OS-like process.
//              Every field mirrors what an OS PCB holds.

#ifndef PCB_H
#define PCB_H

#include <string>
#include <vector>
#include <chrono>
#include "ProcessState.h"

// ResourceRequirement: describes one resource type and how many units are needed
struct ResourceRequirement {
    int    resource_id;       // FK to resources table
    int    units_required;    // number of units needed
    int    units_allocated;   // number of units currently allocated (0 at start)
};

// PCB — Process Control Block for one production order
struct PCB {
    // --- Identity ---
    int         process_id;       // maps to production_orders.order_id
    std::string order_name;       // human-readable name
    std::string product_name;     // product being manufactured

    // --- Scheduling fields ---
    int         priority;         // 1 = highest priority, 10 = lowest
    int         execution_time;   // total estimated execution time (minutes)
    int         remaining_time;   // remaining execution time (used in preemptive SJF)
    int         burst_time;       // original burst/execution time copy (for SJF sort)
    int         waiting_time;     // total time spent in READY/WAITING state
    int         turnaround_time;  // completion_time - arrival_time

    // --- Timestamps ---
    std::chrono::system_clock::time_point arrival_time;    // when order was created
    std::chrono::system_clock::time_point deadline;        // must complete by
    std::chrono::system_clock::time_point start_time;      // when execution began
    std::chrono::system_clock::time_point completion_time; // when execution finished

    // --- State ---
    ProcessState state;           // current OS process state

    // --- Resources ---
    std::vector<ResourceRequirement> resources; // list of needed resources

    // --- Ownership ---
    int created_by;               // user_id of the factory manager who created it

    // --- Constructor: initialise a new PCB with minimum required fields ---
    PCB(int pid, const std::string& name, const std::string& product,
        int prio, int exec_time, int user_id)
        : process_id(pid),
          order_name(name),
          product_name(product),
          priority(prio),
          execution_time(exec_time),
          remaining_time(exec_time),
          burst_time(exec_time),
          waiting_time(0),
          turnaround_time(0),
          state(ProcessState::NEW),
          created_by(user_id)
    {}
};

#endif // PCB_H
