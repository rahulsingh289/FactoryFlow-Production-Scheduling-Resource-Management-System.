// AuthMiddleware.h
// Member: Anmol Bhatt
// Description: JWT authentication middleware.
//              Every protected route calls verifyToken() before proceeding.
//              Also provides role-based access control helpers.

#ifndef AUTH_MIDDLEWARE_H
#define AUTH_MIDDLEWARE_H

#include <string>
#include <vector>

struct Request;
struct Response;

// TokenPayload: decoded content of a valid JWT
struct TokenPayload {
    int         user_id;
    std::string username;
    std::string role;        // ADMIN | MANAGER | OPERATOR | VIEWER
    long long   issued_at;   // epoch seconds
    long long   expires_at;  // epoch seconds
};

class AuthMiddleware {
public:
    // Verify the Authorization header and decode the JWT
    // Returns true + fills payload on success
    // Returns false + sets errorMsg on failure
    static bool verifyToken(const Request& req,
                            TokenPayload& payload,
                            std::string& errorMsg);

    // Role check helpers — call after verifyToken
    static bool isAdmin(const TokenPayload& payload);
    static bool isManagerOrAbove(const TokenPayload& payload);
    static bool isOperatorOrAbove(const TokenPayload& payload);

    // Convenience: returns 401 response if token invalid
    // Returns empty Response if valid (caller continues)
    static Response requireAuth(const Request& req, TokenPayload& payload);

    // Convenience: returns 403 if role insufficient
    static Response requireRole(const TokenPayload& payload,
                                 const std::vector<std::string>& allowedRoles);
};

#endif // AUTH_MIDDLEWARE_H
