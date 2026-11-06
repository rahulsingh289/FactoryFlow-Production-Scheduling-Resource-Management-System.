#ifndef FACTORY_BANKERS_DEADLOCK_H
#define FACTORY_BANKERS_DEADLOCK_H

#include <vector>

#include "bankers/types.h"

// Deadlock detection. It works on the Request matrix (what each process is waiting for
// right now), not on Maximum: a process can finish if its outstanding request is no more
// than what is available, and then gives back everything it holds. Whoever can never
// finish is deadlocked.
DeadlockResult detectDeadlock(const Vector& available, const Matrix& allocation,
                              const Matrix& request, const std::vector<int>& pids);

#endif
