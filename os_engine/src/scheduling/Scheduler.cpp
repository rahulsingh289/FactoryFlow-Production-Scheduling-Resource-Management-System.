// Scheduler.cpp
// Member: Aman Singh Rawat
// Description: Implementation of Scheduler class.
//              Handles ready queue management and FCFS / SJF / Priority algorithms.

#include "../../include/Scheduler.h"
#include <algorithm>
#include <stdexcept>

// ── Comparator implementations ───────────────────────────────────────────────

bool SJFComparator::operator()(const std::shared_ptr<PCB>& a,
                                const std::shared_ptr<PCB>& b) const {
    // Shorter burst time = higher priority in queue
    return a->burst_time > b->burst_time;
}

bool PriorityComparator::operator()(const std::shared_ptr<PCB>& a,
                                     const std::shared_ptr<PCB>& b) const {
    // Lower priority number = more urgent
    return a->priority > b->priority;
}

// ── Scheduler constructor ─────────────────────────────────────────────────────

Scheduler::Scheduler(SchedulingAlgorithm algo)
    : algorithm_(algo) {}

// ── Public methods ────────────────────────────────────────────────────────────

void Scheduler::addProcess(std::shared_ptr<PCB> process) {
    if (!process) {
        throw std::invalid_argument("Cannot add null process to scheduler");
    }
    process->state = ProcessState::READY;
    readyQueue_.push_back(process);
    sortQueue();
}

std::shared_ptr<PCB> Scheduler::peekNext() const {
    if (readyQueue_.empty()) return nullptr;
    return readyQueue_.front();
}

std::shared_ptr<PCB> Scheduler::dispatchNext() {
    if (readyQueue_.empty()) return nullptr;
    auto process = readyQueue_.front();
    readyQueue_.erase(readyQueue_.begin());
    process->state = ProcessState::RUNNING;
    return process;
}

void Scheduler::setAlgorithm(SchedulingAlgorithm algo) {
    algorithm_ = algo;
    sortQueue(); // re-sort existing queue with new algorithm
}

SchedulingAlgorithm Scheduler::getAlgorithm() const {
    return algorithm_;
}

std::string Scheduler::getAlgorithmName() const {
    switch (algorithm_) {
        case SchedulingAlgorithm::FCFS:     return "FCFS";
        case SchedulingAlgorithm::SJF:      return "SJF";
        case SchedulingAlgorithm::PRIORITY: return "PRIORITY";
        default:                            return "UNKNOWN";
    }
}

int Scheduler::queueSize() const {
    return static_cast<int>(readyQueue_.size());
}

bool Scheduler::isEmpty() const {
    return readyQueue_.empty();
}

std::vector<std::shared_ptr<PCB>> Scheduler::getQueueSnapshot() const {
    return readyQueue_; // returns a copy
}

void Scheduler::calculateMetrics() {
    // Simple non-preemptive metric calculation
    // waiting_time    = sum of time each process spent in READY state before dispatch
    // turnaround_time = waiting_time + execution_time
    int current_time = 0;
    for (auto& p : readyQueue_) {
        // arrival_time offset would be used here in a real simulation
        p->waiting_time    = current_time;
        p->turnaround_time = current_time + p->execution_time;
        current_time      += p->execution_time;
    }
}

// ── Private helpers ───────────────────────────────────────────────────────────

void Scheduler::sortQueue() {
    switch (algorithm_) {
        case SchedulingAlgorithm::FCFS:
            // Sort by arrival_time ascending
            std::sort(readyQueue_.begin(), readyQueue_.end(),
                [](const std::shared_ptr<PCB>& a, const std::shared_ptr<PCB>& b) {
                    return a->arrival_time < b->arrival_time;
                });
            break;

        case SchedulingAlgorithm::SJF:
            // Sort by burst_time ascending (shortest job first)
            std::sort(readyQueue_.begin(), readyQueue_.end(),
                [](const std::shared_ptr<PCB>& a, const std::shared_ptr<PCB>& b) {
                    return a->burst_time < b->burst_time;
                });
            break;

        case SchedulingAlgorithm::PRIORITY:
            // Sort by priority ascending (1 = most urgent)
            std::sort(readyQueue_.begin(), readyQueue_.end(),
                [](const std::shared_ptr<PCB>& a, const std::shared_ptr<PCB>& b) {
                    return a->priority < b->priority;
                });
            break;
    }
}
