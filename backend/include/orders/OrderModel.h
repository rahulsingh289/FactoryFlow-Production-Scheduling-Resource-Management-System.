// OrderModel.h
// Member: Aman Singh Rawat
// Description: Declares the OrderModel class responsible for all database
//              operations (CRUD) on the production_orders, production_steps,
//              and schedules tables. This is the data-access layer.

#ifndef ORDER_MODEL_H
#define ORDER_MODEL_H

#include <string>
#include <vector>
#include <optional>
#include "OrderController.h"   // for OrderDTO

class DBConnection;            // forward declaration — defined in db/DBConnection.h

class OrderModel {
public:
    explicit OrderModel(DBConnection& db);

    // Insert a new production order row — returns new order_id on success, -1 on fail
    int insertOrder(const OrderDTO& dto);

    // Fetch all orders, optionally filtered by state
    std::vector<OrderDTO> fetchAllOrders(const std::string& stateFilter = "");

    // Fetch one order by its primary key
    std::optional<OrderDTO> fetchOrderById(int order_id);

    // Update priority, deadline, or quantity of an existing order
    bool updateOrder(int order_id, const OrderDTO& dto);

    // Set order state to TERMINATED (soft delete)
    bool terminateOrder(int order_id);

    // Update the process_state field for a given order
    bool updateOrderState(int order_id, const std::string& new_state);

    // Insert a schedule row after the scheduler has run
    bool insertScheduleEntry(int order_id, const std::string& algorithm,
                             const std::string& scheduled_start,
                             const std::string& scheduled_end);

    // Fetch all active schedule entries
    std::vector<OrderDTO> fetchActiveSchedule();

private:
    DBConnection& db_;  // reference to shared DB connection
};

#endif // ORDER_MODEL_H
