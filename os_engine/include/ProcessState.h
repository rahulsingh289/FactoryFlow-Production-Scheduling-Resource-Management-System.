// ProcessState.h
// Member: Aman Singh Rawat
// Description: Defines all possible states a production process can be in,
//              mirroring OS process state transitions.

#ifndef PROCESS_STATE_H
#define PROCESS_STATE_H

// Enum representing every state a production order (process) can hold.
// Transition flow:
//   NEW -> READY -> RUNNING -> COMPLETED
//                           -> WAITING  -> READY (when resources free)
//                           -> TERMINATED (on cancel / error)
enum class ProcessState {
    NEW,         // Order created, not yet in the ready queue
    READY,       // In the ready queue, waiting for CPU (scheduler)
    RUNNING,     // Currently being executed on a machine
    WAITING,     // Blocked — waiting for a resource to become available
    COMPLETED,   // All production steps finished successfully
    TERMINATED   // Cancelled or failed before completion
};

// Utility: convert ProcessState enum to a human-readable string
inline const char* processStateToString(ProcessState state) {
    switch (state) {
        case ProcessState::NEW:        return "NEW";
        case ProcessState::READY:      return "READY";
        case ProcessState::RUNNING:    return "RUNNING";
        case ProcessState::WAITING:    return "WAITING";
        case ProcessState::COMPLETED:  return "COMPLETED";
        case ProcessState::TERMINATED: return "TERMINATED";
        default:                       return "UNKNOWN";
    }
}

// Utility: convert string back to ProcessState enum (used when reading from DB)
inline ProcessState stringToProcessState(const std::string& s) {
    if (s == "NEW")        return ProcessState::NEW;
    if (s == "READY")      return ProcessState::READY;
    if (s == "RUNNING")    return ProcessState::RUNNING;
    if (s == "WAITING")    return ProcessState::WAITING;
    if (s == "COMPLETED")  return ProcessState::COMPLETED;
    if (s == "TERMINATED") return ProcessState::TERMINATED;
    return ProcessState::TERMINATED; // fallback
}

#endif // PROCESS_STATE_H
