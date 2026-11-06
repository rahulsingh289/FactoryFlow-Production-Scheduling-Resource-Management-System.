#ifndef FACTORY_SCHEDULING_POLICIES_H
#define FACTORY_SCHEDULING_POLICIES_H

#include <memory>

#include "scheduling/policy.h"

// One constructor function per algorithm; each lives in its own file in src/scheduling/policies/.
std::unique_ptr<SchedulingPolicy> makeFcfsPolicy();                 // First Come First Served
std::unique_ptr<SchedulingPolicy> makeSjfPolicy();                  // Shortest Job First
std::unique_ptr<SchedulingPolicy> makeSrtfPolicy();                 // Shortest Remaining Time First (preemptive)
std::unique_ptr<SchedulingPolicy> makePriorityPolicy();             // Priority, non-preemptive
std::unique_ptr<SchedulingPolicy> makePreemptivePriorityPolicy();   // Priority, preemptive
std::unique_ptr<SchedulingPolicy> makeRoundRobinPolicy();           // Round Robin

#endif
