// MachineAssigner.cpp
// Member: Karan Singh
// Description: Implementation of MachineAssigner.
//              Assigns machines and workers to processes, manages their
//              runtime status, and integrates with WaitQueue for blocking
//              processes when assets are unavailable.

#include "../../include/MachineAssigner.h"
#include <algorithm>
#include <sstream>

// ── Constructor ───────────────────────────────────────────────────────────────
MachineAssigner::MachineAssigner(WaitQueue& waitQueue)
    : waitQueue_(waitQueue) {}

// ── Machine registration ──────────────────────────────────────────────────────
void MachineAssigner::registerMachine(const MachineMeta& machine) {
    machines_[machine.machine_id] = machine;
}

// ── assignMachine ─────────────────────────────────────────────────────────────
int MachineAssigner::assignMachine(std::shared_ptr<PCB> process,
                                    int step_id,
                                    const std::string& required_type)
{
    int machine_id = findIdleMachine(required_type);

    if (machine_id == -1) {
        // No machine available — block the process
        // Use a synthetic resource_id: machine type mapped to resource pool
        // For now, use -1 as a placeholder resource_id for "any machine of this type"
        waitQueue_.enqueue(process, -1, "MACHINE", 1);
        return -1;
    }

    // Mark machine as BUSY
    machines_[machine_id].status           = "BUSY";
    machines_[machine_id].current_order_id = process->process_id;
    machines_[machine_id].current_step_id  = step_id;

    return machine_id;
}

// ── releaseMachine ────────────────────────────────────────────────────────────
void MachineAssigner::releaseMachine(int machine_id) {
    auto it = machines_.find(machine_id);
    if (it == machines_.end()) return;

    std::string machine_type = it->second.machine_type;
    it->second.status           = "IDLE";
    it->second.current_order_id = -1;
    it->second.current_step_id  = -1;

    // Wake up any processes waiting for this machine type
    // We pass the machine_id as the resource_id notification
    auto woken = waitQueue_.notifyResourceFree(machine_id, 1);
    // Woken processes are now in READY state — Scheduler will pick them up
}

// ── getAllMachines ────────────────────────────────────────────────────────────
std::vector<MachineMeta> MachineAssigner::getAllMachines() const {
    std::vector<MachineMeta> result;
    result.reserve(machines_.size());
    for (const auto& [id, m] : machines_) result.push_back(m);
    return result;
}

std::vector<MachineMeta> MachineAssigner::getMachinesByStatus(
    const std::string& status) const
{
    std::vector<MachineMeta> result;
    for (const auto& [id, m] : machines_) {
        if (m.status == status) result.push_back(m);
    }
    return result;
}

std::vector<MachineMeta> MachineAssigner::getMachinesByType(
    const std::string& type) const
{
    std::vector<MachineMeta> result;
    for (const auto& [id, m] : machines_) {
        if (m.machine_type == type) result.push_back(m);
    }
    return result;
}

// ── Worker registration ───────────────────────────────────────────────────────
void MachineAssigner::registerWorker(const WorkerMeta& worker) {
    workers_[worker.worker_id] = worker;
}

// ── assignWorker ──────────────────────────────────────────────────────────────
int MachineAssigner::assignWorker(std::shared_ptr<PCB> process,
                                   int step_id,
                                   const std::string& required_skill)
{
    int worker_id = findAvailableWorker(required_skill);

    if (worker_id == -1) {
        // No worker available — block the process
        waitQueue_.enqueue(process, -2, "WORKER", 1);
        return -1;
    }

    // Mark worker as ASSIGNED
    workers_[worker_id].status           = "ASSIGNED";
    workers_[worker_id].current_order_id = process->process_id;

    return worker_id;
}

// ── releaseWorker ─────────────────────────────────────────────────────────────
void MachineAssigner::releaseWorker(int worker_id) {
    auto it = workers_.find(worker_id);
    if (it == workers_.end()) return;

    it->second.status           = "AVAILABLE";
    it->second.current_order_id = -1;

    // Wake up processes waiting for a worker
    waitQueue_.notifyResourceFree(worker_id, 1);
}

// ── getAllWorkers / getAvailableWorkers / getWorkersBySkill ────────────────────
std::vector<WorkerMeta> MachineAssigner::getAllWorkers() const {
    std::vector<WorkerMeta> result;
    result.reserve(workers_.size());
    for (const auto& [id, w] : workers_) result.push_back(w);
    return result;
}

std::vector<WorkerMeta> MachineAssigner::getAvailableWorkers() const {
    std::vector<WorkerMeta> result;
    for (const auto& [id, w] : workers_) {
        if (w.status == "AVAILABLE") result.push_back(w);
    }
    return result;
}

std::vector<WorkerMeta> MachineAssigner::getWorkersBySkill(
    const std::string& skill) const
{
    std::vector<WorkerMeta> result;
    for (const auto& [id, w] : workers_) {
        if (w.skill_set.find(skill) != std::string::npos) {
            result.push_back(w);
        }
    }
    return result;
}

// ── Status counts ─────────────────────────────────────────────────────────────
int MachineAssigner::countIdleMachines() const {
    int count = 0;
    for (const auto& [id, m] : machines_)
        if (m.status == "IDLE") ++count;
    return count;
}

int MachineAssigner::countBusyMachines() const {
    int count = 0;
    for (const auto& [id, m] : machines_)
        if (m.status == "BUSY") ++count;
    return count;
}

int MachineAssigner::countAvailableWorkers() const {
    int count = 0;
    for (const auto& [id, w] : workers_)
        if (w.status == "AVAILABLE") ++count;
    return count;
}

int MachineAssigner::countAssignedWorkers() const {
    int count = 0;
    for (const auto& [id, w] : workers_)
        if (w.status == "ASSIGNED") ++count;
    return count;
}

// ── Private helpers ───────────────────────────────────────────────────────────
int MachineAssigner::findIdleMachine(const std::string& type) const {
    for (const auto& [id, m] : machines_) {
        if (m.machine_type == type && m.status == "IDLE") return id;
    }
    return -1;
}

int MachineAssigner::findAvailableWorker(const std::string& skill) const {
    for (const auto& [id, w] : workers_) {
        if (w.status == "AVAILABLE" &&
            w.skill_set.find(skill) != std::string::npos) return id;
    }
    return -1;
}
