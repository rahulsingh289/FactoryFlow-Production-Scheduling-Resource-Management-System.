// authRoutes.cpp
// Member: Anmol Bhatt
// Description: Registers all /api/auth routes with the Crow HTTP server.

#include "crow.h"
#include "../../include/auth/AuthController.h"

void registerAuthRoutes(crow::SimpleApp& app) {

    AuthController controller;

    // POST /api/auth/login — public endpoint, no auth required
    CROW_ROUTE(app, "/api/auth/login").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.login(req);
    });

    // POST /api/auth/logout
    CROW_ROUTE(app, "/api/auth/logout").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.logout(req);
    });

    // POST /api/auth/refresh
    CROW_ROUTE(app, "/api/auth/refresh").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.refreshToken(req);
    });

    // GET /api/auth/me
    CROW_ROUTE(app, "/api/auth/me").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getCurrentUser(req);
    });

    // GET /api/auth/users  (admin only)
    CROW_ROUTE(app, "/api/auth/users").methods("GET"_method)
    ([&controller](const crow::request& req) {
        return controller.getAllUsers(req);
    });

    // POST /api/auth/users  (admin only)
    CROW_ROUTE(app, "/api/auth/users").methods("POST"_method)
    ([&controller](const crow::request& req) {
        return controller.createUser(req);
    });

    // PUT /api/auth/users/:id
    CROW_ROUTE(app, "/api/auth/users/<int>").methods("PUT"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.updateUser(req);
    });

    // PATCH /api/auth/users/:id/deactivate  (admin only)
    CROW_ROUTE(app, "/api/auth/users/<int>/deactivate").methods("PATCH"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.deactivateUser(req);
    });

    // POST /api/auth/users/:id/change-password
    CROW_ROUTE(app, "/api/auth/users/<int>/change-password").methods("POST"_method)
    ([&controller](const crow::request& req, int id) {
        return controller.changePassword(req);
    });
}
