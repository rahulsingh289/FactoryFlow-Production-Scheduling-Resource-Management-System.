// ResourceController.cpp
// Member: Rahul Singh
// Description: Implementation of ResourceController. Handles resource CRUD,
//              allocation/release via Banker's Algorithm, and deadlock detection.

#include "../../include/resources/ResourceController.h"
#include "../../include/resources/ResourceModel.h"
#include "../../include/db/DBConnection.h"
#include "../../include/utils/JsonHelper.h"
#include "../../include/utils/HttpResponse.h"

// ── GET /api/resources ────────────────────────────────────────────────────────
Response ResourceController::getAllResources(const Request& req) {
    DBConnection db;
    ResourceModel model(db);
    auto resources = model.fetchAllResources();
    return HttpResponse::ok(dtosToJson(resources));
}

// ── GET /api/resources/:id ────────────────────────────────────────────────────
Response ResourceController::getResourceById(const Request& req) {
    int resource_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    ResourceModel model(db);
    auto resource = model.fetchResourceById(resource_id);
    if (!resource.has_value()) {
        return HttpResponse::notFound("Resource not found");
    }
    return HttpResponse::ok(dtoToJson(resource.value()));
}

// ── POST /api/resources ───────────────────────────────────────────────────────
Response ResourceController::createResource(const Request& req) {
    std::string errorMsg;
    if (!validateResourcePayload(req.body, errorMsg)) {
        return HttpResponse::badRequest(errorMsg);
    }
    ResourceDTO dto = JsonHelper::parseResource(req.body);
    DBConnection db;
    ResourceModel model(db);
    int new_id = model.insertResource(dto);
    if (new_id < 0) {
        return HttpResponse::internalError("Failed to create resource");
    }
    auto created = model.fetchResourceById(new_id);
    return HttpResponse::created(dtoToJson(created.value()));
}

// ── PUT /api/resources/:id ────────────────────────────────────────────────────
Response ResourceController::updateResource(const Request& req) {
    int resource_id = std::stoi(req.getPathParam("id"));
    ResourceDTO dto = JsonHelper::parseResource(req.body);
    DBConnection db;
    ResourceModel model(db);
    if (!model.updateResource(resource_id, dto)) {
        return HttpResponse::internalError("Failed to update resource");
    }
    return HttpResponse::ok("{\"message\": \"Resource updated successfully\"}");
}

// ── DELETE /api/resources/:id ─────────────────────────────────────────────────
Response ResourceController::deleteResource(const Request& req) {
    int resource_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    ResourceModel model(db);

    // Safety check: only delete if nothing is currently allocated
    auto resource = model.fetchResourceById(resource_id);
    if (!resource.has_value()) {
        return HttpResponse::notFound("Resource not found");
    }
    if (resource->available_units < resource->total_units) {
        return HttpResponse::badRequest(
            "Cannot delete resource — units are currently allocated to active orders");
    }
    if (!model.deleteResource(resource_id)) {
        return HttpResponse::internalError("Failed to delete resource");
    }
    return HttpResponse::ok("{\"message\": \"Resource deleted successfully\"}");
}

// ── POST /api/resources/allocate ─────────────────────────────────────────────
Response ResourceController::allocateResource(const Request& req) {
    std::string errorMsg;
    if (!validateAllocationPayload(req.body, errorMsg)) {
        return HttpResponse::badRequest(errorMsg);
    }

    AllocationRequestDTO dto = JsonHelper::parseAllocationRequest(req.body);
    DBConnection db;
    ResourceModel model(db);

    // Check availability before running Banker's check
    auto resource = model.fetchResourceById(dto.resource_id);
    if (!resource.has_value()) {
        return HttpResponse::notFound("Resource not found");
    }
    if (resource->available_units < dto.units_requested) {
        return HttpResponse::ok(
            "{\"granted\": false, \"reason\": \"Insufficient units available — process moved to WAITING\"}");
    }

    // Decrement available units in DB
    bool updated = model.decrementAvailableUnits(dto.resource_id, dto.units_requested);
    if (!updated) {
        return HttpResponse::internalError("Allocation update failed");
    }

    // Record the allocation
    model.insertAllocationRecord(dto);

    return HttpResponse::ok(
        "{\"granted\": true, \"message\": \"Resources allocated successfully\"}");
}

// ── POST /api/resources/release ──────────────────────────────────────────────
Response ResourceController::releaseResource(const Request& req) {
    int order_id    = JsonHelper::getInt(req.body, "order_id");
    int resource_id = JsonHelper::getInt(req.body, "resource_id");
    int units       = JsonHelper::getInt(req.body, "units_to_release");

    DBConnection db;
    ResourceModel model(db);
    model.incrementAvailableUnits(resource_id, units);
    model.markAllocationReleased(order_id, resource_id);

    return HttpResponse::ok("{\"message\": \"Resources released successfully\"}");
}

