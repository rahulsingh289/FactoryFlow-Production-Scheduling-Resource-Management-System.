#include "scheduling.h"

#include <algorithm>
#include <deque>
#include <limits>
#include <map>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

enum class Policy { FCFS, SJF, SRTF, PRIORITY, PRIORITYP, RR };

static bool machineFits(const Machine& m, const Process& p) {
    return p.machineType == -1 || p.machineType == m.type;
}

// A worker can run a machine if they are trained for its type, or for any.
static bool workerFits(const Worker& w, const Machine& m) {
    return w.type == -1 || w.type == m.type;
}

// Merge consecutive slices of the same order on the same machine and worker so
// the timeline stays compact, then order the result by start time.
static std::vector<GanttSlice> compress(const std::vector<GanttSlice>& raw) {
    std::vector<GanttSlice> out;
    std::map<int, size_t> lastOfPid;
    for (const auto& s : raw) {
        auto it = lastOfPid.find(s.pid);
        if (it != lastOfPid.end()) {
            GanttSlice& last = out[it->second];
            if (last.end == s.start && last.machine == s.machine && last.worker == s.worker) {
                last.end = s.end;
                continue;
            }
        }
        lastOfPid[s.pid] = out.size();
        out.push_back(s);
    }
    std::stable_sort(out.begin(), out.end(), [](const GanttSlice& a, const GanttSlice& b) {
        if (a.start != b.start) return a.start < b.start;
        return a.pid < b.pid;
    });
    return out;
}

// Fill turnaround / waiting / response and the summary metrics once every
// process has a completion time and a start time recorded.
static void finalize(ScheduleResult& r) {
    double sumW = 0, sumT = 0, sumR = 0;
    int maxCompletion = 0;
    for (auto& p : r.processes) {
        p.turnaround = p.completion - p.arrival;
        p.waiting    = p.turnaround - p.burst;
        p.response   = p.start - p.arrival;
        sumW += p.waiting;
        sumT += p.turnaround;
        sumR += p.response;
        maxCompletion = std::max(maxCompletion, p.completion);
    }
    int n = static_cast<int>(r.processes.size());
    if (n > 0) {
        r.avgWaiting    = sumW / n;
        r.avgTurnaround = sumT / n;
        r.avgResponse   = sumR / n;
        r.makespan      = maxCompletion;
        r.throughput    = maxCompletion > 0 ? static_cast<double>(n) / maxCompletion : 0.0;
    }
    r.gantt = compress(r.gantt);
}

