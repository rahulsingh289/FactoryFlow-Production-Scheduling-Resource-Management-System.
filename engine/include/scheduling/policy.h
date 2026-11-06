#ifndef FACTORY_SCHEDULING_POLICY_H
#define FACTORY_SCHEDULING_POLICY_H

#include <memory>
#include <string>

#include "scheduling/types.h"

// A scheduling algorithm. The simulator owns the clock, the machines and the workers;
// a policy only answers the questions that make algorithms differ. To add an algorithm,
// write one class that implements this (see scheduling/policies/) and add one line to
// the table in policy_factory.cpp. Nothing else changes.
class SchedulingPolicy {
public:
    virtual ~SchedulingPolicy() = default;

    // The name the backend uses: FCFS, SJF, ...
    virtual std::string name() const = 0;

    // Does waiting order `a` go before waiting order `b`?
    virtual bool ranksBefore(const Process& a, const Process& b) const = 0;

    // At each event, must this running order hand back its machine and worker, so that
    // everything waiting can be ranked again? (Preemptive policies say yes.)
    virtual bool preempts(const Process& running, int quantumLeft) const {
        (void)running;
        (void)quantumLeft;
        return false;
    }

    // Time-sliced policies (Round Robin): waiting orders stay in queue order instead of
    // being ranked, and every run is limited to the time quantum.
    virtual bool usesQuantum() const { return false; }
};

// "FCFS" | "SJF" | "SRTF" | "PRIORITY" | "PRIORITYP" | "RR". An unknown name gives FCFS.
std::unique_ptr<SchedulingPolicy> makePolicy(const std::string& algorithm);

#endif
