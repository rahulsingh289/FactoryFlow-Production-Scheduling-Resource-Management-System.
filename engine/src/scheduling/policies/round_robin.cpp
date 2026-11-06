#include "scheduling/policies.h"
#include "scheduling/ranking.h"

namespace {

// Round Robin: waiting orders form a queue, and each run lasts at most one time
// quantum. When the quantum is used up the order goes to the back of the queue.
class RoundRobin : public SchedulingPolicy {
public:
    std::string name() const override { return "RR"; }
    // The queue keeps its own order, so ranking is never used; this is only a safe default.
    bool ranksBefore(const Process& a, const Process& b) const override { return byArrivalThenPid(a, b); }
    bool preempts(const Process&, int quantumLeft) const override { return quantumLeft == 0; }
    bool usesQuantum() const override { return true; }
};

}  // namespace

std::unique_ptr<SchedulingPolicy> makeRoundRobinPolicy() { return std::make_unique<RoundRobin>(); }
