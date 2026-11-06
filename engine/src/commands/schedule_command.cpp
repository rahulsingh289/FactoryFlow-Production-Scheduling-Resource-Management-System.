#include "commands/commands.h"

#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "scheduling/simulator.h"
#include "util/json.h"

// Request format (machine types are integer ids; -1 = any machine / any worker):
//   ALGORITHM QUANTUM
//   N   then N lines:  pid arrival burst priority machineType
//   M   then M lines:  machineId capacity machineType
//   W   then W lines:  workerId workerType

namespace {

std::string scheduleToJson(const ScheduleResult& r) {
    std::ostringstream os;
    os << "{";
    os << jsonString("algorithm") << ":" << jsonString(r.algorithm) << ",";

    os << jsonString("gantt") << ":[";
    for (size_t i = 0; i < r.gantt.size(); i++) {
        if (i) os << ",";
        os << "{" << jsonString("pid") << ":" << r.gantt[i].pid << ","
           << jsonString("start") << ":" << r.gantt[i].start << ","
           << jsonString("end") << ":" << r.gantt[i].end << ","
           << jsonString("machine") << ":" << r.gantt[i].machine << ","
           << jsonString("worker") << ":" << r.gantt[i].worker << "}";
    }
    os << "],";

    os << jsonString("unschedulable") << ":[";
    for (size_t i = 0; i < r.unschedulable.size(); i++) {
        if (i) os << ",";
        os << "{" << jsonString("pid") << ":" << r.unschedulable[i].pid << ","
           << jsonString("reason") << ":" << jsonString(r.unschedulable[i].reason) << "}";
    }
    os << "],";

    os << jsonString("processes") << ":[";
    for (size_t i = 0; i < r.processes.size(); i++) {
        const Process& p = r.processes[i];
        if (i) os << ",";
        os << "{" << jsonString("pid") << ":" << p.pid << ","
           << jsonString("arrival") << ":" << p.arrival << ","
           << jsonString("burst") << ":" << p.burst << ","
           << jsonString("priority") << ":" << p.priority << ","
           << jsonString("start") << ":" << p.start << ","
           << jsonString("completion") << ":" << p.completion << ","
           << jsonString("turnaround") << ":" << p.turnaround << ","
           << jsonString("waiting") << ":" << p.waiting << ","
           << jsonString("response") << ":" << p.response << "}";
    }
    os << "],";

    os << jsonString("avgWaiting") << ":" << jsonNumber(r.avgWaiting) << ","
       << jsonString("avgTurnaround") << ":" << jsonNumber(r.avgTurnaround) << ","
       << jsonString("avgResponse") << ":" << jsonNumber(r.avgResponse) << ","
       << jsonString("throughput") << ":" << jsonNumber(r.throughput) << ","
       << jsonString("makespan") << ":" << r.makespan;
    os << "}";
    return os.str();
}

}  // namespace

int runScheduleCommand(std::istream& in) {
    std::string algorithm;
    int quantum = 0;
    in >> algorithm >> quantum;

    int n = 0;
    in >> n;
    std::vector<Process> orders;
    orders.reserve(n);
    for (int i = 0; i < n; i++) {
        Process p;
        in >> p.pid >> p.arrival >> p.burst >> p.priority >> p.machineType;
        orders.push_back(p);
    }

    int m = 0;
    in >> m;
    std::vector<Machine> machines(m);
    for (auto& machine : machines) in >> machine.id >> machine.capacity >> machine.type;

    int w = 0;
    in >> w;
    std::vector<Worker> workers(w);
    for (auto& worker : workers) in >> worker.id >> worker.type;

    ScheduleResult result = runSchedule(orders, machines, workers, algorithm, quantum);
    std::cout << scheduleToJson(result) << std::endl;
    return 0;
}
