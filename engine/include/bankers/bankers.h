#ifndef FACTORY_BANKERS_BANKERS_H
#define FACTORY_BANKERS_BANKERS_H

#include <vector>

#include "bankers/types.h"

// The Banker's Algorithm. Without a request it reports whether the current state is safe.
// With one (hasRequest) it also decides whether `requestPid` may have `request`.
// pids[i] is the real order id for row i of the matrices.
BankersResult runBankers(const Vector& available, const Matrix& maximum,
                         const Matrix& allocation, const std::vector<int>& pids,
                         bool hasRequest, int requestPid, const Vector& request);

#endif
