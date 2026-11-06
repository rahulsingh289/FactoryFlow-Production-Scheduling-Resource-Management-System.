#ifndef FACTORY_SCHEDULING_RANKING_H
#define FACTORY_SCHEDULING_RANKING_H

#include "scheduling/types.h"

// Building blocks for deciding which waiting order goes first. Each one is a strict
// order that ends in the same tie-break (earlier arrival, then lower id), so every
// run gives exactly the same schedule.
bool byArrivalThenPid(const Process& a, const Process& b);
bool byBurstThenArrival(const Process& a, const Process& b);       // shortest total time first
bool byRemainingThenArrival(const Process& a, const Process& b);   // least time still to run first
bool byPriorityThenArrival(const Process& a, const Process& b);    // lowest number (1) first

#endif
