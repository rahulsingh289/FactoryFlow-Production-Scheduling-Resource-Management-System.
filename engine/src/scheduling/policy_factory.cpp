#include "scheduling/policies.h"

// The list of known algorithms. To add one: write its class in scheduling/policies/,
// declare its constructor in policies.h, and add a line here.
std::unique_ptr<SchedulingPolicy> makePolicy(const std::string& algorithm) {
    struct Entry {
        const char* name;
        std::unique_ptr<SchedulingPolicy> (*make)();
    };
    static const Entry known[] = {
        {"FCFS", makeFcfsPolicy},
        {"SJF", makeSjfPolicy},
        {"SRTF", makeSrtfPolicy},
        {"PRIORITY", makePriorityPolicy},
        {"PRIORITYP", makePreemptivePriorityPolicy},
        {"RR", makeRoundRobinPolicy},
    };
    for (const Entry& entry : known) {
        if (algorithm == entry.name) return entry.make();
    }
    return makeFcfsPolicy();  // unknown names fall back to FCFS
}
