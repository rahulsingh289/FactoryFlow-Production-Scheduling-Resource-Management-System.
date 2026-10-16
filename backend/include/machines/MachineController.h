// MachineController.h
// Member: Karan Singh
// Description: Declares the MachineController class handling all HTTP
//              requests for machine management — CRUD, status updates,
//              assignment tracking, and maintenance records.

#ifndef MACHINE_CONTROLLER_H
#define MACHINE_CONTROLLER_H

#include <string>
#include <vector>

struct Request;
struct Response;

// MachineDTO: data transfer object for one machine
struct MachineDTO {
    int         machine_id;
    std::string machine_name;
    std::string machine_type;
    std::string status;           // IDLE | BUSY | MAINTENANCE | OFFLINE
    std::string location;
    int         capacity_per_hr;
    int         resource_id;      // linked resource entry (-1 if none)
    std::string last_serviced;
    std::string next_service_due;
    int         current_order_id; // -1 if idle
};

// MaintenanceDTO: one maintenance record
struct MaintenanceDTO {
    int         record_id;
    int         machine_id;
    std::string maintenance_type; // SCHEDULED | EMERGENCY | INSPECTION
    std::string description;
    std::string performed_by;
    std::string started_at;
    std::string completed_at;
    double      cost;
};

class MachineController {
public:
    MachineController() = default;
    ~MachineController() = default;

    // GET /api/machines
    // Query: ?status=IDLE|BUSY|MAINTENANCE|OFFLINE  &type=CNC|Lathe|...
    Response getAllMachines(const Request& req);

    // GET /api/machines/:id
    Response getMachineById(const Request& req);

    // POST /api/machines
    // Body: { machine_name, machine_type, location, capacity_per_hr, purchased_on }
    Response createMachine(const Request& req);

    // PUT /api/machines/:id
    // Update machine details or status
    Response updateMachine(const Request& req);

    // DELETE /api/machines/:id
    // Decommission — only allowed if machine is IDLE
    Response deleteMachine(const Request& req);

    // PATCH /api/machines/:id/status
    // Body: { status: "IDLE" | "BUSY" | "MAINTENANCE" | "OFFLINE" }
    // Quick status update without full PUT
    Response updateMachineStatus(const Request& req);

    // GET /api/machines/:id/maintenance
    // Returns all maintenance records for a machine
    Response getMaintenanceRecords(const Request& req);

    // POST /api/machines/:id/maintenance
    // Body: { maintenance_type, description, performed_by, started_at, cost }
    // Log a new maintenance event
    Response logMaintenance(const Request& req);

    // GET /api/machines/summary
    // Returns counts: { total, idle, busy, maintenance, offline }
    Response getMachineSummary(const Request& req);

private:
    bool        validateMachinePayload(const std::string& body, std::string& err);
    std::string dtoToJson(const MachineDTO& dto);
    std::string dtosToJson(const std::vector<MachineDTO>& dtos);
    std::string maintenanceDtoToJson(const MaintenanceDTO& dto);
};

#endif // MACHINE_CONTROLLER_H