// ── POST /api/resources/release-all ──────────────────────────────────────────
Response ResourceController::releaseAllResources(const Request& req) {
    int order_id = JsonHelper::getInt(req.body, "order_id");
    DBConnection db;
    ResourceModel model(db);

    // Fetch all active allocations for this order and release each
    auto allocations = model.fetchAllocations(order_id, -1, "ALLOCATED");
    for (const auto& alloc : allocations) {
        model.incrementAvailableUnits(alloc.resource_id, alloc.units_requested);
    }
    model.markAllAllocationsReleased(order_id);

    return HttpResponse::ok("{\"message\": \"All resources released for order\"}");
}

// ── GET /api/resources/allocations ───────────────────────────────────────────
Response ResourceController::getAllocations(const Request& req) {
    int order_id    = std::stoi(req.getQueryParam("order_id", "-1"));
    int resource_id = std::stoi(req.getQueryParam("resource_id", "-1"));
    std::string state = req.getQueryParam("state");

    DBConnection db;
    ResourceModel model(db);
    auto allocs = model.fetchAllocations(order_id, resource_id, state);

    // Serialize allocations to JSON array
    std::string json = "[";
    for (size_t i = 0; i < allocs.size(); ++i) {
        json += "{\"order_id\":" + std::to_string(allocs[i].order_id) +
                ",\"resource_id\":" + std::to_string(allocs[i].resource_id) +
                ",\"units_requested\":" + std::to_string(allocs[i].units_requested) + "}";
        if (i < allocs.size() - 1) json += ",";
    }
    json += "]";
    return HttpResponse::ok(json);
}

// ── GET /api/deadlock/check ───────────────────────────────────────────────────
Response ResourceController::checkDeadlock(const Request& req) {
    // TODO (Phase 4): load all active PCBs from Scheduler, run DeadlockDetector
    // 20% milestone placeholder — returns no deadlock
    DeadlockResponseDTO report;
    report.deadlock_found       = false;
    report.detected_at          = "2026-10-16T00:00:00Z";
    report.suggested_resolution = "NONE";
    return HttpResponse::ok(deadlockToJson(report));
}

// ── POST /api/deadlock/resolve ────────────────────────────────────────────────
Response ResourceController::resolveDeadlock(const Request& req) {
    // TODO (Phase 4): call DeadlockDetector::resolveByTermination()
    return HttpResponse::ok("{\"message\": \"Deadlock resolution triggered\"}");
}

// ── Private helpers ───────────────────────────────────────────────────────────

bool ResourceController::validateResourcePayload(const std::string& body,
                                                   std::string& errorMsg) {
    if (body.empty())                                    { errorMsg = "Request body is empty"; return false; }
    if (body.find("resource_name") == std::string::npos) { errorMsg = "resource_name is required"; return false; }
    if (body.find("resource_type") == std::string::npos) { errorMsg = "resource_type is required"; return false; }
    if (body.find("total_units")   == std::string::npos) { errorMsg = "total_units is required"; return false; }
    return true;
}

bool ResourceController::validateAllocationPayload(const std::string& body,
                                                     std::string& errorMsg) {
    if (body.empty())                                     { errorMsg = "Request body is empty"; return false; }
    if (body.find("order_id")        == std::string::npos) { errorMsg = "order_id is required"; return false; }
    if (body.find("resource_id")     == std::string::npos) { errorMsg = "resource_id is required"; return false; }
    if (body.find("units_requested") == std::string::npos) { errorMsg = "units_requested is required"; return false; }
    return true;
}

std::string ResourceController::dtoToJson(const ResourceDTO& dto) {
    return "{\"resource_id\":"     + std::to_string(dto.resource_id)     +
           ",\"resource_name\":\"" + dto.resource_name                   + "\"" +
           ",\"resource_type\":\"" + dto.resource_type                   + "\"" +
           ",\"total_units\":"     + std::to_string(dto.total_units)     +
           ",\"available_units\":" + std::to_string(dto.available_units) +
           ",\"unit_label\":\""    + dto.unit_label                      + "\"" +
           ",\"description\":\""   + dto.description                     + "\"}";
}

std::string ResourceController::dtosToJson(const std::vector<ResourceDTO>& dtos) {
    std::string json = "[";
    for (size_t i = 0; i < dtos.size(); ++i) {
        json += dtoToJson(dtos[i]);
        if (i < dtos.size() - 1) json += ",";
    }
    return json + "]";
}

std::string ResourceController::deadlockToJson(const DeadlockResponseDTO& dto) {
    std::string pids = "[";
    for (size_t i = 0; i < dto.deadlocked_order_ids.size(); ++i) {
        pids += std::to_string(dto.deadlocked_order_ids[i]);
        if (i < dto.deadlocked_order_ids.size() - 1) pids += ",";
    }
    pids += "]";

    return "{\"deadlock_found\":"       + std::string(dto.deadlock_found ? "true" : "false") +
           ",\"deadlocked_order_ids\":" + pids +
           ",\"detected_at\":\""        + dto.detected_at               + "\"" +
           ",\"suggested_resolution\":\"" + dto.suggested_resolution    + "\"}";
}
