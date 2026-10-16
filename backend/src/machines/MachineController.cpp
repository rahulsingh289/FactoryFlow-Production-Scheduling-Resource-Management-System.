// MachineController.cpp
// Member: Karan Singh
// Description: Implementation of MachineController.
//              Handles all machine CRUD operations, status updates,
//              and maintenance record management.

#include "../../include/machines/MachineController.h"
#include "../../include/db/DBConnection.h"
#include "../../include/utils/JsonHelper.h"
#include "../../include/utils/HttpResponse.h"
#include <string>

// ── GET /api/machines ─────────────────────────────────────────────────────────
Response MachineController::getAllMachines(const Request& req) {
    std::string statusFilter = req.getQueryParam("status");
    std::string typeFilter   = req.getQueryParam("type");

    DBConnection db;
    // TODO: query machines table with optional filters
    // Placeholder for 20% milestone
    return HttpResponse::ok("[]");
}

// ── GET /api/machines/:id ─────────────────────────────────────────────────────
Response MachineController::getMachineById(const Request& req) {
    int machine_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: fetch single machine row
    return HttpResponse::ok("{}");
}

// ── POST /api/machines ────────────────────────────────────────────────────────
Response MachineController::createMachine(const Request& req) {
    std::string err;
    if (!validateMachinePayload(req.body, err)) {
        return HttpResponse::badRequest(err);
    }
    DBConnection db;
    // TODO: insert into machines table, also register as resource
    return HttpResponse::created("{\"message\": \"Machine created\"}");
}

// ── PUT /api/machines/:id ─────────────────────────────────────────────────────
Response MachineController::updateMachine(const Request& req) {
    int machine_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: update machines row
    return HttpResponse::ok("{\"message\": \"Machine updated\"}");
}

// ── DELETE /api/machines/:id ──────────────────────────────────────────────────
Response MachineController::deleteMachine(const Request& req) {
    int machine_id = std::stoi(req.getPathParam("id"));
    // TODO: check machine is IDLE before deleting
    return HttpResponse::ok("{\"message\": \"Machine decommissioned\"}");
}

// ── PATCH /api/machines/:id/status ───────────────────────────────────────────
Response MachineController::updateMachineStatus(const Request& req) {
    int machine_id   = std::stoi(req.getPathParam("id"));
    std::string status = JsonHelper::getString(req.body, "status");

    const std::vector<std::string> valid = {"IDLE","BUSY","MAINTENANCE","OFFLINE"};
    bool isValid = false;
    for (const auto& s : valid) if (s == status) { isValid = true; break; }

    if (!isValid) {
        return HttpResponse::badRequest("Invalid status value. Must be IDLE|BUSY|MAINTENANCE|OFFLINE");
    }

    DBConnection db;
    // TODO: UPDATE machines SET status = ? WHERE machine_id = ?
    return HttpResponse::ok("{\"message\": \"Machine status updated to " + status + "\"}");
}

// ── GET /api/machines/:id/maintenance ────────────────────────────────────────
Response MachineController::getMaintenanceRecords(const Request& req) {
    int machine_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: SELECT * FROM maintenance_records WHERE machine_id = ?
    return HttpResponse::ok("[]");
}

// ── POST /api/machines/:id/maintenance ───────────────────────────────────────
Response MachineController::logMaintenance(const Request& req) {
    int machine_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: INSERT into maintenance_records, update machine last_serviced
    return HttpResponse::created("{\"message\": \"Maintenance record logged\"}");
}

// ── GET /api/machines/summary ─────────────────────────────────────────────────
Response MachineController::getMachineSummary(const Request& req) {
    DBConnection db;
    // TODO: SELECT COUNT(*) grouped by status FROM machines
    // Placeholder summary
    return HttpResponse::ok(
        "{\"total\":0,\"idle\":0,\"busy\":0,\"maintenance\":0,\"offline\":0}"
    );
}

// ── Private helpers ───────────────────────────────────────────────────────────
bool MachineController::validateMachinePayload(const std::string& body,
                                                std::string& err) {
    if (body.empty())                                    { err = "Body is empty"; return false; }
    if (body.find("machine_name") == std::string::npos)  { err = "machine_name required"; return false; }
    if (body.find("machine_type") == std::string::npos)  { err = "machine_type required"; return false; }
    return true;
}

std::string MachineController::dtoToJson(const MachineDTO& dto) {
    return "{\"machine_id\":"    + std::to_string(dto.machine_id)      +
           ",\"machine_name\":\"" + dto.machine_name                   + "\"" +
           ",\"machine_type\":\"" + dto.machine_type                   + "\"" +
           ",\"status\":\""       + dto.status                         + "\"" +
           ",\"location\":\""     + dto.location                       + "\"" +
           ",\"capacity_per_hr\":" + std::to_string(dto.capacity_per_hr) + "}";
}

std::string MachineController::dtosToJson(const std::vector<MachineDTO>& dtos) {
    std::string json = "[";
    for (size_t i = 0; i < dtos.size(); ++i) {
        json += dtoToJson(dtos[i]);
        if (i < dtos.size() - 1) json += ",";
    }
    return json + "]";
}

std::string MachineController::maintenanceDtoToJson(const MaintenanceDTO& dto) {
    return "{\"record_id\":"         + std::to_string(dto.record_id)    +
           ",\"machine_id\":"         + std::to_string(dto.machine_id)   +
           ",\"maintenance_type\":\"" + dto.maintenance_type             + "\"" +
           ",\"performed_by\":\""     + dto.performed_by                 + "\"" +
           ",\"started_at\":\""       + dto.started_at                   + "\"" +
           ",\"cost\":"               + std::to_string(dto.cost)         + "}";
}
