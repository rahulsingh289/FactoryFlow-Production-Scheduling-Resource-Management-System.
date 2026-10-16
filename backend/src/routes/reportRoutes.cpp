// reportRoutes.cpp
// Member: Anmol Bhatt
// Description: Registers all /api/reports, /api/history, and /api/audit
//              routes with the Crow HTTP server.

#include "crow.h"
#include "../../include/reports/ReportsController.h"

void registerReportRoutes(crow::SimpleApp& app) {

    ReportsController controller;

    // ── Dashboard summary ─────────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/reports/summary").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getDashboardSummary(req);
    });

    // ── Algorithm comparison ──────────────────────────────────────────────────
    CROW_ROUTE(app, "/api/reports/algorithm-comparison").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAlgorithmComparison(req);
    });

    // ── Performance reports ───────────────────────────────────────────────────

    // GET /api/reports
    CROW_ROUTE(app, "/api/reports").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllReports(req);
    });

    // POST /api/reports/generate
    CROW_ROUTE(app, "/api/reports/generate").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.generateReport(req);
    });

    // GET /api/reports/:id
    CROW_ROUTE(app, "/api/reports/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getReportById(req);
    });

    // DELETE /api/reports/:id
    CROW_ROUTE(app, "/api/reports/<int>").methods("DELETE"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deleteReport(req);
    });

    // ── Production history ────────────────────────────────────────────────────

    // GET /api/history
    CROW_ROUTE(app, "/api/history").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getProductionHistory(req);
    });

    // GET /api/history/:id
    CROW_ROUTE(app, "/api/history/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getHistoryById(req);
    });

    // ── Audit logs ────────────────────────────────────────────────────────────

    // GET /api/audit
    CROW_ROUTE(app, "/api/audit").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAuditLogs(req);
    });
}
