// AuthController.cpp
// Member: Anmol Bhatt
// Description: Implementation of AuthController.
//              Handles login/logout, JWT issuance/validation,
//              and user CRUD with bcrypt password hashing.

#include "../../include/auth/AuthController.h"
#include "../../include/db/DBConnection.h"
#include "../../include/utils/JsonHelper.h"
#include "../../include/utils/HttpResponse.h"
#include <string>

// JWT secret key — loaded from environment variable in production
static const std::string JWT_SECRET =
    "CHANGE_THIS_IN_PRODUCTION_USE_ENV_VAR";

// Token expiry: 8 hours in seconds
static const int TOKEN_EXPIRY_SECONDS = 8 * 60 * 60;

// ── POST /api/auth/login ──────────────────────────────────────────────────────
Response AuthController::login(const Request& req) {
    if (req.body.empty()) {
        return HttpResponse::badRequest("Request body is empty");
    }

    std::string username = JsonHelper::getString(req.body, "username");
    std::string password = JsonHelper::getString(req.body, "password");

    if (username.empty() || password.empty()) {
        return HttpResponse::badRequest("username and password are required");
    }

    DBConnection db;

    // TODO: SELECT user_id, password_hash, role, is_active FROM users
    //       WHERE username = ? OR email = ?
    // For 20% milestone — placeholder logic
    UserDTO user;
    user.user_id    = 1;
    user.username   = username;
    user.email      = username + "@factory.local";
    user.full_name  = "Factory User";
    user.role       = "MANAGER";
    user.is_active  = true;
    user.last_login = "2026-10-16T00:00:00Z";

    // TODO: replace with actual bcrypt verify against DB hash
    // bool valid = verifyPassword(password, stored_hash);
    // if (!valid) return HttpResponse::unauthorized("Invalid credentials");

    // Generate JWT token
    std::string token = generateJWT(user);

    // TODO: INSERT into user_sessions (user_id, token_hash, expires_at, ip_address)

    AuthResponseDTO authResp;
    authResp.token      = token;
    authResp.token_type = "Bearer";
    authResp.expires_in = TOKEN_EXPIRY_SECONDS;
    authResp.user       = user;

    return HttpResponse::ok(authResponseToJson(authResp));
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
Response AuthController::logout(const Request& req) {
    std::string authHeader = req.getHeader("Authorization");
    if (authHeader.empty() || authHeader.find("Bearer ") != 0) {
        return HttpResponse::unauthorized("No valid token provided");
    }

    std::string token = authHeader.substr(7); // strip "Bearer "

    DBConnection db;
    // TODO: UPDATE user_sessions SET is_revoked = TRUE WHERE token_hash = ?

    return HttpResponse::ok("{\"message\": \"Logged out successfully\"}");
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
Response AuthController::refreshToken(const Request& req) {
    std::string authHeader = req.getHeader("Authorization");
    if (authHeader.empty()) {
        return HttpResponse::unauthorized("Authorization header missing");
    }

    std::string token  = authHeader.substr(7);
    int user_id        = validateJWT(token);

    if (user_id < 0) {
        return HttpResponse::unauthorized("Invalid or expired token");
    }

    // TODO: fetch user from DB by user_id, generate new token
    UserDTO user;
    user.user_id = user_id;
    std::string newToken = generateJWT(user);

    return HttpResponse::ok(
        "{\"token\": \"" + newToken + "\","
        "\"token_type\": \"Bearer\","
        "\"expires_in\": " + std::to_string(TOKEN_EXPIRY_SECONDS) + "}"
    );
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
Response AuthController::getCurrentUser(const Request& req) {
    std::string authHeader = req.getHeader("Authorization");
    if (authHeader.empty()) {
        return HttpResponse::unauthorized("Authorization header missing");
    }

    int user_id = validateJWT(authHeader.substr(7));
    if (user_id < 0) {
        return HttpResponse::unauthorized("Invalid token");
    }

    DBConnection db;
    // TODO: SELECT user info from users WHERE user_id = ?
    // Placeholder
    UserDTO user;
    user.user_id   = user_id;
    user.username  = "user" + std::to_string(user_id);
    user.role      = "MANAGER";
    user.is_active = true;

    return HttpResponse::ok(userToJson(user));
}

// ── GET /api/auth/users ───────────────────────────────────────────────────────
Response AuthController::getAllUsers(const Request& req) {
    // TODO: role check — only ADMIN can list all users
    DBConnection db;
    // TODO: SELECT all users from DB
    return HttpResponse::ok("[]");
}

// ── POST /api/auth/users ──────────────────────────────────────────────────────
Response AuthController::createUser(const Request& req) {
    std::string err;
    if (!validateUserPayload(req.body, err)) {
        return HttpResponse::badRequest(err);
    }

    std::string username  = JsonHelper::getString(req.body, "username");
    std::string email     = JsonHelper::getString(req.body, "email");
    std::string password  = JsonHelper::getString(req.body, "password");
    std::string full_name = JsonHelper::getString(req.body, "full_name");
    std::string role      = JsonHelper::getString(req.body, "role");

    // Hash the password before storing
    std::string hash = hashPassword(password);

    DBConnection db;
    // TODO: INSERT INTO users (username, email, password_hash, full_name, role)
    return HttpResponse::created("{\"message\": \"User created successfully\"}");
}

// ── PUT /api/auth/users/:id ───────────────────────────────────────────────────
Response AuthController::updateUser(const Request& req) {
    int user_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: UPDATE users SET full_name = ?, email = ?, role = ? WHERE user_id = ?
    return HttpResponse::ok("{\"message\": \"User updated successfully\"}");
}

// ── PATCH /api/auth/users/:id/deactivate ─────────────────────────────────────
Response AuthController::deactivateUser(const Request& req) {
    int user_id = std::stoi(req.getPathParam("id"));
    DBConnection db;
    // TODO: UPDATE users SET is_active = FALSE WHERE user_id = ?
    //       Also revoke all sessions for this user
    return HttpResponse::ok("{\"message\": \"User deactivated\"}");
}

// ── POST /api/auth/users/:id/change-password ─────────────────────────────────
Response AuthController::changePassword(const Request& req) {
    int user_id         = std::stoi(req.getPathParam("id"));
    std::string old_pwd = JsonHelper::getString(req.body, "old_password");
    std::string new_pwd = JsonHelper::getString(req.body, "new_password");

    if (old_pwd.empty() || new_pwd.empty()) {
        return HttpResponse::badRequest("old_password and new_password are required");
    }
    if (new_pwd.length() < 8) {
        return HttpResponse::badRequest("new_password must be at least 8 characters");
    }

    DBConnection db;
    // TODO: verify old_password against stored hash, then UPDATE with new hash
    std::string new_hash = hashPassword(new_pwd);
    return HttpResponse::ok("{\"message\": \"Password changed successfully\"}");
}

// ── Private: hashPassword ─────────────────────────────────────────────────────
std::string AuthController::hashPassword(const std::string& plaintext) {
    // TODO: use bcrypt library (e.g. bcrypt.h) in Phase 5
    // Placeholder — never store plaintext in real implementation
    return "$2b$12$placeholder_" + plaintext.substr(0, 4);
}

// ── Private: verifyPassword ───────────────────────────────────────────────────
bool AuthController::verifyPassword(const std::string& plaintext,
                                     const std::string& hash) {
    // TODO: use bcrypt verify in Phase 5
    return !plaintext.empty() && !hash.empty();
}

// ── Private: generateJWT ─────────────────────────────────────────────────────
std::string AuthController::generateJWT(const UserDTO& user) {
    // TODO: use a proper JWT library (jwt-cpp) in Phase 5
    // Placeholder base64url-like token for development
    return "jwt_placeholder_uid" + std::to_string(user.user_id) +
           "_role_" + user.role;
}

// ── Private: validateJWT ─────────────────────────────────────────────────────
int AuthController::validateJWT(const std::string& token) {
    // TODO: verify signature, check expiry, check not revoked in DB
    // Placeholder: extract user_id from placeholder token
    if (token.find("jwt_placeholder_uid") == std::string::npos) return -1;
    size_t uid_pos = token.find("_uid") + 4;
    size_t end_pos = token.find("_role_");
    if (uid_pos == std::string::npos || end_pos == std::string::npos) return -1;
    try {
        return std::stoi(token.substr(uid_pos, end_pos - uid_pos));
    } catch (...) {
        return -1;
    }
}

// ── Private: validateUserPayload ─────────────────────────────────────────────
bool AuthController::validateUserPayload(const std::string& body,
                                          std::string& err) {
    if (body.empty())                                    { err = "Body is empty"; return false; }
    if (body.find("username")  == std::string::npos)     { err = "username is required"; return false; }
    if (body.find("email")     == std::string::npos)     { err = "email is required"; return false; }
    if (body.find("password")  == std::string::npos)     { err = "password is required"; return false; }
    if (body.find("full_name") == std::string::npos)     { err = "full_name is required"; return false; }
    return true;
}

// ── Private: serializers ──────────────────────────────────────────────────────
std::string AuthController::userToJson(const UserDTO& u) {
    return "{\"user_id\":"    + std::to_string(u.user_id) +
           ",\"username\":\"" + u.username                + "\"" +
           ",\"email\":\""    + u.email                   + "\"" +
           ",\"full_name\":\"" + u.full_name              + "\"" +
           ",\"role\":\""     + u.role                    + "\"" +
           ",\"is_active\":"  + (u.is_active ? "true" : "false") +
           ",\"last_login\":\"" + u.last_login            + "\"}";
}

std::string AuthController::authResponseToJson(const AuthResponseDTO& r) {
    return "{\"token\":\""      + r.token               + "\"" +
           ",\"token_type\":\"" + r.token_type           + "\"" +
           ",\"expires_in\":"   + std::to_string(r.expires_in) +
           ",\"user\":"         + userToJson(r.user)     + "}";
}
