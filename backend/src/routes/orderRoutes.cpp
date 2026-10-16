// orderRoutes.cpp
// Member: Aman Singh Rawat
// Description: Registers all /api/orders routes with the HTTP server.
//              Uses Crow (C++ micro web framework). Each route delegates
//              immediately to OrderController for business logic.

#include "crow.h"                              // Crow C++ HTTP framework
#include "../../include/orders/OrderController.h"
#include "../../include/utils/AuthMiddleware.h"  // JWT token verification

// registerOrderRoutes: called once at server startup from main.cpp
// @param app  — reference to the Crow application instance
void registerOrderRoutes(crow::SimpleApp& app) {

    OrderController controller;

    // ── POST /api/orders ─────────────────────────────────────────────────────
    // Create a new production order
    CROW_ROUTE(app, "/api/orders").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.createOrder(req);
    });

    // ── GET /api/orders ──────────────────────────────────────────────────────
    // List all production orders (supports ?state= query filter)
    CROW_ROUTE(app, "/api/orders").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllOrders(req);
    });

    // ── GET /api/orders/:id ───────────────────────────────────────────────────
    // Get one order by ID
    CROW_ROUTE(app, "/api/orders/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getOrderById(req);
    });

    // ── PUT /api/orders/:id ───────────────────────────────────────────────────
    // Update an existing order
    CROW_ROUTE(app, "/api/orders/<int>").methods("PUT"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateOrder(req);
    });

    // ── DELETE /api/orders/:id ────────────────────────────────────────────────
    // Terminate / cancel an order
    CROW_ROUTE(app, "/api/orders/<int>").methods("DELETE"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deleteOrder(req);
    });

    // ── POST /api/orders/schedule/run ────────────────────────────────────────
    // Trigger the OS Scheduling Engine
    CROW_ROUTE(app, "/api/orders/schedule/run").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.runScheduler(req);
    });

    // ── GET /api/orders/schedule ──────────────────────────────────────────────
    // Get the current active schedule
    CROW_ROUTE(app, "/api/orders/schedule").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getSchedule(req);
    });

    // ── GET /api/orders/queue ─────────────────────────────────────────────────
    // Get the current ready queue snapshot
    CROW_ROUTE(app, "/api/orders/queue").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getQueue(req);
    });
}
