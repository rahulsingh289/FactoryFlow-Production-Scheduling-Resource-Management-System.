// MachineAssigner.h
// Member: Karan Singh
// Description: Declares the MachineAssigner class responsible for assigning
//              machines and workers to production steps/processes.
//              When no asset is free it places the process in the WaitQueue.
//              When an asset finishes it notifies WaitQueue to wake up blocked
//              processes — mirrors OS I/O device scheduler behaviour.

#ifndef MACHINE_ASSIGNER_H
#define MACHINE_ASSIGNER_H

#include <vector>
#include <string>
#include <unordered_map>
#include <memory>
#include "PCB.h"
#include "WaitQueue.h"

// ── MachineMeta: runtime state of one physical machine ────────────────────────
struct MachineMeta {
    int         machine_id;
    std::string machine_name;
    std::string machine_type;
    std::string status;          // "IDLE" | "BUSY" | "MAINTENANCE" | "OFFLINE"
    int         current_order_id; // -1 if idle
    int         current_step_id;  // -1 if idle
};

// ── WorkerMeta: runtime state of one worker ───────────────────────────────────
struct WorkerMeta {
    int         worker_id;
    std::string full_name;
    std::string skill_set;       // comma-separated
    std::string shift;
    std::string status;          // "AVAILABLE" | "ASSIGNED" | "ON_LEAVE" | "INACTIVE"
    int         current_order_id; // -1 if available
};

class MachineAssigner {
public:
    explicit MachineAssigner(WaitQueue& waitQueue);

    // ── Machine management ────────────────────────────────────────────────────

    // Register a machine into the assigner (called at startup from DB)
    void registerMachine(const MachineMeta& machine);

    // Attempt to assign an idle machine of the given type to a process/step
    // Returns assigned machine_id, or -1 if none available (process goes to WaitQueue)
    int assignMachine(std::shared_ptr<PCB> process,
                      int step_id,
                      const std::string& required_type);

    // Mark a machine as free and notify WaitQueue
    void releaseMachine(int machine_id);

    // Get all machines with their current status
    std::vector<MachineMeta> getAllMachines() const;

    // Get machines filtered by status
    std::vector<MachineMeta> getMachinesByStatus(const std::string& status) const;

    // Get machines filtered by type
    std::vector<MachineMeta> getMachinesByType(const std::string& type) const;

    // ── Worker management ─────────────────────────────────────────────────────

    // Register a worker into the assigner (called at startup from DB)
    void registerWorker(const WorkerMeta& worker);

    // Attempt to assign an available worker with matching skill to a process/step
    // Returns assigned worker_id, or -1 if none available (process goes to WaitQueue)
    int assignWorker(std::shared_ptr<PCB> process,
                     int step_id,
                     const std::string& required_skill);

    // Mark a worker as available and notify WaitQueue
    void releaseWorker(int worker_id);

    // Get all workers with their current status
    std::vector<WorkerMeta> getAllWorkers() const;

    // Get available workers only
    std::vector<WorkerMeta> getAvailableWorkers() const;

    // Get workers filtered by skill
    std::vector<WorkerMeta> getWorkersBySkill(const std::string& skill) const;

    // ── Status counts (for dashboard summary cards) ───────────────────────────
    int countIdleMachines()      const;
    int countBusyMachines()      const;
    int countAvailableWorkers()  const;
    int countAssignedWorkers()   const;

private:
    WaitQueue& waitQueue_;

    std::unordered_map<int, MachineMeta> machines_;  // machine_id -> MachineMeta
    std::unordered_map<int, WorkerMeta>  workers_;   // worker_id  -> WorkerMeta

    // Internal: find first idle machine of the given type
    int findIdleMachine(const std::string& type) const;

    // Internal: find first available worker with the required skill
    int findAvailableWorker(const std::string& skill) const;
};

#endif // MACHINE_ASSIGNER_H
