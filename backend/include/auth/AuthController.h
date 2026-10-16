// AuthController.h
// Member: Anmol Bhatt
// Description: Declares the AuthController class handling all authentication
//              endpoints — login, logout, token refresh, and user management.
//              Uses JWT tokens for stateless authentication.

#ifndef AUTH_CONTROLLER_H
#define AUTH_CONTROLLER_H

#include <string>
#include <vector>

struct Request;
struct Response;

// UserDTO: data transfer object for a user (never includes password_hash)
struct UserDTO {
    int         user_id;
    std::string username;
    std::string email;
    std::string full_name;
    std::string role;        // ADMIN | MANAGER | OPERATOR | VIEWER
    bool        is_active;
    std::string last_login;
    std::string created_at;
};

// LoginRequestDTO: payload for POST /api/auth/login
struct LoginRequestDTO {
    std::string username;    // username or email accepted
    std::string password;    // plaintext — compared against bcrypt hash in DB
};

// AuthResponseDTO: returned on successful login
struct AuthResponseDTO {
    std::string token;       // signed JWT
    std::string token_type;  // always "Bearer"
    int         expires_in;  // seconds until token expiry
    UserDTO     user;        // logged-in user info (no password)
};

class AuthController {
public:
    AuthController() = default;
    ~AuthController() = default;

    // POST /api/auth/login
    // Body: { username, password }
    // Validates credentials, issues JWT on success
    Response login(const Request& req);

    // POST /api/auth/logout
    // Header: Authorization: Bearer <token>
    // Revokes the current session token in user_sessions table
    Response logout(const Request& req);

    // POST /api/auth/refresh
    // Header: Authorization: Bearer <token>
    // Issues a new token before the current one expires
    Response refreshToken(const Request& req);

    // GET /api/auth/me
    // Header: Authorization: Bearer <token>
    // Returns the currently logged-in user's profile
    Response getCurrentUser(const Request& req);

    // ── User management (ADMIN only) ──────────────────────────────────────────

    // GET /api/auth/users
    // Returns all users (admin only)
    Response getAllUsers(const Request& req);

    // POST /api/auth/users
    // Body: { username, email, password, full_name, role }
    // Creates a new user account
    Response createUser(const Request& req);

    // PUT /api/auth/users/:id
    // Update user details (admin or self)
    Response updateUser(const Request& req);

    // PATCH /api/auth/users/:id/deactivate
    // Soft-deactivate a user account (admin only)
    Response deactivateUser(const Request& req);

    // POST /api/auth/users/:id/change-password
    // Body: { old_password, new_password }
    Response changePassword(const Request& req);

private:
    // Hash a plaintext password using bcrypt
    std::string hashPassword(const std::string& plaintext);

    // Verify plaintext against stored bcrypt hash
    bool verifyPassword(const std::string& plaintext, const std::string& hash);

    // Generate a signed JWT for a given user
    std::string generateJWT(const UserDTO& user);

    // Validate an incoming JWT — returns user_id on success, -1 on failure
    int validateJWT(const std::string& token);

    // Validate user creation payload
    bool validateUserPayload(const std::string& body, std::string& err);

    // Serialize UserDTO to JSON (no password fields)
    std::string userToJson(const UserDTO& user);

    // Serialize AuthResponseDTO to JSON
    std::string authResponseToJson(const AuthResponseDTO& resp);
};

#endif // AUTH_CONTROLLER_H
