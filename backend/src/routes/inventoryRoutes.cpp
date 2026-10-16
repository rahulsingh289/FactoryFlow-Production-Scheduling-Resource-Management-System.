// inventoryRoutes.cpp
// Member: Karan Singh
// Description: Registers all /api/inventory routes with the Crow HTTP server.

#include "crow.h"
#include "../../include/inventory/InventoryController.h"

void registerInventoryRoutes(crow::SimpleApp& app) {

    InventoryController controller;

    // GET /api/inventory
    CROW_ROUTE(app, "/api/inventory").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllItems(req);
    });

    // POST /api/inventory
    CROW_ROUTE(app, "/api/inventory").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.createItem(req);
    });

    // GET /api/inventory/low-stock
    CROW_ROUTE(app, "/api/inventory/low-stock").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getLowStockItems(req);
    });

    // GET /api/inventory/transactions
    CROW_ROUTE(app, "/api/inventory/transactions").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getTransactions(req);
    });

    // GET /api/inventory/:id
    CROW_ROUTE(app, "/api/inventory/<int>").methods("GET"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.getItemById(req);
    });

    // PUT /api/inventory/:id
    CROW_ROUTE(app, "/api/inventory/<int>").methods("PUT"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateItem(req);
    });

    // DELETE /api/inventory/:id
    CROW_ROUTE(app, "/api/inventory/<int>").methods("DELETE"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deleteItem(req);
    });

    // POST /api/inventory/:id/consume
    CROW_ROUTE(app, "/api/inventory/<int>/consume").methods("POST"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.consumeStock(req);
    });

    // POST /api/inventory/:id/restock
    CROW_ROUTE(app, "/api/inventory/<int>/restock").methods("POST"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.restockItem(req);
    });
}