// Which ready order goes first. Ties fall back to arrival, then pid, so every
// run is deterministic.
static bool ranksBefore(const Process& a, const Process& b, Policy policy) {
    if (policy == Policy::SJF && a.burst != b.burst) return a.burst < b.burst;
    if (policy == Policy::SRTF && a.remaining != b.remaining) return a.remaining < b.remaining;
    if ((policy == Policy::PRIORITY || policy == Policy::PRIORITYP) && a.priority != b.priority)
        return a.priority < b.priority;
    if (a.arrival != b.arrival) return a.arrival < b.arrival;
    return a.pid < b.pid;
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------
// Every policy shares one event-driven loop; the clock only moves to the next
// completion, arrival or quantum expiry. At each event:
//   1. newly arrived orders join the ready set,
//   2. preemptive policies give back the machines and workers they hold,
//   3. ready orders claim free resources in policy order.
// An order that can't get a machine or worker just waits, while a lower-ranked
// order needing a different machine type may still go ahead of it.

struct Running {
    int idx;          // index into procs
    int machine;      // index into machines
    int worker;       // index into workers
    int quantumLeft;  // used by RR only
};

static ScheduleResult simulate(std::vector<Process> procs, const std::vector<Machine>& machines,
                               const std::vector<Worker>& workers, Policy policy,
                               const std::string& name, int quantum) {
    ScheduleResult r;
    r.algorithm = name;

    // Orders that could never run would wait forever, so report them instead.
    std::vector<Process> runnable;
    for (const auto& p : procs) {
        bool hasMachine = false, hasStaffedMachine = false;
        for (const auto& m : machines) {
            if (m.capacity <= 0 || !machineFits(m, p)) continue;
            hasMachine = true;
            for (const auto& w : workers)
                if (workerFits(w, m)) { hasStaffedMachine = true; break; }
        }
        if (p.burst <= 0)             r.unschedulable.push_back({p.pid, "INVALID_BURST"});
        else if (!hasMachine)         r.unschedulable.push_back({p.pid, "NO_MACHINE"});
        else if (!hasStaffedMachine)  r.unschedulable.push_back({p.pid, "NO_WORKER"});
        else {
            runnable.push_back(p);
            runnable.back().remaining = p.burst;
        }
    }
    procs = runnable;

    const int n = static_cast<int>(procs.size());
    if (quantum < 1) quantum = 1;

    // Orders in arrival order, so arrivals can be admitted with a moving index.
    std::vector<int> byArrival(n);
    for (int i = 0; i < n; i++) byArrival[i] = i;
    std::sort(byArrival.begin(), byArrival.end(), [&](int a, int b) {
        if (procs[a].arrival != procs[b].arrival) return procs[a].arrival < procs[b].arrival;
        return procs[a].pid < procs[b].pid;
    });

    std::vector<int> machineUsed(machines.size(), 0);
    std::vector<bool> workerBusy(workers.size(), false);
    std::vector<Running> running;
    std::deque<int> ready;  // RR keeps this in queue order; other policies sort it

    int clock = 0, completed = 0, nextArrival = 0;

    // The worker for a machine: the one the order last had if they still fit,
    // then someone trained for exactly this machine type, then a worker who can
    // run any machine (kept for last so specialists are used first).
    auto pickWorker = [&](const Process& p, int machine) {
        const Machine& mc = machines[machine];
        if (p.lastWorker >= 0 && !workerBusy[p.lastWorker] && workerFits(workers[p.lastWorker], mc))
            return p.lastWorker;
        for (size_t w = 0; w < workers.size(); w++)
            if (!workerBusy[w] && workers[w].type == mc.type) return static_cast<int>(w);
        for (size_t w = 0; w < workers.size(); w++)
            if (!workerBusy[w] && workers[w].type == -1) return static_cast<int>(w);
        return -1;
    };

    // Claim a machine slot and a worker who can run it, preferring the machine
    // the order last used. Takes nothing unless both are free.
    auto tryAssign = [&](int i) {
        Process& p = procs[i];
        std::vector<int> candidates;
        if (p.lastMachine >= 0) candidates.push_back(p.lastMachine);
        for (size_t m = 0; m < machines.size(); m++)
            if (static_cast<int>(m) != p.lastMachine) candidates.push_back(static_cast<int>(m));

        for (int machine : candidates) {
            if (!machineFits(machines[machine], p) || machineUsed[machine] >= machines[machine].capacity) continue;
            int worker = pickWorker(p, machine);
            if (worker < 0) continue;

            machineUsed[machine]++;
            workerBusy[worker] = true;
            p.lastMachine = machine;
            p.lastWorker  = worker;
            if (p.start == -1) p.start = clock;
            running.push_back({i, machine, worker, quantum});
            return true;
        }
        return false;
    };

    auto release = [&](const Running& run) {
        machineUsed[run.machine]--;
        workerBusy[run.worker] = false;
    };

    while (completed < n) {
        // 1. Admit arrivals. For RR this happens before an expired order rejoins
        //    the queue, the textbook Round Robin order.
        while (nextArrival < n && procs[byArrival[nextArrival]].arrival <= clock)
            ready.push_back(byArrival[nextArrival++]);

        // 2. Preemption gives resources back so they can be claimed in rank order.
        std::vector<Running> stillRunning;
        for (const auto& run : running) {
            bool preempt = policy == Policy::SRTF || policy == Policy::PRIORITYP ||
                           (policy == Policy::RR && run.quantumLeft == 0);
            if (preempt) {
                release(run);
                ready.push_back(run.idx);
            } else {
                stillRunning.push_back(run);
            }
        }
        running = stillRunning;

        // 3. Dispatch.
        if (policy != Policy::RR) {
            std::sort(ready.begin(), ready.end(), [&](int a, int b) {
                return ranksBefore(procs[a], procs[b], policy);
            });
        }
        std::deque<int> waiting;
        for (int i : ready)
            if (!tryAssign(i)) waiting.push_back(i);
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
            if (policy == Policy::RR) delta = std::min(delta, run.quantumLeft);
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
                release(run);
                completed++;
            } else {
                stillRunning.push_back(run);
            }
        }
        running = stillRunning;
        clock += delta;
    }

    r.processes = procs;
    finalize(r);
    return r;
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------
ScheduleResult runSchedule(std::vector<Process> procs, const std::vector<Machine>& machines,
                           const std::vector<Worker>& workers, const std::string& algorithm,
                           int quantum) {
    Policy policy = Policy::FCFS;
    std::string name = "FCFS";  // unknown policies fall back to FCFS
    if (algorithm == "SJF")            { policy = Policy::SJF;       name = algorithm; }
    else if (algorithm == "SRTF")      { policy = Policy::SRTF;      name = algorithm; }
    else if (algorithm == "PRIORITY")  { policy = Policy::PRIORITY;  name = algorithm; }
    else if (algorithm == "PRIORITYP") { policy = Policy::PRIORITYP; name = algorithm; }
    else if (algorithm == "RR")        { policy = Policy::RR;        name = algorithm; }
    return simulate(std::move(procs), machines, workers, policy, name, quantum);
}
