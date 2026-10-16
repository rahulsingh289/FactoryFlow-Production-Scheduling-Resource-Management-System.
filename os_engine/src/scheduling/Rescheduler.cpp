// Rescheduler.cpp
// Member: Anmol Bhatt
// Description: Implementation of Rescheduler.
//              Handles dynamic rescheduling, process preemption/resumption,
//              deadline breach detection, and priority aging.

#include "../../include/Rescheduler.h"
#include <algorithm>
#include <sstream>
#include <chrono>
#include <iomanip>
#include <ctime>

// ── Constructor ───────────────────────────────────────────────────────────────
Rescheduler::Rescheduler(Scheduler& scheduler, WaitQueue& waitQueue)
    : scheduler_(scheduler), waitQueue_(waitQueue) {}

// ── reschedule: main entry point ──────────────────────────────────────────────
RescheduleResult Rescheduler::reschedule(
    RescheduleReason reason,
    RescheduleStrategy strategy,
    std::vector<std::shared_ptr<PCB>>& allProcesses,
    int triggerPid)
{
    RescheduleResult result;
    result.triggered_at = currentTimestamp();
    result.reason       = reason;

    switch (strategy) {
        case RescheduleStrategy::PREEMPTIVE:
            result = handlePreemptive(allProcesses, triggerPid, reason);
            break;
        case RescheduleStrategy::NON_PREEMPTIVE:
            result = handleNonPreemptive(allProcesses, reason);
            break;
        case RescheduleStrategy::FULL_REORDER:
            result = handleFullReorder(allProcesses, reason);
            break;
    }

    result.strategy_used = strategy;
    result.triggered_at  = currentTimestamp();
    rescheduleHistory_.push_back(result);
    return result;
}

// ── preemptRunning ────────────────────────────────────────────────────────────
PreemptionRecord Rescheduler::preemptRunning(
    std::shared_ptr<PCB> runningProcess,
    const std::string& reason,
    int preempted_by_pid)
{
    PreemptionRecord record;
    record.process_id      = runningProcess->process_id;
    record.remaining_time  = runningProcess->remaining_time;
    record.completed_steps = 0; // updated by caller with actual step count
    record.preempted_at    = currentTimestamp();
    record.reason          = reason;
    record.state_before    = runningProcess->state;
    record.preempted_by    = preempted_by_pid;

    // Move process back to READY state with remaining time as new burst
    runningProcess->state      = ProcessState::READY;
    runningProcess->burst_time = runningProcess->remaining_time;

    preemptionHistory_.push_back(record);
    return record;
}

// ── resumePreempted ───────────────────────────────────────────────────────────
void Rescheduler::resumePreempted(const PreemptionRecord& record) {
    // The process is already in the ready queue with remaining_time as burst_time
    // Nothing additional needed — Scheduler::dispatchNext() will pick it up
    // based on its priority/burst_time in the next scheduling cycle
}

// ── getPreemptionHistory ──────────────────────────────────────────────────────
const std::vector<PreemptionRecord>& Rescheduler::getPreemptionHistory() const {
    return preemptionHistory_;
}

// ── checkDeadlineBreaches ─────────────────────────────────────────────────────
std::vector<int> Rescheduler::checkDeadlineBreaches(
    const std::vector<std::shared_ptr<PCB>>& processes,
    int current_time_minutes) const
{
    std::vector<int> atRisk;

    for (const auto& p : processes) {
        if (p->state == ProcessState::COMPLETED ||
            p->state == ProcessState::TERMINATED) continue;

        // Convert deadline to minutes from epoch for comparison
        auto deadline_epoch = std::chrono::system_clock::to_time_t(p->deadline);
        auto now_epoch      = std::chrono::system_clock::to_time_t(
                                  std::chrono::system_clock::now());
        int minutes_to_deadline = static_cast<int>(
            (deadline_epoch - now_epoch) / 60);

        // At risk if remaining_time exceeds time left before deadline
        if (p->remaining_time > minutes_to_deadline) {
            atRisk.push_back(p->process_id);
        }
    }
    return atRisk;
}

// ── applyAgingBoost ───────────────────────────────────────────────────────────
void Rescheduler::applyAgingBoost(
    std::vector<std::shared_ptr<PCB>>& processes,
    int waiting_threshold_minutes)
{
    for (auto& p : processes) {
        if (p->state != ProcessState::READY &&
            p->state != ProcessState::WAITING) continue;

        // If process has waited longer than threshold, boost priority by 1
        // (lower number = higher priority, so we subtract 1, min is 1)
        if (p->waiting_time >= waiting_threshold_minutes && p->priority > 1) {
            p->priority -= 1;
        }
    }
    // Re-sort the scheduler queue after aging adjustments
    // This is handled by Scheduler::setAlgorithm() or next dispatch cycle
}

