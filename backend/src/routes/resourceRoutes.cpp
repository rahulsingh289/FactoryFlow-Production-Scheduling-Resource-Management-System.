// resourceRoutes.cpp
// Member: Rahul Singh
// Description: Registers all /api/resources and /api/deadlock routes
//              with the Crow HTTP server.

#include "crow.h"
#include "../../include/resources/ResourceController.h"

void registerResourceRoutes(crow::SimpleApp& app) {

    ResourceController controller;

    // ── GET /api/resources ────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllResources(req);
    });

    // ── POST /api/resources ───────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.createResource(req);
    });

    // ── GET /api/resources/:id ────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getResourceById(req);
    });

    // ── PUT /api/resources/:id ────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/<int>").methods("PUT"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateResource(req);
    });

    // ── DELETE /api/resources/:id ─────────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/<int>").methods("DELETE"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deleteResource(req);
    });

    // ── POST /api/resources/allocate ──────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/allocate").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.allocateResource(req);
    });

    // ── POST /api/resources/release ───────────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/release").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.releaseResource(req);
    });

    // ── POST /api/resources/release-all ──────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/release-all").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.releaseAllResources(req);
    });

    // ── GET /api/resources/allocations ───────────────────────────────────────
    CROW_ROUTE(app, "/api/resources/allocations").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllocations(req);
    });

    // ── GET /api/deadlock/check ───────────────────────────────────────────────
    CROW_ROUTE(app, "/api/deadlock/check").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.checkDeadlock(req);
    });

    // ── POST /api/deadlock/resolve ────────────────────────────────────────────
    CROW_ROUTE(app, "/api/deadlock/resolve").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.resolveDeadlock(req);
    });
}
