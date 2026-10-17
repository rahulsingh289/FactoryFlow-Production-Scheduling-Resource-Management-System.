
#include "scheduler.h"

#include <algorithm>
#include <iostream>
#include <stdexcept>
#include <vector>

std::string stateToString(ProcessState state) {
    switch (state) {
        case ProcessState::Ready:
            return "Ready";
        case ProcessState::Running:
            return "Running";
        case ProcessState::Completed:
            return "Completed";
        case ProcessState::Blocked:
            return "Blocked";
    }

    return "Unknown";
}

std::vector<ScheduledOrder> scheduleOrders(
    std::vector<ProductionOrder> orders,
    const std::string& algorithm
) {
    if (algorithm != "FCFS" &&
        algorithm != "SJF" &&
        algorithm != "PRIORITY") {
        throw std::invalid_argument(
            "Algorithm must be FCFS, SJF, or PRIORITY"
        );
    }

    // Validate input orders.
    for (const auto& order : orders) {
        if (order.arrivalTime < 0 ||
            order.executionTime < 0 ||
            order.priority < 1 ||
            order.priority > 5) {
            throw std::invalid_argument(
                "Invalid order: check arrival time, execution time, "
                "and priority (1-5)"
            );
        }
    }

    const int n = static_cast<int>(orders.size());

    std::vector<bool> completed(n, false);
    std::vector<ScheduledOrder> result;

    int clock = 0;
    int completedCount = 0;

    while (completedCount < n) {
        int selected = -1;

        // Find an order that has already arrived.
        for (int i = 0; i < n; i++) {
            if (completed[i] ||
                orders[i].arrivalTime > clock) {
                continue;
            }

            if (selected == -1) {
                selected = i;
                continue;
            }

            const auto& current = orders[i];
            const auto& best = orders[selected];

            if (algorithm == "FCFS") {
                // Earlier arrival time wins.
                if (current.arrivalTime < best.arrivalTime) {
                    selected = i;
                }
            }
            else if (algorithm == "SJF") {
                // Shortest job among arrived orders.
                if (current.executionTime < best.executionTime ||
                    (current.executionTime == best.executionTime &&
                     current.arrivalTime < best.arrivalTime)) {
                    selected = i;
                }
            }
            else {
                // Smaller number means higher priority.
                if (current.priority < best.priority ||
                    (current.priority == best.priority &&
                     current.arrivalTime < best.arrivalTime)) {
                    selected = i;
                }
            }
        }

        // No order is ready: advance to the next arrival.
        if (selected == -1) {
            int nextArrival = -1;

            for (int i = 0; i < n; i++) {
                if (!completed[i] &&
                    (nextArrival == -1 ||
                     orders[i].arrivalTime < nextArrival)) {
                    nextArrival = orders[i].arrivalTime;
                }
            }

            if (nextArrival == -1) {
                break;
            }

            clock = std::max(clock, nextArrival);
            continue;
        }

        const ProductionOrder& order = orders[selected];

        int start = clock;
        int finish = start + order.executionTime;
        int waiting = start - order.arrivalTime;

        result.push_back({
            order,
            start,
            finish,
            waiting,
            finish > order.deadline
        });

        clock = finish;
        completed[selected] = true;
        completedCount++;
    }

    return result;
}

void printSchedule(const std::vector<ScheduledOrder>& schedule) {
    std::cout << "\nID  Product             Start  Finish  Wait  Deadline\n";
    std::cout << "-----------------------------------------------------\n";

    double totalWait = 0;

    for (const auto& item : schedule) {
        std::cout << item.order.id << "   "
                  << item.order.product;

        int padding =
            std::max(1, 20 - static_cast<int>(item.order.product.size()));

        for (int i = 0; i < padding; i++) {
            std::cout << ' ';
        }

        std::cout << item.startTime << "      "
                  << item.completionTime << "       "
                  << item.waitingTime << "     "
                  << (item.missedDeadline ? "MISSED" : "OK")
                  << '\n';

        totalWait += item.waitingTime;
    }

    if (!schedule.empty()) {
        std::cout << "\nAverage waiting time: "
                  << totalWait / schedule.size() << '\n';

        std::cout << "Orders scheduled: "
                  << schedule.size() << '\n';
    }
}
