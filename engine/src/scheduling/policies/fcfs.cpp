#include "scheduling/policies.h"
#include "scheduling/ranking.h"

namespace {

// First Come First Served: the order that arrived first goes first. Never preempts.
class Fcfs : public SchedulingPolicy {
public:
    std::string name() const override { return "FCFS"; }
    bool ranksBefore(const Process& a, const Process& b) const override { return byArrivalThenPid(a, b); }
};

}  // namespace

std::unique_ptr<SchedulingPolicy> makeFcfsPolicy() { return std::make_unique<Fcfs>(); }
