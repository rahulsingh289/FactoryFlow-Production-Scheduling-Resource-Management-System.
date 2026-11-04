// =========================================================================
//  Factory OS Engine  (C++17)
//  Smart Factory Production Scheduler — Operating-System core.
//
//  This program is the OS half of the project. The Node/Express backend runs
//  it as a child process: it writes a small plain-text request on stdin and
//  reads a JSON reply on stdout. Keeping the OS algorithms in C++ (and out of
//  JavaScript) is deliberate — this is where the scheduling, Banker's
//  Algorithm and deadlock detection actually live.
//
//  Commands (argv[1]):
//    schedule   FCFS | SJF | SRTF | PRIORITY | PRIORITYP | RR
//    bankers    safe-state check + optional resource request
//    deadlock   deadlock detection
//
//  Build:  g++ -std=c++17 -Iinclude src/*.cpp -o factory_engine
//
//  schedule request format (machine types are integer ids; -1 = any machine):
//    ALGORITHM QUANTUM
//    N   then N lines:  pid arrival burst priority machineType
//    M   then M lines:  machineId capacity machineType
//    W   then W lines:  workerId workerType   (workerType -1 = can run any machine)
//
//  Try it (2 machines of type 0, 1 worker who can run any machine):
//    printf "FCFS 0\n2\n1 0 5 2 0\n2 1 3 1 0\n2\n1 1 0\n2 1 0\n1\n7 -1\n" | ./factory_engine schedule
// =========================================================================

#include "scheduling.h"
#include "bankers.h"

#include <iostream>
#include <sstream>
#include <string>
#include <vector>

// ------------------------- tiny JSON output helpers ----------------------
static std::string jnum(double v) {
    std::ostringstream os;
    if (v == static_cast<long long>(v)) os << static_cast<long long>(v);
    else { os.precision(3); os << std::fixed << v; }
    return os.str();
}
static std::string jstr(const std::string& s) { return "\"" + s + "\""; }

static std::string intArray(const std::vector<int>& v) {
    std::string out = "[";
    for (size_t i = 0; i < v.size(); i++) { if (i) out += ","; out += std::to_string(v[i]); }
    return out + "]";
}
static std::string matrix(const Matrix& m) {
    std::string out = "[";
    for (size_t i = 0; i < m.size(); i++) { if (i) out += ","; out += intArray(m[i]); }
    return out + "]";
}

// ------------------------------- commands --------------------------------
static int cmdSchedule(std::istream& in) {
    std::string algo;
    int quantum = 0;
    in >> algo >> quantum;
    int n = 0;
    in >> n;
    std::vector<Process> procs;
    procs.reserve(n);
    for (int i = 0; i < n; i++) {
        Process p;
        in >> p.pid >> p.arrival >> p.burst >> p.priority >> p.machineType;
        procs.push_back(p);
    }

    int m = 0;
    in >> m;
    std::vector<Machine> machines(m);
    for (auto& machine : machines) in >> machine.id >> machine.capacity >> machine.type;

    int w = 0;
    in >> w;
    std::vector<Worker> workers(w);
    for (auto& worker : workers) in >> worker.id >> worker.type;

    ScheduleResult r = runSchedule(procs, machines, workers, algo, quantum);

    std::ostringstream os;
    os << "{";
    os << jstr("algorithm") << ":" << jstr(r.algorithm) << ",";

    os << jstr("gantt") << ":[";
    for (size_t i = 0; i < r.gantt.size(); i++) {
        if (i) os << ",";
        os << "{" << jstr("pid") << ":" << r.gantt[i].pid << ","
           << jstr("start") << ":" << r.gantt[i].start << ","
           << jstr("end") << ":" << r.gantt[i].end << ","
           << jstr("machine") << ":" << r.gantt[i].machine << ","
           << jstr("worker") << ":" << r.gantt[i].worker << "}";
    }
    os << "],";

    os << jstr("unschedulable") << ":[";
    for (size_t i = 0; i < r.unschedulable.size(); i++) {
        if (i) os << ",";
        os << "{" << jstr("pid") << ":" << r.unschedulable[i].pid << ","
           << jstr("reason") << ":" << jstr(r.unschedulable[i].reason) << "}";
    }
    os << "],";

    os << jstr("processes") << ":[";
    for (size_t i = 0; i < r.processes.size(); i++) {
        const Process& p = r.processes[i];
        if (i) os << ",";
        os << "{" << jstr("pid") << ":" << p.pid << ","
           << jstr("arrival") << ":" << p.arrival << ","
           << jstr("burst") << ":" << p.burst << ","
           << jstr("priority") << ":" << p.priority << ","
           << jstr("start") << ":" << p.start << ","
           << jstr("completion") << ":" << p.completion << ","
           << jstr("turnaround") << ":" << p.turnaround << ","
           << jstr("waiting") << ":" << p.waiting << ","
           << jstr("response") << ":" << p.response << "}";
    }
    os << "],";

    os << jstr("avgWaiting") << ":" << jnum(r.avgWaiting) << ","
       << jstr("avgTurnaround") << ":" << jnum(r.avgTurnaround) << ","
       << jstr("avgResponse") << ":" << jnum(r.avgResponse) << ","
       << jstr("throughput") << ":" << jnum(r.throughput) << ","
       << jstr("makespan") << ":" << r.makespan;
    os << "}";

    std::cout << os.str() << std::endl;
    return 0;
}

static int cmdBankers(std::istream& in) {
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

    // Optional:  REQUEST <pid> r1 r2 ... rM
    bool hasRequest = false;
    int  reqPid = -1;
    Vector request(m, 0);
    std::string tok;
    if (in >> tok && tok == "REQUEST") {
        hasRequest = true;
        in >> reqPid;
        for (int j = 0; j < m; j++) in >> request[j];
    }

    BankersResult r = runBankers(available, maximum, allocation, pids,
                                 hasRequest, reqPid, request);

    std::ostringstream os;
    os << "{"
       << jstr("safe") << ":" << (r.safe ? "true" : "false") << ","
       << jstr("sequence") << ":" << intArray(r.sequence) << ","
       << jstr("need") << ":" << matrix(r.need) << ","
       << jstr("hasRequest") << ":" << (r.hasRequest ? "true" : "false") << ","
       << jstr("granted") << ":" << (r.granted ? "true" : "false") << ","
       << jstr("message") << ":" << jstr(r.message)
       << "}";
    std::cout << os.str() << std::endl;
    return 0;
}

static int cmdDeadlock(std::istream& in) {
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
       << jstr("deadlocked") << ":" << (r.deadlocked ? "true" : "false") << ","
       << jstr("safeOrder") << ":" << intArray(r.safeOrder) << ","
       << jstr("blocked") << ":" << intArray(r.blockedPids)
       << "}";
    std::cout << os.str() << std::endl;
    return 0;
}

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "usage: factory_engine <schedule|bankers|deadlock>\n";
        return 1;
    }
    std::string cmd = argv[1];
    if (cmd == "schedule") return cmdSchedule(std::cin);
    if (cmd == "bankers")  return cmdBankers(std::cin);
    if (cmd == "deadlock") return cmdDeadlock(std::cin);
    std::cerr << "unknown command: " << cmd << "\n";
    return 1;
}
