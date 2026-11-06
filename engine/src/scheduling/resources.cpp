#include "scheduling/resources.h"

bool machineFits(const Machine& machine, const Process& process) {
    return process.machineType == -1 || process.machineType == machine.type;
}

bool workerFits(const Worker& worker, const Machine& machine) {
    return worker.type == -1 || worker.type == machine.type;
}

ResourcePool::ResourcePool(const std::vector<Machine>& machines, const std::vector<Worker>& workers)
    : machines_(machines), workers_(workers), machineUsed_(machines.size(), 0), workerBusy_(workers.size(), false) {}

// The worker for a machine: the one the order last had if they still fit, then someone
// trained for exactly this machine type, then a worker who can run any machine (kept
// for last so specialists are used first).
int ResourcePool::pickWorker(const Process& process, int machine) const {
    const Machine& mc = machines_[machine];
    if (process.lastWorker >= 0 && !workerBusy_[process.lastWorker] && workerFits(workers_[process.lastWorker], mc))
        return process.lastWorker;
    for (size_t w = 0; w < workers_.size(); w++)
        if (!workerBusy_[w] && workers_[w].type == mc.type) return static_cast<int>(w);
    for (size_t w = 0; w < workers_.size(); w++)
        if (!workerBusy_[w] && workers_[w].type == -1) return static_cast<int>(w);
    return -1;
}

bool ResourcePool::tryClaim(Process& process, int& machine, int& worker) {
    std::vector<int> candidates;
    if (process.lastMachine >= 0) candidates.push_back(process.lastMachine);
    for (size_t m = 0; m < machines_.size(); m++)
        if (static_cast<int>(m) != process.lastMachine) candidates.push_back(static_cast<int>(m));

    for (int candidate : candidates) {
        if (!machineFits(machines_[candidate], process) || machineUsed_[candidate] >= machines_[candidate].capacity) continue;
        int chosen = pickWorker(process, candidate);
        if (chosen < 0) continue;

        machineUsed_[candidate]++;
        workerBusy_[chosen] = true;
        process.lastMachine = candidate;
        process.lastWorker  = chosen;
        machine = candidate;
        worker  = chosen;
        return true;
    }
    return false;
}

void ResourcePool::release(int machine, int worker) {
    machineUsed_[machine]--;
    workerBusy_[worker] = false;
}
