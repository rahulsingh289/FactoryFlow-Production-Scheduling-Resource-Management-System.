
#include "scheduler.h"
#include "bankers.h"
#include "resource_manager.h"

#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

// orderId, product, quantity, arrivalTime, executionTime,
// priority, deadline, requiredMachine, state

int main() {
    std::vector<ProductionOrder> orders = {
        {101, "Wooden Chair", 20, 0, 6, 2, 12,
         "CNC-01", ProcessState::Ready},

        {102, "Dining Table", 10, 1, 9, 3, 20,
         "CNC-02", ProcessState::Ready},

        {103, "Office Desk", 15, 2, 4, 1, 10,
         "CNC-01", ProcessState::Ready},

        {104, "Storage Cabinet", 8, 3, 7, 2, 18,
         "ASSEMBLY-01", ProcessState::Ready},

        {105, "Bookshelf", 12, 4, 3, 1, 11,
         "CNC-02", ProcessState::Ready}
    };

    int choice;

    std::cout << "\nSMART FACTORY PRODUCTION SCHEDULER\n";
    std::cout << "----------------------------------\n";
    std::cout << "1. FCFS Scheduling\n";
    std::cout << "2. SJF Scheduling\n";
    std::cout << "3. Priority Scheduling\n";
    std::cout << "4. Banker's Algorithm\n";
    std::cout << "5. Resource Allocation Simulation\n";
    std::cout << "Choose option: ";

    if (!(std::cin >> choice)) {
        std::cerr << "Error: Please enter a number.\n";
        return 1;
    }

    try {
        switch (choice) {
            case 1: {
                std::cout << "\nSelected algorithm: FCFS\n";

                std::vector<ScheduledOrder> schedule =
                    scheduleOrders(orders, "FCFS");

                printSchedule(schedule);
                break;
            }

            case 2: {
                std::cout << "\nSelected algorithm: SJF\n";

                std::vector<ScheduledOrder> schedule =
                    scheduleOrders(orders, "SJF");

                printSchedule(schedule);
                break;
            }

            case 3: {
                std::cout << "\nSelected algorithm: PRIORITY\n";

                std::vector<ScheduledOrder> schedule =
                    scheduleOrders(orders, "PRIORITY");

                printSchedule(schedule);
                break;
            }

            case 4: {
                std::cout << "\nSelected: BANKER'S ALGORITHM\n";

                runBankersAlgorithm(orders);
                break;
            }

            case 5: {
                std::cout << "\nRESOURCE ALLOCATION SIMULATION\n";
                std::cout << "------------------------------\n";
                std::cout << "Choose scheduling algorithm:\n";
                std::cout << "1. FCFS\n";
                std::cout << "2. SJF\n";
                std::cout << "3. Priority\n";
                std::cout << "Choice: ";

                int algorithmChoice;

                if (!(std::cin >> algorithmChoice)) {
                    std::cerr
                        << "Error: Please enter a number.\n";
                    return 1;
                }

                std::string algorithm;

                switch (algorithmChoice) {
                    case 1:
                        algorithm = "FCFS";
                        break;

                    case 2:
                        algorithm = "SJF";
                        break;

                    case 3:
                        algorithm = "PRIORITY";
                        break;

                    default:
                        std::cerr
                            << "Invalid algorithm. Choose 1, 2, or 3.\n";
                        return 1;
                }

                std::cout
                    << "\nSelected algorithm: " << algorithm << '\n';

                runResourceAllocation(orders, algorithm);
                break;
            }

            default:
                std::cerr
                    << "Invalid choice! Enter 1, 2, 3, 4, or 5.\n";
                return 1;
        }
    }
    catch (const std::exception& e) {
        std::cerr << "Error: " << e.what() << '\n';
        return 1;
    }

    return 0;
}
