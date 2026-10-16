// Rescheduler.h
// Member: Anmol Bhatt
// Description: Declares the Rescheduler class that handles dynamic
//              rescheduling when production conditions change mid-execution.
//              Scenarios that trigger a reschedule:
//                1. A new high-priority order arrives while others are running
//                2. A machine goes offline unexpectedly
//                3. A worker is put on leave during a running step
//                4. A deadline breach is detected early
//                5. Manual reschedule triggered by the factory manager via API
//
//              Rescheduling strategy:
//                - PREEMPTIVE: running process is paused, higher-priority takes over
//                - NON_PREEMPTIVE: current process finishes, new order inserted at front
//                - FULL_REORDER: entire ready queue is rebuilt with new algorithm

#ifndef RESCHEDULER_H
#define RESCHEDULER_H

#include <vector>
#include <string>
#include <memory>
#include <chrono>
#include "PCB.h"
#include "Scheduler.h"
#include "WaitQueue.h"

// ── Preemption record ─────────────────────────────────────────────────────────
// Created whenever a running process is preempted (paused before completion).
// Stored so the process can be resumed correctly with remaining_time intact.
struct PreemptionRecord {
    int         process_id;          // order_id of the preempted process
    int         remaining_time;      // minutes left when preemption happened
    int         completed_steps;     // how many production steps were done
    std::string preempted_at;        // ISO 8601 timestamp
    std::string reason;              // why it was preempted
    ProcessState state_before;       // state at time of preemption (always RUNNING)
    int         preempted_by;        // process_id of the process that took over (-1 if manual)
};

// ── RescheduleEvent: what triggered the reschedule ───────────────────────────
enum class RescheduleReason {
    NEW_HIGH_PRIORITY_ORDER,   // a new order arrived with priority < running process
    MACHINE_OFFLINE,           // assigned machine went OFFLINE / MAINTENANCE
    WORKER_UNAVAILABLE,        // assigned worker is no longer available
    DEADLINE_BREACH_IMMINENT,  // process will miss its deadline at current pace
    MANUAL_TRIGGER,            // factory manager explicitly triggered reschedule
    RESOURCE_SHORTAGE          // critical resource dropped below required units
};

// Utility: convert RescheduleReason to string
inline const char* rescheduleReasonToString(RescheduleReason r) {
    switch (r) {
        case RescheduleReason::NEW_HIGH_PRIORITY_ORDER:  return "NEW_HIGH_PRIORITY_ORDER";
        case RescheduleReason::MACHINE_OFFLINE:          return "MACHINE_OFFLINE";
        case RescheduleReason::WORKER_UNAVAILABLE:       return "WORKER_UNAVAILABLE";
        case RescheduleReason::DEADLINE_BREACH_IMMINENT: return "DEADLINE_BREACH_IMMINENT";
        case RescheduleReason::MANUAL_TRIGGER:           return "MANUAL_TRIGGER";
        case RescheduleReason::RESOURCE_SHORTAGE:        return "RESOURCE_SHORTAGE";
        default:                                         return "UNKNOWN";
    }
}

// ── RescheduleStrategy: how to handle the reschedule ─────────────────────────
enum class RescheduleStrategy {
    PREEMPTIVE,       // pause running process, give CPU to higher-priority process
    NON_PREEMPTIVE,   // let running process finish, re-order the ready queue
    FULL_REORDER      // rebuild the entire schedule from scratch
};

// ── RescheduleResult: outcome of a reschedule operation ──────────────────────
struct RescheduleResult {
    bool                        success;
    RescheduleReason            reason;
    RescheduleStrategy          strategy_used;
    std::string                 triggered_at;
    std::shared_ptr<PCB>        preempted_process;   // nullptr if non-preemptive
    std::shared_ptr<PCB>        new_running_process; // process that took over
    std::vector<int>            new_queue_order;     // order_ids in new queue order
    std::string                 message;
};

// ── Rescheduler class ─────────────────────────────────────────────────────────
class Rescheduler {
public:
    explicit Rescheduler(Scheduler& scheduler, WaitQueue& waitQueue);
    ~Rescheduler() = default;

    // Main entry point — called whenever a reschedule trigger is detected
    // @param reason        why reschedule is needed
    // @param strategy      how to handle it
    // @param allProcesses  full list of active PCBs (ready + running + waiting)
    // @param triggerPid    process_id that caused the trigger (-1 if external)
    RescheduleResult reschedule(
        RescheduleReason reason,
        RescheduleStrategy strategy,
        std::vector<std::shared_ptr<PCB>>& allProcesses,
        int triggerPid = -1);

    // ── Preemption ────────────────────────────────────────────────────────────

    // Preempt the currently running process
    // Returns the PreemptionRecord for the paused process
    PreemptionRecord preemptRunning(std::shared_ptr<PCB> runningProcess,
                                    const std::string& reason,
                                    int preempted_by_pid = -1);

    // Resume a previously preempted process (puts it back in ready queue
    // with its remaining_time as burst_time for correct SJF ordering)
    void resumePreempted(const PreemptionRecord& record);

    // Get all preemption records (for audit log + reports)
    const std::vector<PreemptionRecord>& getPreemptionHistory() const;

    // ── Deadline monitoring ───────────────────────────────────────────────────

    // Check all processes and flag those likely to miss their deadline
    // Returns list of process_ids at risk
    std::vector<int> checkDeadlineBreaches(
        const std::vector<std::shared_ptr<PCB>>& processes,
        int current_time_minutes) const;

    // ── Dynamic priority adjustment ───────────────────────────────────────────

    // Boost priority of a process that is close to missing its deadline
    // (aging mechanism — prevents starvation of low-priority processes)
    void applyAgingBoost(std::vector<std::shared_ptr<PCB>>& processes,
                         int waiting_threshold_minutes = 30);

    // ── History ───────────────────────────────────────────────────────────────

    // Get all reschedule events (for dashboard + reports)
    const std::vector<RescheduleResult>& getRescheduleHistory() const;

    // Clear reschedule history (called at start of new scheduling session)
    void clearHistory();

private:
    Scheduler&   scheduler_;
    WaitQueue&   waitQueue_;

    std::vector<PreemptionRecord>  preemptionHistory_;
    std::vector<RescheduleResult>  rescheduleHistory_;

    // Internal: handle PREEMPTIVE strategy
    RescheduleResult handlePreemptive(
        std::vector<std::shared_ptr<PCB>>& allProcesses,
        int triggerPid,
        RescheduleReason reason);

    // Internal: handle NON_PREEMPTIVE strategy
    RescheduleResult handleNonPreemptive(
        std::vector<std::shared_ptr<PCB>>& allProcesses,
        RescheduleReason reason);

    // Internal: handle FULL_REORDER strategy
    RescheduleResult handleFullReorder(
        std::vector<std::shared_ptr<PCB>>& allProcesses,
        RescheduleReason reason);

    // Internal: get current ISO 8601 timestamp
    static std::string currentTimestamp();
};

#endif // RESCHEDULER_H
