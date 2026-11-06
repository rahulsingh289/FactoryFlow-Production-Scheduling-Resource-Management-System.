#include "scheduling/policies.h"
#include "scheduling/ranking.h"

namespace {

// Shortest Remaining Time First: the preemptive form of SJF. At every event the
// orders are ranked again by the time they still need, so a newly arrived short
// order can take a machine from a long one that is part way through.
class Srtf : public SchedulingPolicy {
public:
    std::string name() const override { return "SRTF"; }
    bool ranksBefore(const Process& a, const Process& b) const override { return byRemainingThenArrival(a, b); }
    bool preempts(const Process&, int) const override { return true; }
};

}  // namespace

std::unique_ptr<SchedulingPolicy> makeSrtfPolicy() { return std::make_unique<Srtf>(); }
