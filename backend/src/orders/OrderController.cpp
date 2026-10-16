// OrderController.cpp
// Member: Aman Singh Rawat
// Description: Implementation of OrderController. Each method handles
//              request parsing, calls OrderModel for DB operations, invokes
//              the OS Scheduler where needed, and returns a JSON response.

#include "../../include/orders/OrderController.h"
#include "../../include/orders/OrderModel.h"
#include "../../include/db/DBConnection.h"
#include "../../include/utils/JsonHelper.h"
#include "../../include/utils/HttpResponse.h"

// ── POST /api/orders ──────────────────────────────────────────────────────────
Response OrderController::createOrder(const Request& req) {
    std::string errorMsg;
    if (!validateOrderPayload(req.body, errorMsg)) {
        return HttpResponse::badRequest(errorMsg);
    }

    // Parse JSON body into OrderDTO
    OrderDTO dto = JsonHelper::parseOrder(req.body);

    // Persist to DB via OrderModel
    DBConnection db;
    OrderModel model(db);
    int new_id = model.insertOrder(dto);

    if (new_id < 0) {
        return HttpResponse::internalError("Failed to create production order");
    }

    // Return the newly created order
    auto created = model.fetchOrderById(new_id);
    return HttpResponse::created(dtoToJson(created.value()));
}

// ── GET /api/orders ───────────────────────────────────────────────────────────
Response OrderController::getAllOrders(const Request& req) {
    std::string stateFilter = req.getQueryParam("state"); // optional filter

    DBConnection db;
    OrderModel model(db);
    auto orders = model.fetchAllOrders(stateFilter);

    return HttpResponse::ok(dtosToJson(orders));
}

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
Response OrderController::getOrderById(const Request& req) {
    int order_id = std::stoi(req.getPathParam("id"));

    DBConnection db;
    OrderModel model(db);
    auto order = model.fetchOrderById(order_id);

    if (!order.has_value()) {
        return HttpResponse::notFound("Order not found");
    }
    return HttpResponse::ok(dtoToJson(order.value()));
}

// ── PUT /api/orders/:id ───────────────────────────────────────────────────────
Response OrderController::updateOrder(const Request& req) {
    int order_id = std::stoi(req.getPathParam("id"));
    OrderDTO dto = JsonHelper::parseOrder(req.body);

    DBConnection db;
    OrderModel model(db);

    // Only allow update if order is still NEW or READY
    auto existing = model.fetchOrderById(order_id);
    if (!existing.has_value()) {
        return HttpResponse::notFound("Order not found");
    }
    if (existing->process_state != "NEW" && existing->process_state != "READY") {
        return HttpResponse::badRequest("Cannot update an order that is already running or completed");
    }

    bool success = model.updateOrder(order_id, dto);
    if (!success) {
        return HttpResponse::internalError("Failed to update order");
    }
    return HttpResponse::ok("{\"message\": \"Order updated successfully\"}");
}

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
Response OrderController::deleteOrder(const Request& req) {
    int order_id = std::stoi(req.getPathParam("id"));

    DBConnection db;
    OrderModel model(db);
    bool success = model.terminateOrder(order_id);

    if (!success) {
        return HttpResponse::internalError("Failed to terminate order");
    }
    return HttpResponse::ok("{\"message\": \"Order terminated successfully\"}");
}

// ── POST /api/orders/schedule/run ────────────────────────────────────────────
Response OrderController::runScheduler(const Request& req) {
    // Parse algorithm choice from body: { "algorithm": "FCFS" | "SJF" | "PRIORITY" }
    std::string algo = JsonHelper::getString(req.body, "algorithm");
    if (algo.empty()) algo = "FCFS"; // default

    // TODO (Phase 3): instantiate Scheduler, load READY orders, run, save results
    // Placeholder response for 20% milestone
    std::string result = "{\"message\": \"Scheduler triggered\", \"algorithm\": \"" + algo + "\"}";
    return HttpResponse::ok(result);
}

// ── GET /api/orders/schedule ──────────────────────────────────────────────────
Response OrderController::getSchedule(const Request& req) {
    DBConnection db;
    OrderModel model(db);
    auto schedule = model.fetchActiveSchedule();
    return HttpResponse::ok(dtosToJson(schedule));
}

// ── GET /api/orders/queue ─────────────────────────────────────────────────────
Response OrderController::getQueue(const Request& req) {
    // TODO (Phase 3): return live queue from Scheduler singleton
    // Placeholder for 20% milestone
    return HttpResponse::ok("{\"queue\": []}");
}

// ── Private helpers ───────────────────────────────────────────────────────────

bool OrderController::validateOrderPayload(const std::string& body, std::string& errorMsg) {
    if (body.empty()) { errorMsg = "Request body is empty"; return false; }
    if (body.find("order_name") == std::string::npos)  { errorMsg = "order_name is required"; return false; }
    if (body.find("product_name") == std::string::npos){ errorMsg = "product_name is required"; return false; }
    if (body.find("execution_time") == std::string::npos){ errorMsg = "execution_time is required"; return false; }
    if (body.find("deadline") == std::string::npos)    { errorMsg = "deadline is required"; return false; }
    return true;
}

std::string OrderController::dtoToJson(const OrderDTO& dto) {
    return "{"
           "\"order_id\":"     + std::to_string(dto.order_id)     + ","
           "\"order_name\":\""  + dto.order_name                   + "\","
           "\"product_name\":\"" + dto.product_name                + "\","
           "\"quantity\":"      + std::to_string(dto.quantity)     + ","
           "\"priority\":"      + std::to_string(dto.priority)     + ","
           "\"execution_time\":" + std::to_string(dto.execution_time) + ","
           "\"deadline\":\""    + dto.deadline                     + "\","
           "\"process_state\":\"" + dto.process_state              + "\""
           "}";
}

std::string OrderController::dtosToJson(const std::vector<OrderDTO>& dtos) {
    std::string json = "[";
    for (size_t i = 0; i < dtos.size(); ++i) {
        json += dtoToJson(dtos[i]);
        if (i < dtos.size() - 1) json += ",";
    }
    json += "]";
    return json;
}
