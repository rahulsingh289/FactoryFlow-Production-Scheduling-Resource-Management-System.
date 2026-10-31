#include "bankers.h"

// ---------------------------------------------------------------------------
// Banker's Algorithm — safe-state check and resource-request handling.
// ---------------------------------------------------------------------------

static int numResources(const Vector& available) { return static_cast<int>(available.size()); }

// Safety algorithm: returns true and fills `sequence` (row indices) if the
// state is safe given need / allocation / available.
static bool isSafe(const Vector& available, const Matrix& allocation,
                   const Matrix& need, std::vector<int>& sequence) {
    int n = static_cast<int>(allocation.size());
    int m = numResources(available);
    Vector work = available;
    std::vector<bool> finish(n, false);
    sequence.clear();

    int count = 0;
    while (count < n) {
        bool progressed = false;
        for (int i = 0; i < n; i++) {
            if (finish[i]) continue;
            bool canRun = true;
            for (int j = 0; j < m; j++)
                if (need[i][j] > work[j]) { canRun = false; break; }
            if (canRun) {
                for (int j = 0; j < m; j++) work[j] += allocation[i][j];
                finish[i] = true;
                sequence.push_back(i);
                progressed = true;
                count++;
            }
        }
        if (!progressed) break; // no process could run -> unsafe
    }
    return count == n;
}

BankersResult runBankers(const Vector& available, const Matrix& maximum,
                         const Matrix& allocation, const std::vector<int>& pids,
                         bool hasRequest, int requestPid, const Vector& request) {
    BankersResult res;
    int n = static_cast<int>(allocation.size());
    int m = numResources(available);

    // Need = Max - Allocation
    res.need.assign(n, Vector(m, 0));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < m; j++)
            res.need[i][j] = maximum[i][j] - allocation[i][j];

    // No request: just report whether the current state is safe.
    if (!hasRequest) {
        std::vector<int> seq;
        res.safe = isSafe(available, allocation, res.need, seq);
        for (int idx : seq) res.sequence.push_back(pids[idx]);
        return res;
    }

    // Resource-request algorithm.
    res.hasRequest = true;
    int row = -1;
    for (int i = 0; i < n; i++) if (pids[i] == requestPid) { row = i; break; }
    if (row == -1) {
        res.message = "Requesting order not found in the claim matrix.";
        std::vector<int> seq;
        res.safe = isSafe(available, allocation, res.need, seq);
        for (int idx : seq) res.sequence.push_back(pids[idx]);
        return res;
    }

    // Step 1: Request <= Need
    for (int j = 0; j < m; j++) {
        if (request[j] > res.need[row][j]) {
            res.granted = false;
            res.message = "Rejected: request exceeds the order's declared maximum need.";
            std::vector<int> seq;
            res.safe = isSafe(available, allocation, res.need, seq);
            for (int idx : seq) res.sequence.push_back(pids[idx]);
            return res;
        }
    }
    // Step 2: Request <= Available
    for (int j = 0; j < m; j++) {
        if (request[j] > available[j]) {
            res.granted = false;
            res.message = "Must wait: not enough resources are currently available.";
            std::vector<int> seq;
            res.safe = isSafe(available, allocation, res.need, seq);
            for (int idx : seq) res.sequence.push_back(pids[idx]);
            return res;
        }
    }
    // Step 3: pretend to allocate, then test safety.
    Vector avail2 = available;
    Matrix alloc2 = allocation;
    Matrix need2  = res.need;
    for (int j = 0; j < m; j++) {
        avail2[j]      -= request[j];
        alloc2[row][j] += request[j];
        need2[row][j]  -= request[j];
    }

    std::vector<int> seq;
    bool safe = isSafe(avail2, alloc2, need2, seq);
    res.granted = safe;
    res.safe    = safe;
    for (int idx : seq) res.sequence.push_back(pids[idx]);
    res.message = safe ? "Granted: the system stays in a safe state."
                       : "Rejected: granting the request would lead to an unsafe state.";
    return res;
}

// ---------------------------------------------------------------------------
// Deadlock detection algorithm.
// ---------------------------------------------------------------------------
DeadlockResult detectDeadlock(const Vector& available, const Matrix& allocation,
                              const Matrix& request, const std::vector<int>& pids) {
    DeadlockResult res;
    int n = static_cast<int>(allocation.size());
    int m = numResources(available);
    Vector work = available;
    std::vector<bool> finish(n, false);

    // A process with no allocation is trivially finishable.
    for (int i = 0; i < n; i++) {
        bool hasAlloc = false;
        for (int j = 0; j < m; j++) if (allocation[i][j] != 0) { hasAlloc = true; break; }
        if (!hasAlloc) finish[i] = true;
    }

    bool progressed = true;
    while (progressed) {
        progressed = false;
        for (int i = 0; i < n; i++) {
            if (finish[i]) continue;
            bool canRun = true;
            for (int j = 0; j < m; j++)
                if (request[i][j] > work[j]) { canRun = false; break; }
            if (canRun) {
                for (int j = 0; j < m; j++) work[j] += allocation[i][j];
                finish[i] = true;
                res.safeOrder.push_back(pids[i]);
                progressed = true;
            }
        }
    }

    for (int i = 0; i < n; i++)
        if (!finish[i]) { res.deadlocked = true; res.blockedPids.push_back(pids[i]); }

    return res;
}
