#ifndef FACTORY_SCHEDULING_RESOURCES_H
#define FACTORY_SCHEDULING_RESOURCES_H

#include <vector>

#include "scheduling/types.h"

// Can this machine run this order? (Right machine type, or the order accepts any.)
bool machineFits(const Machine& machine, const Process& process);

// Can this worker run this machine? (Trained for its type, or trained for any.)
bool workerFits(const Worker& worker, const Machine& machine);

// Keeps track of which machine slots and workers are in use while a schedule is being
// simulated. It knows nothing about algorithms: it only answers "can this order get a
// machine and a worker right now, and which ones?".
class ResourcePool {
public:
    ResourcePool(const std::vector<Machine>& machines, const std::vector<Worker>& workers);

    // Claims one machine slot and one worker for `process`, preferring the machine and
    // worker it used last. Takes nothing and returns false unless both are free. On
    // success, `machine` and `worker` are indexes into the vectors given to the constructor.
    bool tryClaim(Process& process, int& machine, int& worker);

    // Gives a machine slot and a worker back.
    void release(int machine, int worker);

private:
    int pickWorker(const Process& process, int machine) const;

    const std::vector<Machine>& machines_;
    const std::vector<Worker>&  workers_;
    std::vector<int>            machineUsed_;   // slots in use on each machine
    std::vector<bool>           workerBusy_;
};

#endif
