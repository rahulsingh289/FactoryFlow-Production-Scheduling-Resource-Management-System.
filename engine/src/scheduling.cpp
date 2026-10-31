#include "scheduling.h"

#include <algorithm>
#include <limits>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Merge consecutive Gantt slices that belong to the same process so the
// timeline stays compact (e.g. Round Robin can produce many 1-tick slices).
static std::vector<GanttSlice> compress(const std::vector<GanttSlice>& raw) {
    std::vector<GanttSlice> out;
    for (const auto& s : raw) {
        if (!out.empty() && out.back().pid == s.pid && out.back().end == s.start) {
            out.back().end = s.end;
        } else {
            out.push_back(s);
        }
    }
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
        if (p.waiting < 0) p.waiting = 0;
        p.response   = p.start - p.arrival;
        if (p.response < 0) p.response = 0;
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

// ---------------------------------------------------------------------------
// Non-preemptive policies (FCFS, SJF, PRIORITY)
// ---------------------------------------------------------------------------
// They share the same skeleton: at each decision point pick the "best" ready
// process according to a comparator, run it to completion, advance the clock.

enum class Pick { FCFS, SJF, PRIORITY };

static ScheduleResult runNonPreemptive(std::vector<Process> procs, Pick pick,
                                        const std::string& name) {
    ScheduleResult r;
    r.algorithm = name;
    int n = static_cast<int>(procs.size());
    std::vector<bool> done(n, false);
    int completed = 0;
    int clock = 0;

    while (completed < n) {
        int chosen = -1;
        for (int i = 0; i < n; i++) {
            if (done[i] || procs[i].arrival > clock) continue;
            if (chosen == -1) { chosen = i; continue; }
            bool better = false;
            if (pick == Pick::FCFS) {
                better = procs[i].arrival < procs[chosen].arrival;
            } else if (pick == Pick::SJF) {
                better = procs[i].burst < procs[chosen].burst;
            } else { // PRIORITY (lower number = higher priority)
                better = procs[i].priority < procs[chosen].priority;
            }
            // Tie-breakers: earlier arrival, then lower pid (stable, deterministic).
            if (!better) {
                bool tie = false;
                if (pick == Pick::SJF)      tie = procs[i].burst == procs[chosen].burst;
                else if (pick == Pick::PRIORITY) tie = procs[i].priority == procs[chosen].priority;
                if (tie) {
                    if (procs[i].arrival != procs[chosen].arrival)
                        better = procs[i].arrival < procs[chosen].arrival;
                    else
                        better = procs[i].pid < procs[chosen].pid;
                }
            }
            if (better) chosen = i;
        }

        if (chosen == -1) {
            // CPU is idle until the next arrival.
            int next = std::numeric_limits<int>::max();
            for (int i = 0; i < n; i++)
                if (!done[i]) next = std::min(next, procs[i].arrival);
            clock = std::max(clock, next);
            continue;
        }

        Process& p = procs[chosen];
        p.start = clock;
        r.gantt.push_back({p.pid, clock, clock + p.burst});
        clock += p.burst;
        p.completion = clock;
        done[chosen] = true;
        completed++;
    }

    r.processes = procs;
    finalize(r);
    return r;
}

// ---------------------------------------------------------------------------
// SRTF  — preemptive Shortest Remaining Time First
// ---------------------------------------------------------------------------
static ScheduleResult runSRTF(std::vector<Process> procs) {
    ScheduleResult r;
    r.algorithm = "SRTF";
    int n = static_cast<int>(procs.size());
    for (auto& p : procs) p.remaining = p.burst;
    int completed = 0, clock = 0;

    while (completed < n) {
        int chosen = -1;
        for (int i = 0; i < n; i++) {
            if (procs[i].remaining <= 0 || procs[i].arrival > clock) continue;
            if (chosen == -1 ||
                procs[i].remaining < procs[chosen].remaining ||
                (procs[i].remaining == procs[chosen].remaining &&
                 procs[i].arrival < procs[chosen].arrival))
                chosen = i;
        }
        if (chosen == -1) { clock++; continue; }

        Process& p = procs[chosen];
        if (p.start == -1) p.start = clock;
        r.gantt.push_back({p.pid, clock, clock + 1}); // 1-tick slice, compressed later
        p.remaining--;
        clock++;
        if (p.remaining == 0) { p.completion = clock; completed++; }
    }

    r.processes = procs;
    finalize(r);
    return r;
}

// ---------------------------------------------------------------------------
// PRIORITYP  — preemptive Priority (lower number = higher priority)
// ---------------------------------------------------------------------------
static ScheduleResult runPriorityPreemptive(std::vector<Process> procs) {
    ScheduleResult r;
    r.algorithm = "PRIORITYP";
    int n = static_cast<int>(procs.size());
    for (auto& p : procs) p.remaining = p.burst;
    int completed = 0, clock = 0;

    while (completed < n) {
        int chosen = -1;
        for (int i = 0; i < n; i++) {
            if (procs[i].remaining <= 0 || procs[i].arrival > clock) continue;
            if (chosen == -1 ||
                procs[i].priority < procs[chosen].priority ||
                (procs[i].priority == procs[chosen].priority &&
                 procs[i].arrival < procs[chosen].arrival))
                chosen = i;
        }
        if (chosen == -1) { clock++; continue; }

        Process& p = procs[chosen];
        if (p.start == -1) p.start = clock;
        r.gantt.push_back({p.pid, clock, clock + 1});
        p.remaining--;
        clock++;
        if (p.remaining == 0) { p.completion = clock; completed++; }
    }

    r.processes = procs;
    finalize(r);
    return r;
}

// ---------------------------------------------------------------------------
// RR  — Round Robin with a fixed time quantum
// ---------------------------------------------------------------------------
static ScheduleResult runRR(std::vector<Process> procs, int quantum) {
    ScheduleResult r;
    r.algorithm = "RR";
    if (quantum < 1) quantum = 1;
    int n = static_cast<int>(procs.size());
    for (auto& p : procs) p.remaining = p.burst;

    // Process arrivals in time order so the ready queue is built correctly.
    std::vector<int> order(n);
    for (int i = 0; i < n; i++) order[i] = i;
    std::sort(order.begin(), order.end(), [&](int a, int b) {
        if (procs[a].arrival != procs[b].arrival) return procs[a].arrival < procs[b].arrival;
        return procs[a].pid < procs[b].pid;
    });

    std::vector<int> queue;
    std::vector<bool> inQueue(n, false);
    int completed = 0, clock = 0, idx = 0;

    auto enqueueArrivals = [&](int upto) {
        while (idx < n && procs[order[idx]].arrival <= upto) {
            int i = order[idx];
            if (!inQueue[i] && procs[i].remaining > 0) { queue.push_back(i); inQueue[i] = true; }
            idx++;
        }
    };

    enqueueArrivals(clock);
    while (completed < n) {
        if (queue.empty()) { // idle: jump to next arrival
            if (idx < n) { clock = std::max(clock, procs[order[idx]].arrival); enqueueArrivals(clock); continue; }
            break;
        }
        int i = queue.front();
        queue.erase(queue.begin());
        inQueue[i] = false;

        Process& p = procs[i];
        if (p.start == -1) p.start = clock;
        int slice = std::min(quantum, p.remaining);
        r.gantt.push_back({p.pid, clock, clock + slice});
        clock += slice;
        p.remaining -= slice;

        enqueueArrivals(clock);            // admit anything that arrived during the slice
        if (p.remaining > 0) {             // not finished -> back of the queue
            queue.push_back(i);
            inQueue[i] = true;
        } else {
            p.completion = clock;
            completed++;
        }
    }

    r.processes = procs;
    finalize(r);
    return r;
}

// ---------------------------------------------------------------------------
// Public dispatcher
// ---------------------------------------------------------------------------
ScheduleResult runSchedule(std::vector<Process> procs, const std::string& algorithm,
                           int quantum) {
    if (algorithm == "FCFS")      return runNonPreemptive(procs, Pick::FCFS,     "FCFS");
    if (algorithm == "SJF")       return runNonPreemptive(procs, Pick::SJF,      "SJF");
    if (algorithm == "PRIORITY")  return runNonPreemptive(procs, Pick::PRIORITY, "PRIORITY");
    if (algorithm == "SRTF")      return runSRTF(procs);
    if (algorithm == "PRIORITYP") return runPriorityPreemptive(procs);
    if (algorithm == "RR")        return runRR(procs, quantum);
    // Unknown policy falls back to FCFS so the API never crashes.
    return runNonPreemptive(procs, Pick::FCFS, "FCFS");
}
