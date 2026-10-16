// OrderController.h
// Member: Aman Singh Rawat
// Description: Declares the OrderController class that handles all HTTP
//              requests related to production orders. Each method maps
//              to one REST API endpoint.

#ifndef ORDER_CONTROLLER_H
#define ORDER_CONTROLLER_H

#include <string>
#include <vector>

// Forward declaration — full definition in crow or cpp-httplib headers
struct Request;
struct Response;

// OrderDTO: Data Transfer Object used to pass order data between
//           the HTTP layer and the business logic layer
struct OrderDTO {
    int         order_id;
    std::string order_name;
    std::string product_name;
    int         quantity;
    int         priority;        // 1–10
    int         execution_time;  // minutes
    std::string deadline;        // ISO 8601 datetime string
    std::string process_state;   // NEW | READY | RUNNING | WAITING | COMPLETED | TERMINATED
    int         created_by;      // user_id
};

class OrderController {
public:
    OrderController() = default;
    ~OrderController() = default;

    // POST /api/orders
    // Body: { order_name, product_name, quantity, priority, execution_time, deadline }
    // Creates a new production order and adds it to the scheduler queue
    Response createOrder(const Request& req);

    // GET /api/orders
    // Query params: ?state=READY&page=1&limit=20
    // Returns paginated list of all production orders
    Response getAllOrders(const Request& req);

    // GET /api/orders/:id
    // Returns full details of a single production order by order_id
    Response getOrderById(const Request& req);

    // PUT /api/orders/:id
    // Body: fields to update (priority, deadline, quantity, etc.)
    // Updates an existing order (only allowed if state is NEW or READY)
    Response updateOrder(const Request& req);

    // DELETE /api/orders/:id
    // Cancels / terminates an order (sets state to TERMINATED)
    Response deleteOrder(const Request& req);

    // POST /api/orders/schedule/run
    // Body: { algorithm: "FCFS" | "SJF" | "PRIORITY" }
    // Triggers the OS Scheduling Engine to run and produces a schedule
    Response runScheduler(const Request& req);

    // GET /api/orders/schedule
    // Returns the current active schedule (list of orders in execution order)
    Response getSchedule(const Request& req);

    // GET /api/orders/queue
    // Returns the current ready queue snapshot from the OS Scheduler
    Response getQueue(const Request& req);

private:
    // Internal helper: validate incoming order JSON payload
    bool validateOrderPayload(const std::string& body, std::string& errorMsg);

    // Internal helper: convert DB row to OrderDTO
    OrderDTO rowToDTO(const std::vector<std::string>& row);

    // Internal helper: serialize OrderDTO to JSON string
    std::string dtoToJson(const OrderDTO& dto);

    // Internal helper: serialize list of OrderDTOs to JSON array string
    std::string dtosToJson(const std::vector<OrderDTO>& dtos);
};

#endif // ORDER_CONTROLLER_H
