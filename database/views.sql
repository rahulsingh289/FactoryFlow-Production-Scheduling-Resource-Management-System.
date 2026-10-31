-- ===========================================================================
--  Smart Factory Production Scheduler  —  VIEWS
--  ---------------------------------------------------------------------------
--  DBMS MODULE 4 (part 1)  ·  OWNER: Anmol Bhatt
--  Focus: views for reporting — JOINs, aggregation, derived columns and
--         window functions.
--  DBMS concepts: CREATE VIEW, multi-table JOIN, GROUP BY, window functions.
--  Companion query pack: database/queries.sql
--
--  Run after seed.sql.   mysql -u root -p smart_factory < database/views.sql
-- ===========================================================================
USE smart_factory;

-- 1. Production "ready queue": orders waiting, in priority-then-arrival order.
CREATE OR REPLACE VIEW v_order_queue AS
SELECT order_id, product_name, quantity, arrival_time, execution_time,
       priority, deadline, required_machine_type, status
FROM production_orders
WHERE status IN ('READY','RUNNING','BLOCKED')
ORDER BY priority ASC, arrival_time ASC;

-- 2. Banker's matrix: Allocation, Maximum and derived Need per order & pool.
CREATE OR REPLACE VIEW v_bankers_matrix AS
SELECT o.order_id, o.product_name, p.pool_id, p.pool_name,
       c.allocated_units AS allocation,
       c.max_units       AS maximum,
       (c.max_units - c.allocated_units) AS need
FROM order_resource_claims c
JOIN production_orders o ON o.order_id = c.order_id
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
       SUM(e.missed_deadline) AS missed_deadlines
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

-- 8. Resource pressure: capacity vs. outstanding demand per pool.
CREATE OR REPLACE VIEW v_resource_pressure AS
SELECT p.pool_id, p.pool_name, p.total_units, p.available_units,
       SUM(c.allocated_units)            AS allocated,
       SUM(c.max_units - c.allocated_units) AS total_need,
       ROUND(SUM(c.max_units - c.allocated_units) / p.total_units * 100, 1) AS pressure_pct
FROM resource_pools p
JOIN order_resource_claims c ON c.pool_id = p.pool_id
GROUP BY p.pool_id, p.pool_name, p.total_units, p.available_units;

SELECT 'Views created (8 views).' AS status;
