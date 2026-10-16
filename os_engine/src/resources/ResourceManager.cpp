// ResourceManager.cpp
// Member: Rahul Singh
// Description: Implementation of ResourceManager.
//              Core logic: resource registration, allocation/release,
//              Banker's Algorithm safety check, and deadlock detection.

#include "../../include/ResourceManager.h"
#include <algorithm>
#include <stdexcept>

// ── Resource registration ─────────────────────────────────────────────────────

void ResourceManager::registerResource(const Resource& res) {
    std::lock_guard<std::mutex> lock(mutex_);
    resources_[res.resource_id] = res;
}

bool ResourceManager::deregisterResource(int resource_id) {
    std::lock_guard<std::mutex> lock(mutex_);
    return resources_.erase(resource_id) > 0;
}

std::vector<Resource> ResourceManager::getAllResources() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<Resource> result;
    result.reserve(resources_.size());
    for (const auto& pair : resources_) {
        result.push_back(pair.second);
    }
    return result;
}

Resource* ResourceManager::getResourceById(int resource_id) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = resources_.find(resource_id);
    return (it != resources_.end()) ? &it->second : nullptr;
}

// ── Core allocation ───────────────────────────────────────────────────────────

AllocationResult ResourceManager::requestResources(
    PCB& process,
    const std::vector<std::pair<int,int>>& request)
{
    std::lock_guard<std::mutex> lock(mutex_);

    // Step 1: Validate — does the request exceed what is available?
    for (const auto& [res_id, units] : request) {
        auto it = resources_.find(res_id);
        if (it == resources_.end()) {
            return {false, "Resource ID " + std::to_string(res_id) + " not found", {}};
        }
        if (units > it->second.available_units) {
            // Not enough units — process must wait
            process.state = ProcessState::WAITING;
            return {false, "Insufficient units for resource " + it->second.resource_name, {}};
        }
    }

    // Step 2: Tentatively allocate (will roll back if unsafe)
    for (const auto& [res_id, units] : request) {
        resources_[res_id].available_units -= units;
        // Update PCB resource tracking
        for (auto& req : process.resources) {
            if (req.resource_id == res_id) {
                req.units_allocated += units;
            }
        }
    }

    // Step 3: Run Banker's safety algorithm — NOTE: requires full process list
    // For 20% milestone we do a simplified available-units check only.
    // Full Banker's integration happens in Phase 4 when all PCBs are available.
    // Placeholder safe sequence — will be populated in full implementation
    std::vector<int> safeSeq = { process.process_id };

    process.state = ProcessState::RUNNING;
    return {true, "Resources allocated successfully", safeSeq};
}

void ResourceManager::releaseResources(PCB& process) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& req : process.resources) {
        auto it = resources_.find(req.resource_id);
        if (it != resources_.end()) {
            it->second.available_units += req.units_allocated;
            // Clamp to total_units (safety guard)
            if (it->second.available_units > it->second.total_units) {
                it->second.available_units = it->second.total_units;
            }
        }
    }
    // Clear allocations in the PCB
    for (auto& req : process.resources) {
        req.units_allocated = 0;
    }
}

void ResourceManager::releaseSpecificResources(
    PCB& process,
    const std::vector<std::pair<int,int>>& toRelease)
{
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& [res_id, units] : toRelease) {
        auto it = resources_.find(res_id);
        if (it != resources_.end()) {
            it->second.available_units += units;
            if (it->second.available_units > it->second.total_units) {
                it->second.available_units = it->second.total_units;
            }
        }
    }
}

// ── Banker's Algorithm ────────────────────────────────────────────────────────

BankersState ResourceManager::buildBankersState(
    const std::vector<std::shared_ptr<PCB>>& processes) const
{
    std::lock_guard<std::mutex> lock(mutex_);

    BankersState state;
    state.num_processes = static_cast<int>(processes.size());
    state.num_resources = static_cast<int>(resources_.size());

    // Build resource index map: resource_id -> column index
    int col = 0;
    for (const auto& [rid, res] : resources_) {
        state.resource_ids.push_back(rid);
        state.available.push_back(res.available_units);
        col++;
    }

    // Build Allocation and Max matrices row by row
    for (const auto& pcb : processes) {
        state.process_ids.push_back(pcb->process_id);

        std::vector<int> alloc_row(state.num_resources, 0);
        std::vector<int> max_row(state.num_resources, 0);

        for (const auto& req : pcb->resources) {
            // Find the column index for this resource
            for (int c = 0; c < state.num_resources; ++c) {
                if (state.resource_ids[c] == req.resource_id) {
                    alloc_row[c] = req.units_allocated;
                    max_row[c]   = req.units_required;
                    break;
                }
            }
        }

        state.allocation.push_back(alloc_row);
        state.max_demand.push_back(max_row);

        // Need[i][j] = Max[i][j] - Allocation[i][j]
        std::vector<int> need_row(state.num_resources);
        for (int c = 0; c < state.num_resources; ++c) {
            need_row[c] = max_row[c] - alloc_row[c];
        }
        state.need.push_back(need_row);
    }

    return state;
}

