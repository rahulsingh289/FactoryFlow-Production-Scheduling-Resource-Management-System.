// WaitQueue.h
// Member: Karan Singh
// Description: Declares the WaitQueue class that holds processes blocked on
//              unavailable machines or workers. When a machine/worker becomes
//              free, the WaitQueue promotes the highest-priority waiting
//              process back to the Scheduler's ready queue.
//
//              This directly mirrors the OS concept of a device wait queue —
//              processes block on I/O (here: machine/worker availability)
//              and are woken up when the resource is released.

#ifndef WAIT_QUEUE_H
#define WAIT_QUEUE_H

#include <queue>
#include <vector>
#include <unordered_map>
#include <memory>
#include <string>
#include "PCB.h"

// ── WaitEntry: one slot in the wait queue ─────────────────────────────────────
// Records WHY a process is waiting and WHAT it needs to proceed
struct WaitEntry {
    std::shared_ptr<PCB> process;        // the blocked process
    int                  resource_id;    // machine_id or worker_id it is waiting for
    std::string          resource_type;  // "MACHINE" | "WORKER"
    int                  units_needed;   // units of that resource required
    long long            wait_start_ms;  // epoch ms when process entered wait state
                                         // (used to calculate total wait time)
};

// Comparator: highest-priority process (lowest priority number) wakes up first
struct WaitEntryComparator {
    bool operator()(const WaitEntry& a, const WaitEntry& b) const {
        // Tie-break on wait_start_ms: longer-waiting process gets priority
        if (a.process->priority == b.process->priority)
            return a.wait_start_ms > b.wait_start_ms;
        return a.process->priority > b.process->priority;
    }
};

// ── MachineAssignment: tracks which process is using which machine ─────────────
struct MachineAssignment {
    int machine_id;
    int order_id;          // FK to production_orders
    int step_id;           // FK to production_steps
    std::string assigned_at;   // ISO timestamp
    std::string expected_end;  // estimated completion time
    bool        is_active;
};

// ── WorkerAssignment: tracks which process a worker is assigned to ─────────────
struct WorkerAssignment {
    int worker_id;
    int order_id;
    int step_id;
    std::string assigned_at;
    std::string released_at;
    bool        is_active;
};

// ── WaitQueue class ───────────────────────────────────────────────────────────
class WaitQueue {
public:
    WaitQueue() = default;
    ~WaitQueue() = default;

    // Add a process to the wait queue (called when machine/worker is unavailable)
    void enqueue(std::shared_ptr<PCB> process,
                 int resource_id,
                 const std::string& resource_type,
                 int units_needed);

    // Called when a machine/worker is freed — returns all processes
    // that were waiting for that specific resource_id
    std::vector<std::shared_ptr<PCB>> notifyResourceFree(int resource_id,
                                                          int units_available);

    // Peek at the next process to wake up (highest priority in wait queue)
    const WaitEntry* peekNext() const;

    // Remove and return the highest-priority waiting entry
    WaitEntry dequeueNext();

    // Check if a specific process is currently in the wait queue
    bool isWaiting(int process_id) const;

    // Remove a process from the wait queue (e.g., if terminated externally)
    bool removeProcess(int process_id);

    // Get all entries waiting for a specific resource
    std::vector<WaitEntry> getWaitingForResource(int resource_id) const;

    // Get snapshot of entire wait queue for dashboard display
    std::vector<WaitEntry> getSnapshot() const;

    // Number of processes currently waiting
    int size() const;

    // True if no processes are waiting
    bool isEmpty() const;

    // Calculate how long a process has been waiting (in seconds)
    long long getWaitDurationSeconds(int process_id) const;

private:
    // Priority queue: highest-priority process at front
    std::priority_queue<WaitEntry,
                        std::vector<WaitEntry>,
                        WaitEntryComparator> queue_;

    // Fast lookup: process_id -> WaitEntry (for isWaiting / removeProcess)
    std::unordered_map<int, WaitEntry> processMap_;

    // Get current epoch milliseconds
    static long long nowMs();
};

#endif // WAIT_QUEUE_H
