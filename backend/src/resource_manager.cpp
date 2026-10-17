
#include "resource_manager.h"

#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

using namespace std;

struct Machine {
    string name;
    string type;
    int availableAt;
};

struct Worker {
    string name;
    string skill;
    int availableAt;
};

void runResourceAllocation(
    const vector<ProductionOrder>& orders,
    const string& algorithm
) {
    vector<ScheduledOrder> schedule =
        scheduleOrders(orders, algorithm);

    vector<Machine> machines = {
        {"CNC-01", "CNC", 0},
        {"CNC-02", "CNC", 0},
        {"ASSEMBLY-01", "ASSEMBLY", 0}
    };

    vector<Worker> workers = {
        {"Ravi Kumar", "CNC", 0},
        {"Neha Sharma", "ASSEMBLY", 0}
    };

    cout << "\n=== RESOURCE ALLOCATION ===\n";

    cout << "\nOrder\tMachine\t\tWorker"
         << "\tStart\tFinish\tWaiting\n";

    for (const auto& item : schedule) {
        const ProductionOrder& order = item.order;

        int machineIndex = -1;

        for (int i = 0; i < (int)machines.size(); i++) {
            if (machines[i].name == order.requiredMachine) {
                machineIndex = i;
                break;
            }
        }

        if (machineIndex == -1) {
            cout << "Order " << order.id
                 << ": BLOCKED - machine not found\n";
            continue;
        }

        string requiredSkill = machines[machineIndex].type;
        int workerIndex = -1;
        int bestStart = -1;

        for (int i = 0; i < (int)workers.size(); i++) {
            if (workers[i].skill != requiredSkill) {
                continue;
            }

            int possibleStart = max(
                order.arrivalTime,
                max(
                    machines[machineIndex].availableAt,
                    workers[i].availableAt
                )
            );

            if (bestStart == -1 || possibleStart < bestStart) {
                bestStart = possibleStart;
                workerIndex = i;
            }
        }

        if (workerIndex == -1) {
            cout << "Order " << order.id
                 << ": BLOCKED - no compatible worker\n";
            continue;
        }

        int start = bestStart;
        int finish = start + order.executionTime;
        int waiting = start - order.arrivalTime;

        // Reserve machine and worker.
        machines[machineIndex].availableAt = finish;
        workers[workerIndex].availableAt = finish;

        cout << order.id << '\t'
             << machines[machineIndex].name << "\t\t"
             << workers[workerIndex].name << '\t'
             << start << '\t'
             << finish << '\t'
             << waiting << '\n';

        cout << "  Machine: BUSY during production; "
             << "AVAILABLE at time " << finish << '\n';
    }

    cout << "\nResource allocation simulation complete.\n";
}
