// ResourceManager.h
// Member: Rahul Singh
// Description: Declares the ResourceManager class which tracks all factory
//              resources, handles allocation/release requests from processes,
//              and runs Banker's Algorithm to ensure safe state before granting
//              any resource request.

#ifndef RESOURCE_MANAGER_H
#define RESOURCE_MANAGER_H

#include <vector>
#include <string>
#include <unordered_map>
#include <mutex>
#include "PCB.h"

// ── Data structures for Banker's Algorithm ───────────────────────────────────

// Represents one resource type in the system
struct Resource {
    int         resource_id;
    std::string resource_name;
    std::string resource_type;   // "MACHINE" | "ROBOT" | "MATERIAL" | "WORKER"
    int         total_units;     // maximum capacity
    int         available_units; // currently free
};

// BankersState: full snapshot of the system used by Banker's Algorithm
// Mirrors the classic Banker's Algorithm matrices:
//   Allocation[i][j] = units of resource j currently held by process i
//   Max[i][j]        = maximum units of resource j process i may ever need
//   Need[i][j]       = Max[i][j] - Allocation[i][j]
//   Available[j]     = total free units of resource j
struct BankersState {
    int                         num_processes;   // P
    int                         num_resources;   // R
    std::vector<int>            available;       // Available[R]
    std::vector<std::vector<int>> allocation;    // Allocation[P][R]
    std::vector<std::vector<int>> max_demand;    // Max[P][R]
    std::vector<std::vector<int>> need;          // Need[P][R]  = Max - Allocation
    std::vector<int>            process_ids;     // maps row index -> order_id
    std::vector<int>            resource_ids;    // maps column index -> resource_id
};

// AllocationResult: returned by requestResources()
struct AllocationResult {
    bool        granted;         // true = resources allocated safely
    std::string reason;          // explanation if denied
    std::vector<int> safe_sequence; // safe execution sequence (order_ids) if granted
};

// ── ResourceManager class ─────────────────────────────────────────────────────

class ResourceManager {
public:
    ResourceManager() = default;
    ~ResourceManager() = default;

    // Register a resource type into the system (called at startup from DB)
    void registerResource(const Resource& res);

    // Remove a resource type (maintenance / decommission)
    bool deregisterResource(int resource_id);

    // Get current state of all resources
    std::vector<Resource> getAllResources() const;

    // Get one resource by ID
    Resource* getResourceById(int resource_id);

    // ── Core allocation operations ────────────────────────────────────────────

    // Request resources for a process — runs safety check before granting
    // @param process    the PCB requesting resources
    // @param request    vector of (resource_id, units_requested) pairs
    // @return AllocationResult indicating whether request was granted or denied
    AllocationResult requestResources(PCB& process,
                                      const std::vector<std::pair<int,int>>& request);

    // Release all resources held by a process (called when process completes/terminates)
    void releaseResources(PCB& process);

    // Release specific resources held by a process
    void releaseSpecificResources(PCB& process,
                                   const std::vector<std::pair<int,int>>& toRelease);

    // ── Banker's Algorithm ────────────────────────────────────────────────────

    // Build the current BankersState snapshot from live allocation data
    BankersState buildBankersState(const std::vector<std::shared_ptr<PCB>>& processes) const;

    // Run the Banker's safety algorithm on a given state
    // Returns true if system is in a safe state; fills safeSequence
    bool isSafeState(const BankersState& state,
                     std::vector<int>& safeSequence) const;

    // Simulate granting a request and check if the resulting state is safe
    // Does NOT modify actual state — pure check only
    bool isRequestSafe(const BankersState& state,
                       int process_index,
                       const std::vector<int>& request) const;

    // ── Deadlock detection ────────────────────────────────────────────────────

    // Check if the current allocation state has a deadlock
    // Returns list of order_ids involved in the deadlock cycle (empty = no deadlock)
    std::vector<int> detectDeadlock(const std::vector<std::shared_ptr<PCB>>& processes) const;

    // Get total available units for a specific resource
    int getAvailableUnits(int resource_id) const;

    // Check if enough units of a resource are available
    bool isAvailable(int resource_id, int units_needed) const;

private:
    std::unordered_map<int, Resource> resources_;        // resource_id -> Resource
    mutable std::mutex                mutex_;            // thread safety for concurrent requests

    // Internal: subtract allocated units from available pool
    void allocate(int resource_id, int units);

    // Internal: return units back to available pool
    void release(int resource_id, int units);
};

#endif // RESOURCE_MANAGER_H
