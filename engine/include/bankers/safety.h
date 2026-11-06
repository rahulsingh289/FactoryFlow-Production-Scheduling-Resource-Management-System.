#ifndef FACTORY_BANKERS_SAFETY_H
#define FACTORY_BANKERS_SAFETY_H

#include "bankers/types.h"

// Need = Maximum - Allocation, for `resources` kinds of resource.
Matrix computeNeed(const Matrix& maximum, const Matrix& allocation, int resources);

// The safety algorithm. Returns true, and fills `sequence` with row indexes in an order
// in which every process can finish, if the state is safe. `need` is the Need matrix.
bool isSafe(const Vector& available, const Matrix& allocation, const Matrix& need, std::vector<int>& sequence);

// Checks the safety of the state as it stands (using result.need) and records the answer
// in result.safe and result.sequence, with row indexes translated to real order ids.
void recordSafety(BankersResult& result, const Vector& available, const Matrix& allocation,
                  const std::vector<int>& pids);

#endif
