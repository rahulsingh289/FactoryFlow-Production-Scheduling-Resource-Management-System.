// =========================================================================
//  Factory OS Engine  (C++17)
//  Smart Factory Production Scheduler: the Operating-System core.
//
//  The Node backend runs this program as a child process: it writes a small
//  plain-text request on stdin and reads a JSON reply on stdout. The
//  scheduling, Banker's Algorithm and deadlock logic is kept here, in C++.
//
//  Commands (argv[1]):
//    schedule   FCFS | SJF | SRTF | PRIORITY | PRIORITYP | RR
//    bankers    safe-state check + optional resource request
//    deadlock   deadlock detection
//
//  Layout:
//    commands/    read a request, call the algorithm, print JSON
//    scheduling/  the simulator, resources, results, and policies/ (one file per algorithm)
//    bankers/     the safety algorithm, request handling and deadlock detection
//    util/        JSON helpers
//
//  Build:  make          (see the Makefile in this folder)
//
//  Try it (2 machines of type 0, 1 worker who can run any machine):
//    printf "FCFS 0\n2\n1 0 5 2 0\n2 1 3 1 0\n2\n1 1 0\n2 1 0\n1\n7 -1\n" | ./factory_engine schedule
// =========================================================================

#include <iostream>
#include <string>

#include "commands/commands.h"

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << "usage: factory_engine <schedule|bankers|deadlock>\n";
        return 1;
    }
    std::string command = argv[1];
    if (command == "schedule") return runScheduleCommand(std::cin);
    if (command == "bankers")  return runBankersCommand(std::cin);
    if (command == "deadlock") return runDeadlockCommand(std::cin);
    std::cerr << "unknown command: " << command << "\n";
    return 1;
}
