#ifndef FACTORY_BANKERS_TYPES_H
#define FACTORY_BANKERS_TYPES_H

#include <string>
#include <vector>

using Matrix = std::vector<std::vector<int>>;
using Vector = std::vector<int>;

// The outcome of the Banker's Algorithm.
struct BankersResult {
    bool             safe = false;
    std::vector<int> sequence;   // pids in a safe execution order (empty if unsafe)
    Matrix           need;       // Maximum - Allocation
    // Only filled in when a resource request was supplied:
    bool             hasRequest = false;
    bool             granted    = false;
    std::string      message;
};

// The outcome of deadlock detection.
struct DeadlockResult {
    bool             deadlocked = false;
    std::vector<int> safeOrder;    // processes that can finish
    std::vector<int> blockedPids;  // processes stuck in a deadlock
};

#endif
