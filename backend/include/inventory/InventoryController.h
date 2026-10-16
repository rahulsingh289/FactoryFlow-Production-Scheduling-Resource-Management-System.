// InventoryController.h
// Member: Karan Singh
// Description: Declares the InventoryController class handling all HTTP
//              requests for inventory management — stock levels, consumption,
//              restock, and low-stock alerts.

#ifndef INVENTORY_CONTROLLER_H
#define INVENTORY_CONTROLLER_H

#include <string>
#include <vector>

struct Request;
struct Response;

// InventoryItemDTO: one inventory item
struct InventoryItemDTO {
    int         item_id;
    std::string item_name;
    std::string item_code;
    std::string category;         // Raw Material | Component | Tool
    std::string unit;             // kg | litres | units | metres
    double      quantity_in_stock;
    double      minimum_stock_level;
    double      reorder_quantity;
    double      unit_cost;
    std::string supplier_name;
    std::string last_restocked;
    bool        is_low_stock;     // true if quantity_in_stock < minimum_stock_level
};

// InventoryTransactionDTO: one stock change record
struct InventoryTransactionDTO {
    int         txn_id;
    int         item_id;
    int         order_id;         // -1 if manual
    std::string txn_type;         // CONSUMED | RESTOCKED | ADJUSTED | RESERVED
    double      quantity_change;
    double      quantity_after;
    std::string notes;
    std::string created_at;
};

class InventoryController {
public:
    InventoryController() = default;
    ~InventoryController() = default;

    // GET /api/inventory
    // Query: ?category=Raw+Material  &low_stock=true
    Response getAllItems(const Request& req);

    // GET /api/inventory/:id
    Response getItemById(const Request& req);

    // POST /api/inventory
    // Body: { item_name, item_code, category, unit, quantity_in_stock,
    //         minimum_stock_level, reorder_quantity, unit_cost, supplier_name }
    Response createItem(const Request& req);

    // PUT /api/inventory/:id
    Response updateItem(const Request& req);

    // DELETE /api/inventory/:id
    // Only allowed if quantity_in_stock == 0
    Response deleteItem(const Request& req);

    // POST /api/inventory/:id/consume
    // Body: { quantity, order_id, notes }
    // Deduct stock consumed by a production order
    Response consumeStock(const Request& req);

    // POST /api/inventory/:id/restock
    // Body: { quantity, notes }
    // Add stock (delivery / manual restock)
    Response restockItem(const Request& req);

    // GET /api/inventory/low-stock
    // Returns all items where quantity_in_stock < minimum_stock_level
    Response getLowStockItems(const Request& req);

    // GET /api/inventory/transactions
    // Query: ?item_id=X  &order_id=Y  &type=CONSUMED
    Response getTransactions(const Request& req);

private:
    bool        validateItemPayload(const std::string& body, std::string& err);
    std::string dtoToJson(const InventoryItemDTO& dto);
    std::string dtosToJson(const std::vector<InventoryItemDTO>& dtos);
    std::string txnDtoToJson(const InventoryTransactionDTO& dto);
};

#endif // INVENTORY_CONTROLLER_H
