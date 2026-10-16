// ResourceModel.h
// Member: Rahul Singh
// Description: Declares the ResourceModel class — data access layer for
//              the resources, resource_allocations, and deadlock_logs tables.

#ifndef RESOURCE_MODEL_H
#define RESOURCE_MODEL_H

#include <string>
#include <vector>
#include <optional>
#include "ResourceController.h"

class DBConnection;

class ResourceModel {
public:
    explicit ResourceModel(DBConnection& db);

    // ── Resource CRUD ─────────────────────────────────────────────────────────
    int                       insertResource(const ResourceDTO& dto);
    std::vector<ResourceDTO>  fetchAllResources();
    std::optional<ResourceDTO> fetchResourceById(int resource_id);
    bool                      updateResource(int resource_id, const ResourceDTO& dto);
    bool                      deleteResource(int resource_id);

    // ── Availability updates ──────────────────────────────────────────────────
    // Decrease available_units (called after safe allocation confirmed)
    bool decrementAvailableUnits(int resource_id, int units);

    // Increase available_units (called on release)
    bool incrementAvailableUnits(int resource_id, int units);

    // ── Allocation records ────────────────────────────────────────────────────
    int  insertAllocationRecord(const AllocationRequestDTO& dto);
    bool updateAllocationState(int allocation_id, const std::string& new_state);
    bool markAllocationReleased(int order_id, int resource_id);
    bool markAllAllocationsReleased(int order_id);

    // Fetch allocations — all, or filtered by order_id / resource_id / state
    std::vector<AllocationRequestDTO> fetchAllocations(
        int order_id = -1, int resource_id = -1, const std::string& state = "");

    // ── Deadlock log ──────────────────────────────────────────────────────────
    bool logDeadlock(const std::string& involved_orders,
                     const std::string& involved_resources,
                     const std::string& resolution);

private:
    DBConnection& db_;
};

#endif // RESOURCE_MODEL_H
