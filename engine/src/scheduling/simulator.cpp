#include "scheduling/simulator.h"

#include <algorithm>
#include <deque>
#include <limits>

#include "scheduling/feasibility.h"
#include "scheduling/metrics.h"
#include "scheduling/policy.h"
#include "scheduling/resources.h"

// Every algorithm shares this one event-driven loop; the clock only moves to the next
// completion, arrival or quantum expiry. At each event:
//   1. newly arrived orders join the ready set,
//   2. the policy may make running orders give back their machines and workers,
//   3. ready orders claim free resources, in the order the policy ranks them.
// An order that can't get a machine or worker just waits, while a lower-ranked order
// needing a different machine type may still go ahead of it.

namespace {

struct Running {
    int idx;          // index into the orders
    int machine;      // index into machines
    int worker;       // index into workers
    int quantumLeft;  // used by time-sliced policies only
};

}  // namespace

ScheduleResult runSchedule(std::vector<Process> orders,
                           const std::vector<Machine>& machines,
                           const std::vector<Worker>& workers,
                           const std::string& algorithm,
                           int quantum) {
    std::unique_ptr<SchedulingPolicy> policy = makePolicy(algorithm);

    ScheduleResult r;
    r.algorithm = policy->name();

    // Orders that could never run would wait for ever, so they are reported instead.
    std::vector<Process> procs;
    splitRunnable(orders, machines, workers, procs, r.unschedulable);

    const int n = static_cast<int>(procs.size());
    if (quantum < 1) quantum = 1;

    // Orders in arrival order, so arrivals can be admitted with a moving index.
    std::vector<int> byArrival(n);
    for (int i = 0; i < n; i++) byArrival[i] = i;
    std::sort(byArrival.begin(), byArrival.end(), [&](int a, int b) {
        if (procs[a].arrival != procs[b].arrival) return procs[a].arrival < procs[b].arrival;
        return procs[a].pid < procs[b].pid;
    });

    ResourcePool pool(machines, workers);
    std::vector<Running> running;
    std::deque<int> ready;  // time-sliced policies keep this in queue order; the others rank it

    int clock = 0, completed = 0, nextArrival = 0;

    while (completed < n) {
        // 1. Admit arrivals. For Round Robin this happens before an expired order rejoins
        //    the queue, the textbook order.
        while (nextArrival < n && procs[byArrival[nextArrival]].arrival <= clock)
            ready.push_back(byArrival[nextArrival++]);

        // 2. Preemption gives resources back so they can be claimed in rank order.
        std::vector<Running> stillRunning;
        for (const auto& run : running) {
            if (policy->preempts(procs[run.idx], run.quantumLeft)) {
                pool.release(run.machine, run.worker);
                ready.push_back(run.idx);
            } else {
                stillRunning.push_back(run);
            }
        }
        running = stillRunning;

        // 3. Dispatch.
        if (!policy->usesQuantum()) {
            std::sort(ready.begin(), ready.end(), [&](int a, int b) {
                return policy->ranksBefore(procs[a], procs[b]);
            });
        }
        std::deque<int> waiting;
        for (int i : ready) {
            int machine = -1, worker = -1;
            if (!pool.tryClaim(procs[i], machine, worker)) {
                waiting.push_back(i);
                continue;
            }
            if (procs[i].start == -1) procs[i].start = clock;
            running.push_back({i, machine, worker, quantum});
        }
        ready = waiting;

        // Nothing running means every remaining order arrives later.
        if (running.empty()) {
            clock = procs[byArrival[nextArrival]].arrival;
            continue;
        }

        // 4. Advance to the next event.
        int delta = std::numeric_limits<int>::max();
        for (const auto& run : running) {
            delta = std::min(delta, procs[run.idx].remaining);
            if (policy->usesQuantum()) delta = std::min(delta, run.quantumLeft);
        }
        if (nextArrival < n) delta = std::min(delta, procs[byArrival[nextArrival]].arrival - clock);

        stillRunning.clear();
        for (auto run : running) {
            Process& p = procs[run.idx];
            r.gantt.push_back({p.pid, clock, clock + delta, machines[run.machine].id, workers[run.worker].id});
            p.remaining -= delta;
            run.quantumLeft -= delta;
            if (p.remaining == 0) {
                p.completion = clock + delta;
                pool.release(run.machine, run.worker);
                completed++;
            } else {
                stillRunning.push_back(run);
            }
        }
        running = stillRunning;
        clock += delta;
    }

    r.processes = procs;
    finalizeMetrics(r);
    return r;
}
