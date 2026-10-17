#ifndef SCHEDULER_H
#define SCHEDULER_H

#include <string>
using namespace std;
#include <vector>

enum class ProcessState { Ready, Running, Completed, Blocked };

struct ProductionOrder {
    int id{};
    string product;
    int quantity{};
    int arrivalTime{};
    int executionTime{};
    int priority{}; // 1 = highest priority
    int deadline{};
    string requiredMachine;
    ProcessState state{ProcessState::Ready};
};

struct ScheduledOrder {
    ProductionOrder order;
    int startTime{};
    int completionTime{};
    int waitingTime{};
    bool missedDeadline{};
};

string stateToString(ProcessState state);
vector<ScheduledOrder> scheduleOrders(vector<ProductionOrder> orders,
                                      const string& algorithm);
void printSchedule(const vector<ScheduledOrder>& schedule);

#endif
