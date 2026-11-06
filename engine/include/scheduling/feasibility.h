#ifndef FACTORY_SCHEDULING_FEASIBILITY_H
#define FACTORY_SCHEDULING_FEASIBILITY_H

#include <vector>

#include "scheduling/types.h"

// Splits the orders into those that can run at some point and those that never can
// (they would wait for ever), and says why for each of the second kind:
//   INVALID_BURST - no execution time
//   NO_MACHINE    - no machine of the type it needs
//   NO_WORKER     - nobody is trained to run the machines it could use
void splitRunnable(const std::vector<Process>& orders,
                   const std::vector<Machine>& machines,
                   const std::vector<Worker>& workers,
                   std::vector<Process>& runnable,
                   std::vector<Unschedulable>& unschedulable);

#endif
