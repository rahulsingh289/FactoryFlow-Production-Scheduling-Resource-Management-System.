-- ===========================================================================
--  Smart Factory Production Scheduler  —  ANALYTICAL QUERY PACK (viva)
--  ---------------------------------------------------------------------------
--  DBMS MODULE 4 (part 2)  ·  OWNER: Anmol Bhatt
--  Focus: advanced querying — JOINs, subqueries (correlated / EXISTS),
--         aggregates, GROUP BY ... HAVING ... WITH ROLLUP, CASE, CTEs,
--         window functions (RANK, ROW_NUMBER, LAG, running totals), UNION.
--  Run after 03_views.sql (and 04_procedures.sql for the functions).
--  Execute any block individually in MySQL Workbench or the CLI.
-- ===========================================================================
USE smart_factory;

-- Q1. INNER JOIN — the Banker's Allocation/Max/Need matrix (via view).
SELECT * FROM v_bankers_matrix ORDER BY order_id, pool_id;

-- Q2. GROUP BY + aggregates + WITH ROLLUP (grand-total row).
SELECT COALESCE(status, 'ALL STATUSES') AS status,
       COUNT(*) AS orders, SUM(quantity) AS total_units, ROUND(AVG(execution_time),2) AS avg_burst
FROM production_orders
GROUP BY status WITH ROLLUP;

-- Q3. HAVING — machine types whose orders average more than 5 units of burst.
SELECT required_machine_type, COUNT(*) AS orders, ROUND(AVG(execution_time),2) AS avg_burst
FROM production_orders
WHERE required_machine_type IS NOT NULL
GROUP BY required_machine_type
HAVING AVG(execution_time) > 5
ORDER BY avg_burst DESC;

-- Q4. Correlated subquery — orders whose burst exceeds the average burst of
--     other orders needing the SAME machine type.
SELECT o.order_id, o.product_name, o.required_machine_type, o.execution_time
FROM production_orders o
WHERE o.execution_time > (
  SELECT AVG(o2.execution_time) FROM production_orders o2
  WHERE o2.required_machine_type = o.required_machine_type AND o2.order_id <> o.order_id
);

-- Q5. CASE expression — urgency bucket per order.
SELECT order_id, product_name, priority, deadline,
       CASE
         WHEN priority = 1 THEN 'Critical'
         WHEN priority = 2 THEN 'High'
         WHEN priority = 3 THEN 'Normal'
         ELSE 'Low'
       END AS urgency
FROM production_orders
ORDER BY priority;

-- Q6. Window functions — rank orders and show a running total of burst time.
SELECT order_id, product_name, priority, execution_time,
       RANK()       OVER w AS queue_rank,
       ROW_NUMBER() OVER w AS seq,
       SUM(execution_time) OVER (ORDER BY priority, arrival_time
                                 ROWS UNBOUNDED PRECEDING) AS cumulative_burst,
       LAG(product_name) OVER w AS runs_after
FROM production_orders
WHERE status <> 'COMPLETED'
WINDOW w AS (ORDER BY priority, arrival_time);

-- Q7. PARTITION BY — rank orders within each required machine type.
SELECT required_machine_type, order_id, product_name, execution_time,
       RANK() OVER (PARTITION BY required_machine_type ORDER BY execution_time DESC) AS rank_in_type
FROM production_orders
WHERE required_machine_type IS NOT NULL;

-- Q8. CTE (WITH) + join — pools whose outstanding need exceeds availability.
WITH demand AS (
  SELECT pool_id, SUM(max_units - allocated_units) AS total_need
  FROM order_resource_claims GROUP BY pool_id
)
SELECT p.pool_name, p.available_units, d.total_need,
       (d.total_need - p.available_units) AS deficit
FROM resource_pools p JOIN demand d ON d.pool_id = p.pool_id
WHERE d.total_need > p.available_units;

-- Q9. EXISTS — machines that currently have an active allocation.
SELECT m.machine_id, m.machine_name, m.machine_type
FROM machines m
WHERE EXISTS (
  SELECT 1 FROM resource_allocations a
  WHERE a.machine_id = m.machine_id AND a.status = 'ALLOCATED'
);

-- Q10. NOT EXISTS / anti-join — machines with no pending maintenance.
SELECT m.machine_name
FROM machines m
WHERE NOT EXISTS (
  SELECT 1 FROM maintenance_records r
  WHERE r.machine_id = m.machine_id AND r.completed = FALSE
);

-- Q11. Multi-join — the full resource picture for each order.
SELECT o.order_id, o.product_name, p.pool_name,
       c.allocated_units, c.max_units, (c.max_units - c.allocated_units) AS need
FROM production_orders o
JOIN order_resource_claims c ON c.order_id = o.order_id
JOIN resource_pools p        ON p.pool_id  = c.pool_id
ORDER BY o.order_id, p.pool_id;

-- Q12. Stored FUNCTIONS in a query (requires 04_procedures.sql).
SELECT fn_orders_by_status('READY')     AS ready_orders,
       fn_orders_by_status('COMPLETED') AS completed_orders,
       fn_pool_available(1)             AS cnc_free,
       fn_pool_total_need(1)            AS cnc_total_need;

-- Q13. UNION — one combined "resource roster" of machines and workers.
SELECT 'MACHINE' AS kind, machine_name AS name, status FROM machines
UNION ALL
SELECT 'WORKER'  AS kind, full_name   AS name, status FROM workers
ORDER BY kind, name;

-- Q14. Date / string functions — recent audit activity (last 7 days).
SELECT DATE(created_at) AS day, action, COUNT(*) AS events
FROM audit_log
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY DATE(created_at), action
ORDER BY day DESC;

-- Q15. View-driven report — best algorithm by average waiting time.
SELECT * FROM v_algorithm_benchmark ORDER BY mean_waiting ASC;

-- Q16. Inventory ledger (populated by Karan's trigger) with a running balance.
SELECT t.txn_id, i.material_name, t.delta, t.balance_after, t.reason, t.created_at
FROM inventory_transactions t
JOIN inventory i ON i.material_id = t.material_id
ORDER BY t.created_at DESC, t.txn_id DESC;

-- Q17. Transaction — add an order via the stored procedure (uncomment).
-- SET @id = 0;
-- CALL sp_add_order('Garden Bench', 10, 12, 5, 2, 35, 'Welding', @id);
-- SELECT @id AS new_order_id;
