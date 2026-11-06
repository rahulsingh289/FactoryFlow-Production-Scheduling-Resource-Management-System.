#include "scheduling/policies.h"
#include "scheduling/ranking.h"

namespace {

// Shortest Job First: of the orders waiting, the one with the shortest total time
// goes first. An order that has started keeps its machine and worker until it ends.
class Sjf : public SchedulingPolicy {
public:
    std::string name() const override { return "SJF"; }
    bool ranksBefore(const Process& a, const Process& b) const override { return byBurstThenArrival(a, b); }
};

}  // namespace

std::unique_ptr<SchedulingPolicy> makeSjfPolicy() { return std::make_unique<Sjf>(); }
