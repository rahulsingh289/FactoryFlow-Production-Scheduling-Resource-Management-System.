#ifndef FACTORY_COMMANDS_COMMANDS_H
#define FACTORY_COMMANDS_COMMANDS_H

#include <istream>

// The three things the engine can be asked to do. Each reads a plain-text request from
// `in`, runs the algorithm, prints one line of JSON on stdout and returns the exit code.
int runScheduleCommand(std::istream& in);   // schedule  FCFS | SJF | SRTF | PRIORITY | PRIORITYP | RR
int runBankersCommand(std::istream& in);    // bankers   safe-state check + optional resource request
int runDeadlockCommand(std::istream& in);   // deadlock  deadlock detection

#endif
