#include "bankers/safety.h"

Matrix computeNeed(const Matrix& maximum, const Matrix& allocation, int resources) {
    int n = static_cast<int>(allocation.size());
    Matrix need(n, Vector(resources, 0));
    for (int i = 0; i < n; i++)
        for (int j = 0; j < resources; j++)
            need[i][j] = maximum[i][j] - allocation[i][j];
    return need;
}

bool isSafe(const Vector& available, const Matrix& allocation, const Matrix& need, std::vector<int>& sequence) {
    int n = static_cast<int>(allocation.size());
    int m = static_cast<int>(available.size());
    Vector work = available;
    std::vector<bool> finish(n, false);
    sequence.clear();

    int count = 0;
    while (count < n) {
        bool progressed = false;
        for (int i = 0; i < n; i++) {
            if (finish[i]) continue;
            bool canRun = true;
            for (int j = 0; j < m; j++)
                if (need[i][j] > work[j]) { canRun = false; break; }
            if (canRun) {
                for (int j = 0; j < m; j++) work[j] += allocation[i][j];
                finish[i] = true;
                sequence.push_back(i);
                progressed = true;
                count++;
            }
        }
        if (!progressed) break;  // no process could run -> unsafe
    }
    return count == n;
}

void recordSafety(BankersResult& result, const Vector& available, const Matrix& allocation,
                  const std::vector<int>& pids) {
    std::vector<int> rows;
    result.safe = isSafe(available, allocation, result.need, rows);
    for (int row : rows) result.sequence.push_back(pids[row]);
}
