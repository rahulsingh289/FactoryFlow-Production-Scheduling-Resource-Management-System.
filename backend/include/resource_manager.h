#ifndef RESOURCE_MANAGER_H
#define RESOURCE_MANAGER_H

#include "scheduler.h"
#include <string>
#include <vector>

void runResourceAllocation(
    const std::vector<ProductionOrder>& orders,
    const std::string& algorithm
);

#endif