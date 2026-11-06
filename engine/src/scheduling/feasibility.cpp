#include "scheduling/feasibility.h"

#include "scheduling/resources.h"

void splitRunnable(const std::vector<Process>& orders,
                   const std::vector<Machine>& machines,
                   const std::vector<Worker>& workers,
                   std::vector<Process>& runnable,
                   std::vector<Unschedulable>& unschedulable) {
    for (const auto& p : orders) {
        bool hasMachine = false, hasStaffedMachine = false;
        for (const auto& m : machines) {
            if (m.capacity <= 0 || !machineFits(m, p)) continue;
            hasMachine = true;
            for (const auto& w : workers)
                if (workerFits(w, m)) { hasStaffedMachine = true; break; }
        }
        if (p.burst <= 0)             unschedulable.push_back({p.pid, "INVALID_BURST"});
        else if (!hasMachine)         unschedulable.push_back({p.pid, "NO_MACHINE"});
        else if (!hasStaffedMachine)  unschedulable.push_back({p.pid, "NO_WORKER"});
        else {
            runnable.push_back(p);
            runnable.back().remaining = p.burst;
        }
    }
}
