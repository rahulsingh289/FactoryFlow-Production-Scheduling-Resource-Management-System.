// ReportsController.h
// Member: Anmol Bhatt
// Description: Declares the ReportsController class handling all HTTP
//              requests for performance reports, production history,
//              and audit logs. This is the analytics layer of the system.

#ifndef REPORTS_CONTROLLER_H
#define REPORTS_CONTROLLER_H

#include <string>
#include <vector>

struct Request;
struct Response;

// HistoryItemDTO: one completed order record from production_history
struct HistoryItemDTO {
    int         history_id;
    int         order_id;
    std::string order_name;
    std::string product_name;
    int         quantity;
    std::string algorithm;
    std::string final_state;
    std::string actual_start;
    std::string actual_end;
    int         execution_time_min;
    int         actual_time_min;
    int         waiting_time_min;
    int         turnaround_time_min;
    bool        met_deadline;
    std::string recorded_at;
};

// PerformanceReportDTO: one aggregate performance report
struct PerformanceReportDTO {
    int         report_id;
    std::string report_name;
    std::string algorithm;
    int         total_orders;
    int         completed_orders;
    int         terminated_orders;
    int         orders_met_deadline;
    double      avg_waiting_time_min;
    double      avg_turnaround_time_min;
    double      avg_execution_time_min;
    double      machine_utilization_pct;
    double      worker_utilization_pct;
    std::string generated_at;
    std::string period_start;
    std::string period_end;
};

// AuditLogDTO: one audit event
struct AuditLogDTO {
    int         log_id;
    int         user_id;
    std::string action;
    std::string entity_type;
    int         entity_id;
    std::string old_value;
    std::string new_value;
    std::string created_at;
};

class ReportsController {
public:
    ReportsController() = default;
    ~ReportsController() = default;

    // ── Production History ────────────────────────────────────────────────────

    // GET /api/history
    // Query: ?final_state=COMPLETED  &page=1  &limit=20
    //        &from=2026-01-01  &to=2026-12-31
    Response getProductionHistory(const Request& req);

    // GET /api/history/:id
    // Returns full details of one history record
    Response getHistoryById(const Request& req);

    // ── Performance Reports ───────────────────────────────────────────────────

    // GET /api/reports
    // Returns all saved performance reports
    Response getAllReports(const Request& req);

    // GET /api/reports/:id
    Response getReportById(const Request& req);

    // POST /api/reports/generate
    // Body: { algorithm, period_start, period_end, report_name }
    // Computes a fresh performance report from production_history data
    Response generateReport(const Request& req);

    // DELETE /api/reports/:id
    // Remove a saved report
    Response deleteReport(const Request& req);

    // ── Audit Logs ────────────────────────────────────────────────────────────

    // GET /api/audit
    // Query: ?action=ORDER_CREATED  &entity_type=order  &user_id=X
    //        &from=2026-01-01  &to=2026-12-31
    Response getAuditLogs(const Request& req);

    // ── Dashboard summary stats ───────────────────────────────────────────────

    // GET /api/reports/summary
    // Returns high-level stats for the dashboard home:
    // { total_orders, completed_today, avg_turnaround, deadline_hit_rate,
    //   machine_utilization, worker_utilization }
    Response getDashboardSummary(const Request& req);

    // GET /api/reports/algorithm-comparison
    // Returns side-by-side metrics for FCFS vs SJF vs PRIORITY
    Response getAlgorithmComparison(const Request& req);

private:
    // Compute metrics from history rows and return PerformanceReportDTO
    PerformanceReportDTO computeMetrics(
        const std::vector<HistoryItemDTO>& history,
        const std::string& algorithm,
        const std::string& reportName,
        const std::string& periodStart,
        const std::string& periodEnd);

    std::string historyToJson(const HistoryItemDTO& dto);
    std::string historyListToJson(const std::vector<HistoryItemDTO>& dtos);
    std::string reportToJson(const PerformanceReportDTO& dto);
    std::string auditToJson(const AuditLogDTO& dto);
};

#endif // REPORTS_CONTROLLER_H
