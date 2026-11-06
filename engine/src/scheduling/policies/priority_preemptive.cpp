#include "scheduling/policies.h"
#include "scheduling/ranking.h"

namespace {

// Priority scheduling, preemptive: ranked like Priority, but at every event the
// running orders hand back their machines, so a more urgent order that arrives
// takes over immediately.
class PreemptivePriority : public SchedulingPolicy {
public:
    std::string name() const override { return "PRIORITYP"; }
    bool ranksBefore(const Process& a, const Process& b) const override { return byPriorityThenArrival(a, b); }
    bool preempts(const Process&, int) const override { return true; }
};

}  // namespace

std::unique_ptr<SchedulingPolicy> makePreemptivePriorityPolicy() { return std::make_unique<PreemptivePriority>(); }
