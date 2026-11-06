#include "bankers/request.h"

#include "bankers/safety.h"

void evaluateRequest(BankersResult& res, const Vector& available, const Matrix& allocation,
                     const std::vector<int>& pids, int row, const Vector& request) {
    int m = static_cast<int>(available.size());

    // Step 1: Request <= Need
    for (int j = 0; j < m; j++) {
        if (request[j] > res.need[row][j]) {
            res.granted = false;
            res.message = "Rejected: request exceeds the order's declared maximum need.";
            recordSafety(res, available, allocation, pids);
            return;
        }
    }
    // Step 2: Request <= Available
    for (int j = 0; j < m; j++) {
        if (request[j] > available[j]) {
            res.granted = false;
            res.message = "Must wait: not enough resources are currently available.";
            recordSafety(res, available, allocation, pids);
            return;
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

    std::vector<int> rows;
    bool safe = isSafe(avail2, alloc2, need2, rows);
    res.granted = safe;
    res.safe    = safe;
    for (int r : rows) res.sequence.push_back(pids[r]);
    res.message = safe ? "Granted: the system stays in a safe state."
                       : "Rejected: granting the request would lead to an unsafe state.";
}
