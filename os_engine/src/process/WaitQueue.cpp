// WaitQueue.cpp
// Member: Karan Singh
// Description: Implementation of WaitQueue.
//              Handles process blocking on machine/worker unavailability
//              and promotion back to the ready queue when resources free up.

#include "../../include/WaitQueue.h"
#include <chrono>
#include <algorithm>
#include <stdexcept>

// ── enqueue ───────────────────────────────────────────────────────────────────
void WaitQueue::enqueue(std::shared_ptr<PCB> process,
                        int resource_id,
                        const std::string& resource_type,
                        int units_needed)
{
    if (!process) return;

    WaitEntry entry;
    entry.process       = process;
    entry.resource_id   = resource_id;
    entry.resource_type = resource_type;
    entry.units_needed  = units_needed;
    entry.wait_start_ms = nowMs();

    // Set the process state to WAITING
    process->state = ProcessState::WAITING;

    queue_.push(entry);
    processMap_[process->process_id] = entry;
}

// ── notifyResourceFree ────────────────────────────────────────────────────────
std::vector<std::shared_ptr<PCB>> WaitQueue::notifyResourceFree(
    int resource_id,
    int units_available)
{
    std::vector<std::shared_ptr<PCB>> woken;
    int remaining_units = units_available;

    // Rebuild queue excluding entries that can now be satisfied
    std::vector<WaitEntry> retained;
    std::priority_queue<WaitEntry,
                        std::vector<WaitEntry>,
                        WaitEntryComparator> newQueue;

    // Drain and inspect every entry
    while (!queue_.empty()) {
        WaitEntry entry = queue_.top();
        queue_.pop();

        if (entry.resource_id == resource_id &&
            entry.units_needed <= remaining_units)
        {
            // This process can now proceed
            remaining_units -= entry.units_needed;
            entry.process->state = ProcessState::READY;

            // Update waiting_time in the PCB
            long long waited_ms = nowMs() - entry.wait_start_ms;
            entry.process->waiting_time += static_cast<int>(waited_ms / 60000); // convert to minutes

            woken.push_back(entry.process);
            processMap_.erase(entry.process->process_id);
        } else {
            // Keep in queue
            newQueue.push(entry);
        }
    }

    queue_ = std::move(newQueue);
    return woken;
}

// ── peekNext ──────────────────────────────────────────────────────────────────
const WaitEntry* WaitQueue::peekNext() const {
    if (queue_.empty()) return nullptr;
    return &queue_.top();
}

// ── dequeueNext ───────────────────────────────────────────────────────────────
WaitEntry WaitQueue::dequeueNext() {
    if (queue_.empty()) {
        throw std::runtime_error("WaitQueue is empty");
    }
    WaitEntry top = queue_.top();
    queue_.pop();
    processMap_.erase(top.process->process_id);
    return top;
}

// ── isWaiting ─────────────────────────────────────────────────────────────────
bool WaitQueue::isWaiting(int process_id) const {
    return processMap_.find(process_id) != processMap_.end();
}

// ── removeProcess ─────────────────────────────────────────────────────────────
bool WaitQueue::removeProcess(int process_id) {
    if (processMap_.find(process_id) == processMap_.end()) return false;

    // Rebuild queue without the target process
    std::priority_queue<WaitEntry,
                        std::vector<WaitEntry>,
                        WaitEntryComparator> newQueue;
    while (!queue_.empty()) {
        WaitEntry entry = queue_.top();
        queue_.pop();
        if (entry.process->process_id != process_id) {
            newQueue.push(entry);
        }
    }
    queue_ = std::move(newQueue);
    processMap_.erase(process_id);
    return true;
}

// ── getWaitingForResource ─────────────────────────────────────────────────────
std::vector<WaitEntry> WaitQueue::getWaitingForResource(int resource_id) const {
    std::vector<WaitEntry> result;
    for (const auto& [pid, entry] : processMap_) {
        if (entry.resource_id == resource_id) {
            result.push_back(entry);
        }
    }
    return result;
}

// ── getSnapshot ───────────────────────────────────────────────────────────────
std::vector<WaitEntry> WaitQueue::getSnapshot() const {
    std::vector<WaitEntry> snapshot;
    snapshot.reserve(processMap_.size());
    for (const auto& [pid, entry] : processMap_) {
        snapshot.push_back(entry);
    }
    // Sort by priority then wait_start_ms for consistent display order
    std::sort(snapshot.begin(), snapshot.end(),
        [](const WaitEntry& a, const WaitEntry& b) {
            if (a.process->priority == b.process->priority)
                return a.wait_start_ms < b.wait_start_ms;
            return a.process->priority < b.process->priority;
        });
    return snapshot;
}

// ── size / isEmpty ────────────────────────────────────────────────────────────
int WaitQueue::size() const {
    return static_cast<int>(processMap_.size());
}

bool WaitQueue::isEmpty() const {
    return processMap_.empty();
}

// ── getWaitDurationSeconds ────────────────────────────────────────────────────
long long WaitQueue::getWaitDurationSeconds(int process_id) const {
    auto it = processMap_.find(process_id);
    if (it == processMap_.end()) return 0;
    return (nowMs() - it->second.wait_start_ms) / 1000;
}

// ── Private: nowMs ────────────────────────────────────────────────────────────
long long WaitQueue::nowMs() {
    return std::chrono::duration_cast<std::chrono::milliseconds>(
        std::chrono::system_clock::now().time_since_epoch()
    ).count();
}
