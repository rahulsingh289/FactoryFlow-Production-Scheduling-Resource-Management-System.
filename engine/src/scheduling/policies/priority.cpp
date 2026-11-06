#include "scheduling/policies.h"
#include "scheduling/ranking.h"

namespace {

// Priority scheduling, non-preemptive: of the orders waiting, the one with the
// lowest priority number (1 = most urgent) goes first, and runs until it ends.
class Priority : public SchedulingPolicy {
public:
    std::string name() const override { return "PRIORITY"; }
    bool ranksBefore(const Process& a, const Process& b) const override { return byPriorityThenArrival(a, b); }
};

}  // namespace

std::unique_ptr<SchedulingPolicy> makePriorityPolicy() { return std::make_unique<Priority>(); }
