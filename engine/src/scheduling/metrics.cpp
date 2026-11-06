#include "scheduling/metrics.h"

#include <algorithm>
#include <map>

std::vector<GanttSlice> compressGantt(const std::vector<GanttSlice>& raw) {
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

void finalizeMetrics(ScheduleResult& r) {
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
    r.gantt = compressGantt(r.gantt);
}
