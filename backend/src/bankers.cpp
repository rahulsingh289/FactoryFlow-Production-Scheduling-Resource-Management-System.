
#include "bankers.h"

#include <array>
#include <iostream>
#include <unordered_map>
#include <vector>
#include <string>

using namespace std;

const int R = 3; // CNC, Workers, Robots

struct ResourceData {
    array<int, R> allocation;
    array<int, R> maximum;
};

using Resources = array<int, R>;

void runBankersAlgorithm(const vector<ProductionOrder>& orders) {
    // Demo data mapped to your real production order IDs.
    unordered_map<int, ResourceData> data = {
        {101, {{0, 1, 0}, {7, 5, 3}}},
        {102, {{2, 0, 0}, {3, 2, 2}}},
        {103, {{3, 0, 2}, {9, 0, 2}}},
        {104, {{2, 1, 1}, {2, 2, 2}}},
        {105, {{0, 0, 2}, {4, 3, 3}}}
    };

    Resources available = {3, 3, 2};

    int n = static_cast<int>(orders.size());

    vector<Resources> allocation(n);
    vector<Resources> maximum(n);
    vector<Resources> need(n);

    // Match resource data to the actual orders.
    for (int i = 0; i < n; i++) {
        auto it = data.find(orders[i].id);

        if (it == data.end()) {
            cout << "Missing resource data for order "
                 << orders[i].id << ".\n";
            return;
        }

        allocation[i] = it->second.allocation;
        maximum[i] = it->second.maximum;

        for (int j = 0; j < R; j++) {
            if (maximum[i][j] < allocation[i][j]) {
                cout << "Invalid resource data for order "
                     << orders[i].id << ".\n";
                return;
            }

            need[i][j] = maximum[i][j] - allocation[i][j];
        }
    }

    auto findSafeSequence = [&](vector<int>& sequence) {
        Resources work = available;
        vector<bool> finished(n, false);

        sequence.clear();

        while (static_cast<int>(sequence.size()) < n) {
            bool found = false;

            for (int i = 0; i < n; i++) {
                if (finished[i]) {
                    continue;
                }

                bool canFinish = true;

                for (int j = 0; j < R; j++) {
                    if (need[i][j] > work[j]) {
                        canFinish = false;
                        break;
                    }
                }

                if (canFinish) {
                    for (int j = 0; j < R; j++) {
                        work[j] += allocation[i][j];
                    }

                    finished[i] = true;
                    sequence.push_back(i);
                    found = true;
                }
            }

            if (!found) {
                return false;
            }
        }

        return true;
    };

    cout << "\n=== BANKER'S ALGORITHM ===\n";
    cout << "Resources: CNC Machines, Workers, Robots\n\n";

    cout << "Order  Allocation   Maximum      Need\n";
    cout << "-------------------------------------------\n";

    for (int i = 0; i < n; i++) {
        cout << orders[i].id << "     ";

        for (int x : allocation[i]) cout << x << ' ';
        cout << "       ";

        for (int x : maximum[i]) cout << x << ' ';
        cout << "       ";

        for (int x : need[i]) cout << x << ' ';

        cout << '\n';
    }

    cout << "\nAvailable: ";
    for (int x : available) cout << x << ' ';
    cout << '\n';

    vector<int> sequence;

    if (findSafeSequence(sequence)) {
        cout << "\nSystem status: SAFE\n";
        cout << "Safe sequence: ";

        for (int i = 0; i < static_cast<int>(sequence.size()); i++) {
            cout << orders[sequence[i]].id;

            if (i + 1 < static_cast<int>(sequence.size())) {
                cout << " -> ";
            }
        }

        cout << '\n';
    } else {
        cout << "\nSystem status: UNSAFE\n";
        cout << "No safe sequence exists.\n";
    }

    // Optional resource-request test.
    char choice;
    cout << "\nTest a resource request? (y/n): ";
    cin >> choice;

    if (choice != 'y' && choice != 'Y') {
        return;
    }

    int orderId;
    cout << "Enter production order ID (101-105): ";

    if (!(cin >> orderId)) {
        cout << "Invalid order ID.\n";
        return;
    }

    int index = -1;

    for (int i = 0; i < n; i++) {
        if (orders[i].id == orderId) {
            index = i;
            break;
        }
    }

    if (index == -1) {
        cout << "Order not found.\n";
        return;
    }

    Resources request{};

    cout << "Enter requested CNC, Workers, Robots: ";

    for (int j = 0; j < R; j++) {
        if (!(cin >> request[j]) || request[j] < 0) {
            cout << "Invalid request.\n";
            return;
        }
    }

    for (int j = 0; j < R; j++) {
        if (request[j] > need[index][j]) {
            cout << "REJECTED: request exceeds remaining need.\n";
            return;
        }

        if (request[j] > available[j]) {
            cout << "WAIT: insufficient available resources.\n";
            return;
        }
    }

    // Tentatively allocate the requested resources.
    for (int j = 0; j < R; j++) {
        available[j] -= request[j];
        allocation[index][j] += request[j];
        need[index][j] -= request[j];
    }

    if (findSafeSequence(sequence)) {
        cout << "Request APPROVED: system remains safe.\n";
        cout << "Safe sequence: ";

        for (int i = 0; i < static_cast<int>(sequence.size()); i++) {
            cout << orders[sequence[i]].id;

            if (i + 1 < static_cast<int>(sequence.size())) {
                cout << " -> ";
            }
        }

        cout << '\n';
    } else {
        // Roll back if the tentative state is unsafe.
        for (int j = 0; j < R; j++) {
            available[j] += request[j];
            allocation[index][j] -= request[j];
            need[index][j] += request[j];
        }

        cout << "REJECTED: request would make the system unsafe.\n";
        cout << "Original allocation restored.\n";
    }
}
