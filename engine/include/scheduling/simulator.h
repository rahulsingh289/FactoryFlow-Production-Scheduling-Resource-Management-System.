#ifndef FACTORY_SCHEDULING_SIMULATOR_H
#define FACTORY_SCHEDULING_SIMULATOR_H

#include <string>
#include <vector>

#include "scheduling/types.h"

// Runs one scheduling algorithm over the orders and returns the timeline and the results.
//
// algorithm: FCFS | SJF | SRTF | PRIORITY | PRIORITYP | RR   (unknown names give FCFS)
// quantum:   used only by Round Robin
//
// Machines and workers are limited resources. An order only runs while it holds one
// machine slot of its required type and one worker trained for that machine type, so
// several orders can run in parallel but never more than the factory can staff and equip.
ScheduleResult runSchedule(std::vector<Process> orders,
                           const std::vector<Machine>& machines,
                           const std::vector<Worker>& workers,
                           const std::string& algorithm,
                           int quantum);

#endif
