// WorkerController.h
// Member: Karan Singh
// Description: Declares the WorkerController class handling all HTTP
//              requests for worker management — CRUD, assignment, skill
//              filtering, and shift management.

#ifndef WORKER_CONTROLLER_H
#define WORKER_CONTROLLER_H

#include <string>
#include <vector>

struct Request;
struct Response;

// WorkerDTO: data transfer object for one worker
struct WorkerDTO {
    int         worker_id;
    std::string first_name;
    std::string last_name;
    std::string employee_code;
    std::string skill_set;        // comma-separated e.g. "Welding,CNC"
    std::string shift;            // MORNING | AFTERNOON | NIGHT | FLEXIBLE
    std::string status;           // AVAILABLE | ASSIGNED | ON_LEAVE | INACTIVE
    int         resource_id;      // linked resource entry (-1 if none)
    double      hourly_rate;
    std::string hire_date;
    int         current_order_id; // -1 if available
};

// WorkerAssignmentDTO: one assignment record
struct WorkerAssignmentDTO {
    int         assignment_id;
    int         worker_id;
    int         order_id;
    int         step_id;
    std::string assigned_at;
    std::string released_at;
    std::string assignment_state; // ACTIVE | COMPLETED | CANCELLED
};

class WorkerController {
public:
    WorkerController() = default;
    ~WorkerController() = default;

    // GET /api/workers
    // Query: ?status=AVAILABLE  &shift=MORNING  &skill=Welding
    Response getAllWorkers(const Request& req);

    // GET /api/workers/:id
    Response getWorkerById(const Request& req);

    // POST /api/workers
    // Body: { first_name, last_name, employee_code, skill_set, shift, hourly_rate, hire_date }
    Response createWorker(const Request& req);

    // PUT /api/workers/:id
    // Update worker details
    Response updateWorker(const Request& req);

    // DELETE /api/workers/:id
    // Deactivate worker (sets status to INACTIVE)
    Response deleteWorker(const Request& req);

    // PATCH /api/workers/:id/status
    // Body: { status: "AVAILABLE" | "ON_LEAVE" | "INACTIVE" }
    Response updateWorkerStatus(const Request& req);

    // POST /api/workers/assign
    // Body: { worker_id, order_id, step_id }
    // Manually assign a worker to a production step
    Response assignWorker(const Request& req);

    // POST /api/workers/release
    // Body: { worker_id, order_id }
    // Release a worker from their current assignment
    Response releaseWorker(const Request& req);

    // GET /api/workers/assignments
    // Query: ?order_id=X  &worker_id=Y  &state=ACTIVE
    Response getAssignments(const Request& req);

    // GET /api/workers/summary
    // Returns counts: { total, available, assigned, on_leave, inactive }
    Response getWorkerSummary(const Request& req);

private:
    bool        validateWorkerPayload(const std::string& body, std::string& err);
    std::string dtoToJson(const WorkerDTO& dto);
    std::string dtosToJson(const std::vector<WorkerDTO>& dtos);
    std::string assignmentDtoToJson(const WorkerAssignmentDTO& dto);
};

#endif // WORKER_CONTROLLER_H
