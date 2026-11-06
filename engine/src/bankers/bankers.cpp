#include "bankers/bankers.h"

#include "bankers/request.h"
#include "bankers/safety.h"

BankersResult runBankers(const Vector& available, const Matrix& maximum,
                         const Matrix& allocation, const std::vector<int>& pids,
                         bool hasRequest, int requestPid, const Vector& request) {
    BankersResult res;
    res.need = computeNeed(maximum, allocation, static_cast<int>(available.size()));

    // No request: just report whether the current state is safe.
    if (!hasRequest) {
        recordSafety(res, available, allocation, pids);
        return res;
    }

    res.hasRequest = true;
    int row = -1;
    for (size_t i = 0; i < allocation.size(); i++) {
        if (pids[i] == requestPid) { row = static_cast<int>(i); break; }
    }
    if (row == -1) {
        res.message = "Requesting order not found in the claim matrix.";
        recordSafety(res, available, allocation, pids);
        return res;
    }

    evaluateRequest(res, available, allocation, pids, row, request);
    return res;
}
