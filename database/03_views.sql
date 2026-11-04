-- ===========================================================================
--  Smart Factory Production Scheduler  —  VIEWS
--  ---------------------------------------------------------------------------
--  DBMS MODULE 4 (part 1)  ·  OWNER: Anmol Bhatt
--  Focus: views for reporting — JOINs, aggregation, derived columns and
--         window functions.
--  DBMS concepts: CREATE VIEW, multi-table JOIN, GROUP BY, window functions.
--  Companion query pack: database/queries.sql
--
--  Run after 02_seed.sql.   mysql -u root -p smart_factory < database/03_views.sql
-- ===========================================================================
USE smart_factory;

-- 1. Production "ready queue": orders waiting, in priority-then-arrival order.
CREATE OR REPLACE VIEW v_order_queue AS
SELECT order_id, product_name, quantity, arrival_time, execution_time,
       priority, deadline, required_machine_type, status
FROM production_orders
WHERE status IN ('READY','RUNNING','BLOCKED')
ORDER BY priority ASC, arrival_time ASC;

-- 2. Banker's matrix: Allocation, Maximum, derived Need and the Request each
--    active order is waiting for, per order & pool.
CREATE OR REPLACE VIEW v_bankers_matrix AS
SELECT o.order_id, o.product_name, p.pool_id, p.pool_name,
       c.allocated_units AS allocation,
       c.max_units       AS maximum,
       (c.max_units - c.allocated_units) AS need,
       c.requested_units AS requested
FROM order_resource_claims c
JOIN production_orders o ON o.order_id = c.order_id AND o.status <> 'COMPLETED'
JOIN resource_pools    p ON p.pool_id  = c.pool_id;

-- 3. Materials at or below reorder level (uses the generated column).
CREATE OR REPLACE VIEW v_low_stock AS
SELECT material_id, material_name, quantity_available, reorder_level, unit,
       (reorder_level - quantity_available) AS shortfall
FROM inventory
WHERE below_reorder = TRUE;

-- 4. Machine utilisation: active allocations against capacity.
CREATE OR REPLACE VIEW v_machine_utilization AS
SELECT m.machine_id, m.machine_name, m.machine_type, m.capacity, m.status,
       COUNT(a.allocation_id) AS active_allocations,
       ROUND(COUNT(a.allocation_id) / m.capacity * 100, 1) AS utilization_pct
FROM machines m
LEFT JOIN resource_allocations a
       ON a.machine_id = m.machine_id AND a.status = 'ALLOCATED'
GROUP BY m.machine_id, m.machine_name, m.machine_type, m.capacity, m.status;

-- 5. Summary of each scheduling run with deadline misses.
CREATE OR REPLACE VIEW v_schedule_summary AS
SELECT r.run_id, r.algorithm, r.quantum, r.avg_waiting, r.avg_turnaround,
       r.avg_response, r.throughput, r.makespan, r.created_at,
       COUNT(e.entry_id) AS orders_scheduled,
       IFNULL(SUM(e.missed_deadline), 0) AS missed_deadlines
FROM schedule_runs r
LEFT JOIN schedule_entries e ON e.run_id = r.run_id
GROUP BY r.run_id;

-- 6. Algorithm benchmark: average performance per algorithm across all runs.
CREATE OR REPLACE VIEW v_algorithm_benchmark AS
SELECT algorithm,
       COUNT(*)              AS runs,
       ROUND(AVG(avg_waiting), 2)    AS mean_waiting,
       ROUND(AVG(avg_turnaround), 2) AS mean_turnaround,
       ROUND(AVG(makespan), 1)       AS mean_makespan,
       MIN(avg_waiting)      AS best_waiting
FROM schedule_runs
GROUP BY algorithm;

-- 7. Priority ranking of orders using a WINDOW FUNCTION.
CREATE OR REPLACE VIEW v_order_priority_rank AS
SELECT order_id, product_name, priority, arrival_time, execution_time,
       RANK()       OVER (ORDER BY priority ASC, arrival_time ASC) AS queue_rank,
       SUM(execution_time) OVER (ORDER BY priority ASC, arrival_time ASC
                                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_burst
FROM production_orders
WHERE status <> 'COMPLETED';

-- 8. Resource pressure: capacity vs. what active orders still need, per pool.
--    Finished orders don't count, and a pool with no claims still shows.
CREATE OR REPLACE VIEW v_resource_pressure AS
SELECT p.pool_id, p.pool_name, p.total_units, p.available_units,
       IFNULL(SUM(c.allocated_units), 0) AS allocated,
       IFNULL(SUM(c.max_units - c.allocated_units), 0) AS total_need,
       ROUND(IFNULL(SUM(c.max_units - c.allocated_units), 0) / NULLIF(p.total_units, 0) * 100, 1) AS pressure_pct
FROM resource_pools p
LEFT JOIN (order_resource_claims c
           JOIN production_orders o ON o.order_id = c.order_id AND o.status <> 'COMPLETED')
       ON c.pool_id = p.pool_id
GROUP BY p.pool_id, p.pool_name, p.total_units, p.available_units;

-- 9. Worker workload: how many orders each worker has been given, and is on now.
CREATE OR REPLACE VIEW v_worker_workload AS
SELECT w.worker_id, w.full_name, w.skill, w.status,
       COUNT(a.allocation_id) AS orders_handled,
       IFNULL(SUM(a.status = 'ALLOCATED'), 0) AS orders_active
FROM workers w
LEFT JOIN resource_allocations a ON a.worker_id = w.worker_id
GROUP BY w.worker_id, w.full_name, w.skill, w.status;

-- 10. Production history: every order's result in every scheduling run.
CREATE OR REPLACE VIEW v_production_history AS
SELECT e.entry_id, r.run_id, r.algorithm, r.created_at, o.order_id, o.product_name,
       e.start_time, e.completion_time, e.waiting_time, e.turnaround_time,
       o.deadline, e.missed_deadline
FROM schedule_entries e
JOIN schedule_runs r     ON r.run_id = e.run_id
JOIN production_orders o ON o.order_id = e.order_id;

SELECT 'Views created (10 views).' AS status;
