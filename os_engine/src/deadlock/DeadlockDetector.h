// DeadlockDetector.h
// Member: Rahul Singh
// Description: Standalone DeadlockDetector that wraps ResourceManager's
//              detection logic and provides a clean interface for the
//              backend API and dashboard to query deadlock status.

#ifndef DEADLOCK_DETECTOR_H
#define DEADLOCK_DETECTOR_H

#include <vector>
#include <string>
#include <memory>
#include "../../../os_engine/include/ResourceManager.h"
#include "../../../os_engine/include/PCB.h"

// DeadlockReport: result returned to the backend after a detection run
struct DeadlockReport {
    bool             deadlock_found;
    std::vector<int> deadlocked_process_ids;   // order_ids stuck in cycle
    std::vector<int> deadlocked_resource_ids;  // resources involved
    std::string      detected_at;              // ISO timestamp
    std::string      suggested_resolution;     // "TERMINATE_LOWEST_PRIORITY" | "PREEMPT_RESOURCE" | "NONE"
};

class DeadlockDetector {
public:
    explicit DeadlockDetector(ResourceManager& rm);

    // Run deadlock detection against current live process list
    // @param processes  all active PCBs in the system
    // @return DeadlockReport with findings
    DeadlockReport runDetection(const std::vector<std::shared_ptr<PCB>>& processes);

    // Apply suggested resolution: terminates the lowest-priority deadlocked process
    // Returns the order_id of the terminated process, or -1 if none
    int resolveByTermination(std::vector<std::shared_ptr<PCB>>& processes,
                              DeadlockReport& report);

private:
    ResourceManager& rm_;

    // Find which resources are involved given a set of deadlocked process IDs
    std::vector<int> findInvolvedResources(
        const std::vector<int>& deadlockedPids,
        const std::vector<std::shared_ptr<PCB>>& processes) const;

    // Get current ISO 8601 timestamp string
    std::string currentTimestamp() const;
};

#endif // DEADLOCK_DETECTOR_H
