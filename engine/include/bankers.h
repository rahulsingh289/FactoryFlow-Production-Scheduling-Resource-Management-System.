#ifndef BANKERS_H
#define BANKERS_H

#include <string>
#include <vector>

using Matrix = std::vector<std::vector<int>>;
using Vector = std::vector<int>;

struct BankersResult {
    bool        safe = false;
    std::vector<int> sequence;   // pids in a safe execution order (empty if unsafe)
    Matrix      need;            // Max - Allocation
    // Only populated when a resource request was supplied:
    bool        hasRequest   = false;
    bool        granted      = false;
    std::string message;
};

struct DeadlockResult {
    bool             deadlocked = false;
    std::vector<int> safeOrder;    // processes that can finish
    std::vector<int> blockedPids;  // processes stuck in a deadlock
};

// pids[i] is the real order id for row i.
BankersResult runBankers(const Vector& available, const Matrix& maximum,
                         const Matrix& allocation, const std::vector<int>& pids,
                         bool hasRequest, int requestPid, const Vector& request);

// Deadlock detection (resource-request matrix, not Max): a process can run if
// its outstanding request is <= currently available resources.
DeadlockResult detectDeadlock(const Vector& available, const Matrix& allocation,
                              const Matrix& request, const std::vector<int>& pids);

#endif
