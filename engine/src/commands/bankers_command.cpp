#include "commands/commands.h"

#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "bankers/bankers.h"
#include "util/json.h"

// Request format:
//   N M                          processes, resource kinds
//   available (M numbers)
//   N lines:  pid  allocation (M numbers)  maximum (M numbers)
//   optional last line:  REQUEST pid  request (M numbers)

int runBankersCommand(std::istream& in) {
    int n = 0, m = 0;
    in >> n >> m;
    Vector available(m);
    for (int j = 0; j < m; j++) in >> available[j];

    std::vector<int> pids(n);
    Matrix allocation(n, Vector(m)), maximum(n, Vector(m));
    for (int i = 0; i < n; i++) {
        in >> pids[i];
        for (int j = 0; j < m; j++) in >> allocation[i][j];
        for (int j = 0; j < m; j++) in >> maximum[i][j];
    }

    bool hasRequest = false;
    int  requestPid = -1;
    Vector request(m, 0);
    std::string token;
    if (in >> token && token == "REQUEST") {
        hasRequest = true;
        in >> requestPid;
        for (int j = 0; j < m; j++) in >> request[j];
    }

    BankersResult r = runBankers(available, maximum, allocation, pids, hasRequest, requestPid, request);

    std::ostringstream os;
    os << "{"
       << jsonString("safe") << ":" << (r.safe ? "true" : "false") << ","
       << jsonString("sequence") << ":" << jsonIntArray(r.sequence) << ","
       << jsonString("need") << ":" << jsonMatrix(r.need) << ","
       << jsonString("hasRequest") << ":" << (r.hasRequest ? "true" : "false") << ","
       << jsonString("granted") << ":" << (r.granted ? "true" : "false") << ","
       << jsonString("message") << ":" << jsonString(r.message)
       << "}";
    std::cout << os.str() << std::endl;
    return 0;
}