bool ResourceManager::isSafeState(
    const BankersState& state,
    std::vector<int>& safeSequence) const
{
    // Classic Banker's Algorithm safety check
    std::vector<int>  work    = state.available;       // work = available (copy)
    std::vector<bool> finish(state.num_processes, false);
    safeSequence.clear();

    int found_count = 0;
    // Keep iterating until no more processes can be satisfied
    while (found_count < state.num_processes) {
        bool found = false;
        for (int i = 0; i < state.num_processes; ++i) {
            if (finish[i]) continue;

            // Check if Need[i] <= Work
            bool can_allocate = true;
            for (int j = 0; j < state.num_resources; ++j) {
                if (state.need[i][j] > work[j]) {
                    can_allocate = false;
                    break;
                }
            }

            if (can_allocate) {
                // Simulate process i finishing: release its allocation
                for (int j = 0; j < state.num_resources; ++j) {
                    work[j] += state.allocation[i][j];
                }
                finish[i] = true;
                safeSequence.push_back(state.process_ids[i]);
                found_count++;
                found = true;
            }
        }
        // If no process could proceed in a full pass, system is unsafe
        if (!found) break;
    }

    return (found_count == state.num_processes);
}

bool ResourceManager::isRequestSafe(
    const BankersState& state,
    int process_index,
    const std::vector<int>& request) const
{
    // Simulate granting the request and check if state remains safe
    BankersState simState = state; // deep copy

    // Pretend to grant: Available -= Request, Allocation[i] += Request, Need[i] -= Request
    for (int j = 0; j < state.num_resources; ++j) {
        if (request[j] > simState.available[j]) return false; // not enough — unsafe
        simState.available[j]                        -= request[j];
        simState.allocation[process_index][j]        += request[j];
        simState.need[process_index][j]              -= request[j];
    }

    std::vector<int> safeSeq;
    return isSafeState(simState, safeSeq);
}

// ── Deadlock detection ────────────────────────────────────────────────────────

std::vector<int> ResourceManager::detectDeadlock(
    const std::vector<std::shared_ptr<PCB>>& processes) const
{
    // Deadlock detection using the resource-allocation graph reduction approach
    // A process is deadlocked if it cannot finish and is stuck in WAITING state

    BankersState state = buildBankersState(processes);
    std::vector<int> work     = state.available;
    std::vector<bool> finish(state.num_processes, false);

    // Mark processes with zero allocation as already finished (they hold nothing)
    for (int i = 0; i < state.num_processes; ++i) {
        bool holds_nothing = true;
        for (int j = 0; j < state.num_resources; ++j) {
            if (state.allocation[i][j] > 0) { holds_nothing = false; break; }
        }
        if (holds_nothing) finish[i] = true;
    }

    bool changed = true;
    while (changed) {
        changed = false;
        for (int i = 0; i < state.num_processes; ++i) {
            if (finish[i]) continue;
            bool can_finish = true;
            for (int j = 0; j < state.num_resources; ++j) {
                if (state.need[i][j] > work[j]) { can_finish = false; break; }
            }
            if (can_finish) {
                for (int j = 0; j < state.num_resources; ++j) {
                    work[j] += state.allocation[i][j];
                }
                finish[i] = true;
                changed   = true;
            }
        }
    }

    // Any process still not finished is in a deadlock
    std::vector<int> deadlocked;
    for (int i = 0; i < state.num_processes; ++i) {
        if (!finish[i]) {
            deadlocked.push_back(state.process_ids[i]);
        }
    }
    return deadlocked;
}

// ── Utility ───────────────────────────────────────────────────────────────────

int ResourceManager::getAvailableUnits(int resource_id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = resources_.find(resource_id);
    return (it != resources_.end()) ? it->second.available_units : 0;
}

bool ResourceManager::isAvailable(int resource_id, int units_needed) const {
    return getAvailableUnits(resource_id) >= units_needed;
}

// ── Private helpers ───────────────────────────────────────────────────────────

void ResourceManager::allocate(int resource_id, int units) {
    // Must be called with mutex_ already held
    resources_[resource_id].available_units -= units;
}

void ResourceManager::release(int resource_id, int units) {
    // Must be called with mutex_ already held
    resources_[resource_id].available_units += units;
}
