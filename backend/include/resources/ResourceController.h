// ResourceController.h
// Member: Rahul Singh
// Description: Declares the ResourceController class that handles all HTTP
//              requests for resource management, allocation, release,
//              and deadlock checking.

#ifndef RESOURCE_CONTROLLER_H
#define RESOURCE_CONTROLLER_H

#include <string>
#include <vector>

struct Request;
struct Response;

// ResourceDTO: data transfer object for a single resource
struct ResourceDTO {
    int         resource_id;
    std::string resource_name;
    std::string resource_type;   // MACHINE | ROBOT | MATERIAL | WORKER
    int         total_units;
    int         available_units;
    std::string unit_label;
    std::string description;
};

// AllocationRequestDTO: payload when a process requests resources
struct AllocationRequestDTO {
    int order_id;
    int resource_id;
    int units_requested;
};

// DeadlockResponseDTO: returned by the deadlock check endpoint
struct DeadlockResponseDTO {
    bool                 deadlock_found;
    std::vector<int>     deadlocked_order_ids;
    std::vector<int>     deadlocked_resource_ids;
    std::string          detected_at;
    std::string          suggested_resolution;
};

class ResourceController {
public:
    ResourceController() = default;
    ~ResourceController() = default;

    // GET /api/resources
    // Returns all registered resources with current availability
    Response getAllResources(const Request& req);

    // GET /api/resources/:id
    // Returns one resource by ID
    Response getResourceById(const Request& req);

    // POST /api/resources
    // Body: { resource_name, resource_type, total_units, unit_label, description }
    // Registers a new resource into the system
    Response createResource(const Request& req);

    // PUT /api/resources/:id
    // Updates resource details (name, total_units, description)
    Response updateResource(const Request& req);

    // DELETE /api/resources/:id
    // Removes a resource (only if available_units == total_units — nothing allocated)
    Response deleteResource(const Request& req);

    // POST /api/resources/allocate
    // Body: { order_id, resource_id, units_requested }
    // Runs Banker's Algorithm check before granting the allocation
    Response allocateResource(const Request& req);

    // POST /api/resources/release
    // Body: { order_id, resource_id, units_to_release }
    // Releases allocated units back to the resource pool
    Response releaseResource(const Request& req);

    // POST /api/resources/release-all
    // Body: { order_id }
    // Releases ALL resources held by a given production order
    Response releaseAllResources(const Request& req);

    // GET /api/resources/allocations
    // Query: ?order_id=X or ?resource_id=Y or ?state=ALLOCATED
    // Returns current allocation records
    Response getAllocations(const Request& req);

    // GET /api/deadlock/check
    // Runs deadlock detection on all currently active processes
    // Returns DeadlockResponseDTO
    Response checkDeadlock(const Request& req);

    // POST /api/deadlock/resolve
    // Triggers resolution by terminating the lowest-priority deadlocked process
    Response resolveDeadlock(const Request& req);

private:
    // Validate resource creation/update payload
    bool validateResourcePayload(const std::string& body, std::string& errorMsg);

    // Validate allocation request payload
    bool validateAllocationPayload(const std::string& body, std::string& errorMsg);

    // Serialize ResourceDTO to JSON string
    std::string dtoToJson(const ResourceDTO& dto);

    // Serialize list of ResourceDTOs to JSON array
    std::string dtosToJson(const std::vector<ResourceDTO>& dtos);

    // Serialize DeadlockResponseDTO to JSON string
    std::string deadlockToJson(const DeadlockResponseDTO& dto);
};

#endif // RESOURCE_CONTROLLER_H
