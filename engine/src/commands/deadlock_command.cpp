#include "commands/commands.h"

#include <iostream>
#include <sstream>
#include <vector>

#include "bankers/deadlock.h"
#include "util/json.h"

// Request format:
//   N M                          processes, resource kinds
//   available (M numbers)
//   N lines:  pid  allocation (M numbers)  request (M numbers)

int runDeadlockCommand(std::istream& in) {
    int n = 0, m = 0;
    in >> n >> m;
    Vector available(m);
    for (int j = 0; j < m; j++) in >> available[j];

    std::vector<int> pids(n);
    Matrix allocation(n, Vector(m)), request(n, Vector(m));
    for (int i = 0; i < n; i++) {
        in >> pids[i];
        for (int j = 0; j < m; j++) in >> allocation[i][j];
        for (int j = 0; j < m; j++) in >> request[i][j];
    }

    DeadlockResult r = detectDeadlock(available, allocation, request, pids);

    std::ostringstream os;
    os << "{"
       << jsonString("deadlocked") << ":" << (r.deadlocked ? "true" : "false") << ","
       << jsonString("safeOrder") << ":" << jsonIntArray(r.safeOrder) << ","
       << jsonString("blocked") << ":" << jsonIntArray(r.blockedPids)
       << "}";
    std::cout << os.str() << std::endl;
    return 0;
}
