#ifndef FACTORY_SCHEDULING_METRICS_H
#define FACTORY_SCHEDULING_METRICS_H

#include <vector>

#include "scheduling/types.h"

// Merges consecutive slices of the same order on the same machine and worker, so the
// timeline stays compact, and orders the result by start time.
std::vector<GanttSlice> compressGantt(const std::vector<GanttSlice>& raw);

// Fills in turnaround, waiting and response time for every order and the summary
// numbers (averages, throughput, makespan), once each order has a start and a
// completion time. Also compresses the Gantt timeline.
void finalizeMetrics(ScheduleResult& result);

#endif
