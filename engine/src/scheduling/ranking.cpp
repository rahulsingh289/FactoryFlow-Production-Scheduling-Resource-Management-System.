#include "scheduling/ranking.h"

bool byArrivalThenPid(const Process& a, const Process& b) {
    if (a.arrival != b.arrival) return a.arrival < b.arrival;
    return a.pid < b.pid;
}

bool byBurstThenArrival(const Process& a, const Process& b) {
    if (a.burst != b.burst) return a.burst < b.burst;
    return byArrivalThenPid(a, b);
}

bool byRemainingThenArrival(const Process& a, const Process& b) {
    if (a.remaining != b.remaining) return a.remaining < b.remaining;
    return byArrivalThenPid(a, b);
}

bool byPriorityThenArrival(const Process& a, const Process& b) {
    if (a.priority != b.priority) return a.priority < b.priority;
    return byArrivalThenPid(a, b);
}
