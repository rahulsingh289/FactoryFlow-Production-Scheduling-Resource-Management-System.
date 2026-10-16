// WorkerController.cpp
// Member: Karan Singh
// Description: Implementation of WorkerController.
//              Handles all worker CRUD, assignment/release, and skill-based
//              filtering. Integrates with MachineAssigner via the OS Engine.

#include "../../include/workers/WorkerController.h"
#include "../../include/db/DBConnection.h"
#include "../../include/utils/JsonHelper.h"
#include "../../include/utils/HttpResponse.h"
#include <string>

// ── GET /api/workers ──────────────────────────────────────────────────────────
Response WorkerController::getAllWorkers(const Request& req) {
    std::string statusFilter = req.getQueryParam("status");
    std::string shiftFilter  = req.getQueryParam("shift");
    std::string skillFilter  = req.getQueryParam("skill");

    DBConnection db;
    // TODO: SELECT from workers with optional WHERE clauses
    return HttpResponse::ok("[]");
}

// ── GET /api/workers/:id ──────────────────────────────────────────────────────
Response WorkerController::getWorkerById(const Request& req) {
    int worker_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: fetch single worker row
    return HttpResponse::ok("{}");
}

// ── POST /api/workers ─────────────────────────────────────────────────────────
Response WorkerController::createWorker(const Request& req) {
    std::string err;
    if (!validateWorkerPayload(req.body, err)) {
        return HttpResponse::badRequest(err);
    }
    DBConnection db;
    // TODO: INSERT into workers, also register as resource of type WORKER
    return HttpResponse::created("{\"message\": \"Worker created\"}");
}

// ── PUT /api/workers/:id ──────────────────────────────────────────────────────
Response WorkerController::updateWorker(const Request& req) {
    int worker_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: UPDATE workers row
    return HttpResponse::ok("{\"message\": \"Worker updated\"}");
}

// ── DELETE /api/workers/:id ───────────────────────────────────────────────────
Response WorkerController::deleteWorker(const Request& req) {
    int worker_id = std::stoi(req.getPathParam("id"));
    // Soft delete: set status = INACTIVE
    DBConnection db;
    // TODO: UPDATE workers SET status = 'INACTIVE' WHERE worker_id = ?
    return HttpResponse::ok("{\"message\": \"Worker deactivated\"}");
}

// ── PATCH /api/workers/:id/status ────────────────────────────────────────────
Response WorkerController::updateWorkerStatus(const Request& req) {
    int worker_id    = std::stoi(req.getPathParam("id"));
    std::string status = JsonHelper::getString(req.body, "status");

    const std::vector<std::string> valid = {"AVAILABLE","ASSIGNED","ON_LEAVE","INACTIVE"};
    bool isValid = false;
    for (const auto& s : valid) if (s == status) { isValid = true; break; }

    if (!isValid) {
        return HttpResponse::badRequest(
            "Invalid status. Must be AVAILABLE|ASSIGNED|ON_LEAVE|INACTIVE");
    }
    DBConnection db;
    // TODO: UPDATE workers SET status = ? WHERE worker_id = ?
    return HttpResponse::ok("{\"message\": \"Worker status updated to " + status + "\"}");
}

// ── POST /api/workers/assign ──────────────────────────────────────────────────
Response WorkerController::assignWorker(const Request& req) {
    int worker_id = JsonHelper::getInt(req.body, "worker_id");
    int order_id  = JsonHelper::getInt(req.body, "order_id");
    int step_id   = JsonHelper::getInt(req.body, "step_id");

    DBConnection db;
    // TODO: INSERT into worker_assignments, UPDATE workers SET status = 'ASSIGNED'
    return HttpResponse::created("{\"message\": \"Worker assigned successfully\"}");
}

// ── POST /api/workers/release ─────────────────────────────────────────────────
Response WorkerController::releaseWorker(const Request& req) {
    int worker_id = JsonHelper::getInt(req.body, "worker_id");
    int order_id  = JsonHelper::getInt(req.body, "order_id");

    DBConnection db;
    // TODO: UPDATE worker_assignments SET assignment_state = 'COMPLETED', released_at = NOW()
    //       UPDATE workers SET status = 'AVAILABLE', current_order_id = NULL
    return HttpResponse::ok("{\"message\": \"Worker released successfully\"}");
}

// ── GET /api/workers/assignments ─────────────────────────────────────────────
Response WorkerController::getAssignments(const Request& req) {
    int order_id  = std::stoi(req.getQueryParam("order_id",  "-1"));
    int worker_id = std::stoi(req.getQueryParam("worker_id", "-1"));
    std::string state = req.getQueryParam("state");

    DBConnection db;
    // TODO: SELECT from worker_assignments with filters
    return HttpResponse::ok("[]");
}

// ── GET /api/workers/summary ──────────────────────────────────────────────────
Response WorkerController::getWorkerSummary(const Request& req) {
    DBConnection db;
    // TODO: SELECT COUNT(*) grouped by status FROM workers
    return HttpResponse::ok(
        "{\"total\":0,\"available\":0,\"assigned\":0,\"on_leave\":0,\"inactive\":0}"
    );
}

// ── Private helpers ───────────────────────────────────────────────────────────
bool WorkerController::validateWorkerPayload(const std::string& body,
                                              std::string& err) {
    if (body.empty())                                      { err = "Body is empty"; return false; }
    if (body.find("first_name")    == std::string::npos)   { err = "first_name required"; return false; }
    if (body.find("last_name")     == std::string::npos)   { err = "last_name required"; return false; }
    if (body.find("employee_code") == std::string::npos)   { err = "employee_code required"; return false; }
    return true;
}

std::string WorkerController::dtoToJson(const WorkerDTO& dto) {
    return "{\"worker_id\":"       + std::to_string(dto.worker_id)  +
           ",\"first_name\":\""    + dto.first_name                 + "\"" +
           ",\"last_name\":\""     + dto.last_name                  + "\"" +
           ",\"employee_code\":\"" + dto.employee_code              + "\"" +
           ",\"skill_set\":\""     + dto.skill_set                  + "\"" +
           ",\"shift\":\""         + dto.shift                      + "\"" +
           ",\"status\":\""        + dto.status                     + "\"}";
}

std::string WorkerController::dtosToJson(const std::vector<WorkerDTO>& dtos) {
    std::string json = "[";
    for (size_t i = 0; i < dtos.size(); ++i) {
        json += dtoToJson(dtos[i]);
        if (i < dtos.size() - 1) json += ",";
    }
    return json + "]";
}

std::string WorkerController::assignmentDtoToJson(const WorkerAssignmentDTO& dto) {
    return "{\"assignment_id\":"      + std::to_string(dto.assignment_id) +
           ",\"worker_id\":"           + std::to_string(dto.worker_id)    +
           ",\"order_id\":"            + std::to_string(dto.order_id)     +
           ",\"assignment_state\":\"" + dto.assignment_state              + "\"}";
}