// ── getRescheduleHistory / clearHistory ───────────────────────────────────────
const std::vector<RescheduleResult>& Rescheduler::getRescheduleHistory() const {
    return rescheduleHistory_;
}

void Rescheduler::clearHistory() {
    preemptionHistory_.clear();
    rescheduleHistory_.clear();
}

// ── Private: handlePreemptive ─────────────────────────────────────────────────
RescheduleResult Rescheduler::handlePreemptive(
    std::vector<std::shared_ptr<PCB>>& allProcesses,
    int triggerPid,
    RescheduleReason reason)
{
    RescheduleResult result;
    result.success = false;
    result.reason  = reason;

    // Find the currently running process
    std::shared_ptr<PCB> running = nullptr;
    for (auto& p : allProcesses) {
        if (p->state == ProcessState::RUNNING) { running = p; break; }
    }

    // Find the trigger process (the higher-priority newcomer)
    std::shared_ptr<PCB> trigger = nullptr;
    if (triggerPid != -1) {
        for (auto& p : allProcesses) {
            if (p->process_id == triggerPid) { trigger = p; break; }
        }
    }

    // Only preempt if trigger has strictly higher priority than running
    if (running && trigger &&
        trigger->priority < running->priority)
    {
        // Preempt the running process — moves it back to READY
        auto record = preemptRunning(running,
            rescheduleReasonToString(reason), triggerPid);

        // Add preempted process back to the scheduler ready queue
        scheduler_.addProcess(running);

        result.success           = true;
        result.preempted_process = running;
        result.new_running_process = trigger;
        result.message = "Process " + std::to_string(running->process_id) +
                         " preempted by " + std::to_string(trigger->process_id);
    } else {
        result.message = "No preemption needed — running process has equal or higher priority";
    }

    // Populate new queue order snapshot
    auto snapshot = scheduler_.getQueueSnapshot();
    for (const auto& p : snapshot) {
        result.new_queue_order.push_back(p->process_id);
    }

    return result;
}

// ── Private: handleNonPreemptive ──────────────────────────────────────────────
RescheduleResult Rescheduler::handleNonPreemptive(
    std::vector<std::shared_ptr<PCB>>& allProcesses,
    RescheduleReason reason)
{
    RescheduleResult result;
    result.success = true;
    result.reason  = reason;
    result.message = "Non-preemptive reschedule: queue reordered, running process continues";

    // The running process is not disturbed — just re-sort the ready queue
    // Scheduler::setAlgorithm triggers a re-sort
    scheduler_.setAlgorithm(scheduler_.getAlgorithm());

    auto snapshot = scheduler_.getQueueSnapshot();
    for (const auto& p : snapshot) {
        result.new_queue_order.push_back(p->process_id);
    }
    return result;
}

// ── Private: handleFullReorder ────────────────────────────────────────────────
RescheduleResult Rescheduler::handleFullReorder(
    std::vector<std::shared_ptr<PCB>>& allProcesses,
    RescheduleReason reason)
{
    RescheduleResult result;
    result.reason = reason;

    // Collect all non-RUNNING, non-terminal processes and re-add to scheduler
    // (Running process is paused first)
    std::shared_ptr<PCB> running = nullptr;
    for (auto& p : allProcesses) {
        if (p->state == ProcessState::RUNNING) { running = p; break; }
    }

    if (running) {
        preemptRunning(running, "FULL_REORDER", -1);
        scheduler_.addProcess(running);
    }

    // Re-add all READY processes to force a fresh sort
    scheduler_.setAlgorithm(scheduler_.getAlgorithm());

    auto snapshot = scheduler_.getQueueSnapshot();
    for (const auto& p : snapshot) {
        result.new_queue_order.push_back(p->process_id);
    }

    result.success = true;
    result.message = "Full schedule rebuild completed — "
                   + std::to_string(result.new_queue_order.size())
                   + " processes reordered";
    return result;
}

// ── Private: currentTimestamp ─────────────────────────────────────────────────
std::string Rescheduler::currentTimestamp() {
    auto now      = std::chrono::system_clock::now();
    auto now_t    = std::chrono::system_clock::to_time_t(now);
    std::ostringstream oss;
    oss << std::put_time(std::gmtime(&now_t), "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}
