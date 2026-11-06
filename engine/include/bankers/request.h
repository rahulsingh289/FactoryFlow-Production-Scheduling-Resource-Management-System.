#ifndef FACTORY_BANKERS_REQUEST_H
#define FACTORY_BANKERS_REQUEST_H

#include "bankers/types.h"

// The resource-request algorithm: should process `row` be given `request`?
//   1. Is it more than the process still needs?           -> rejected
//   2. Is it more than is available now?                  -> must wait
//   3. Pretend to grant it: does a safe order still exist? -> granted, or rejected as unsafe
// result.need must already hold the Need matrix. Fills in granted, safe, sequence and message.
void evaluateRequest(BankersResult& result, const Vector& available, const Matrix& allocation,
                     const std::vector<int>& pids, int row, const Vector& request);

#endif
