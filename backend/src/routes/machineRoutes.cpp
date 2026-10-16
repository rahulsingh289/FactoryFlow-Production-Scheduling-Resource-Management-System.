// machineRoutes.cpp
// Member: Karan Singh
// Description: Registers all /api/machines routes with the Crow HTTP server.

#include "crow.h"
#include "../../include/machines/MachineController.h"

void registerMachineRoutes(crow::SimpleApp& app) {

    MachineController controller;

    // GET /api/machines
    CROW_ROUTE(app, "/api/machines").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllMachines(req);
    });

    // POST /api/machines
    CROW_ROUTE(app, "/api/machines").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.createMachine(req);
    });

    // GET /api/machines/summary
    CROW_ROUTE(app, "/api/machines/summary").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getMachineSummary(req);
    });

    // GET /api/machines/:id
    CROW_ROUTE(app, "/api/machines/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getMachineById(req);
    });

    // PUT /api/machines/:id
    CROW_ROUTE(app, "/api/machines/<int>").methods("PUT"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateMachine(req);
    });

    // DELETE /api/machines/:id
    CROW_ROUTE(app, "/api/machines/<int>").methods("DELETE"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deleteMachine(req);
    });

    // PATCH /api/machines/:id/status
    CROW_ROUTE(app, "/api/machines/<int>/status").methods("PATCH"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateMachineStatus(req);
    });

    // GET /api/machines/:id/maintenance
    CROW_ROUTE(app, "/api/machines/<int>/maintenance").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getMaintenanceRecords(req);
    });

    // POST /api/machines/:id/maintenance
    CROW_ROUTE(app, "/api/machines/<int>/maintenance").methods("POST"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.logMaintenance(req);
    });
}
