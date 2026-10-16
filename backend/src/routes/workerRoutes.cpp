// workerRoutes.cpp
// Member: Karan Singh
// Description: Registers all /api/workers routes with the Crow HTTP server.

#include "crow.h"
#include "../../include/workers/WorkerController.h"

void registerWorkerRoutes(crow::SimpleApp& app) {

    WorkerController controller;

    // GET /api/workers
    CROW_ROUTE(app, "/api/workers").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllWorkers(req);
    });

    // POST /api/workers
    CROW_ROUTE(app, "/api/workers").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.createWorker(req);
    });

    // GET /api/workers/summary
    CROW_ROUTE(app, "/api/workers/summary").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getWorkerSummary(req);
    });

    // GET /api/workers/assignments
    CROW_ROUTE(app, "/api/workers/assignments").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAssignments(req);
    });

    // POST /api/workers/assign
    CROW_ROUTE(app, "/api/workers/assign").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.assignWorker(req);
    });

    // POST /api/workers/release
    CROW_ROUTE(app, "/api/workers/release").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.releaseWorker(req);
    });

    // GET /api/workers/:id
    CROW_ROUTE(app, "/api/workers/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getWorkerById(req);
    });

    // PUT /api/workers/:id
    CROW_ROUTE(app, "/api/workers/<int>").methods("PUT"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateWorker(req);
    });

    // DELETE /api/workers/:id
    CROW_ROUTE(app, "/api/workers/<int>").methods("DELETE"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deleteWorker(req);
    });

    // PATCH /api/workers/:id/status
    CROW_ROUTE(app, "/api/workers/<int>/status").methods("PATCH"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateWorkerStatus(req);
    });
}
