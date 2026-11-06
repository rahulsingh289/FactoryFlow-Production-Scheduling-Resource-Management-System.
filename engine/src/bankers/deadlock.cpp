#include "bankers/deadlock.h"

DeadlockResult detectDeadlock(const Vector& available, const Matrix& allocation,
                              const Matrix& request, const std::vector<int>& pids) {
    DeadlockResult res;
    int n = static_cast<int>(allocation.size());
    int m = static_cast<int>(available.size());
    Vector work = available;
    std::vector<bool> finish(n, false);

    // A process with no allocation holds nothing anyone is waiting for, so it can't be deadlocked.
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
