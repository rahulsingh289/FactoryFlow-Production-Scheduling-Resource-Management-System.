-- ===========================================================================
--  Smart Factory Production Scheduler  —  SEED DATA
--  Run after 01_schema.sql.
--
--  NOTE on users: the backend creates the default login accounts on startup
--  with properly bcrypt-hashed passwords (manager/manager123, operator/operator123),
--  so no user rows are inserted here.
-- ===========================================================================
USE smart_factory;

-- -------------------------------- Machines --------------------------------
INSERT INTO machines (machine_name, machine_type, capacity, status) VALUES
('CNC-01', 'CNC Machine', 2, 'AVAILABLE'),
('CNC-02', 'CNC Machine', 1, 'AVAILABLE'),
('Assembly-01', 'Assembly', 3, 'AVAILABLE'),
('Paint-01', 'Paint Booth', 1, 'MAINTENANCE'),
('Weld-01', 'Welding', 2, 'AVAILABLE');

-- --------------------------------- Workers --------------------------------
INSERT INTO workers (full_name, skill, status) VALUES
('Ravi Kumar',   'CNC Operator',      'AVAILABLE'),
('Sunita Devi',  'Assembly Lead',     'AVAILABLE'),
('Amit Sharma',  'Painter',           'OFF_SHIFT'),
('Neha Verma',   'Welder',            'AVAILABLE'),
('Karan Mehta',  'Quality Inspector', 'ASSIGNED');

-- -------------------------------- Inventory -------------------------------
INSERT INTO inventory (material_name, quantity_available, reorder_level, unit) VALUES
('Timber Plank',   120, 40, 'pieces'),
('Steel Sheet',     60, 25, 'sheets'),
('Wood Screw',     800, 300, 'pieces'),
('Paint Can',       18, 20, 'cans'),   -- below reorder level on purpose
('Varnish',         35, 15, 'litres');

-- ---------------------------- Production Orders ---------------------------
-- (each order behaves like an OS process: arrival, burst=execution, priority)
INSERT INTO production_orders
  (product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type, status) VALUES
('Wooden Chair',    50, 0, 6, 2, 20, 'CNC Machine', 'READY'),
('Dining Table',    20, 2, 8, 1, 25, 'Assembly',    'READY'),
('Office Desk',     30, 4, 7, 3, 30, 'CNC Machine', 'READY'),
('Storage Cabinet', 15, 6, 3, 2, 18, 'Assembly',    'READY'),
('Bookshelf',       25, 8, 4, 4, 28, 'Paint Booth', 'READY'),
('Metal Rack',      40, 10, 5, 1, 22, 'Welding',    'READY');

-- ------------------------------ Resource Pools ----------------------------
-- Abstract resource TYPES for Banker's Algorithm.
-- total_units = (sum of allocated across all orders) + available_units
INSERT INTO resource_pools (pool_name, total_units, available_units) VALUES
('CNC Units',    11, 3),
('Worker Units',  6, 3),
('Robot Units',   7, 2);

-- --------------------------- Order Resource Claims ------------------------
-- Allocation + Max per order per pool. Set up as a classic SAFE state.
-- (order_id values follow the insert order 1..6 above; pool_id 1..3 above)
--                 order  pool  alloc  max
INSERT INTO order_resource_claims (order_id, pool_id, allocated_units, max_units) VALUES
-- Wooden Chair
(1,1,0,7),(1,2,1,5),(1,3,0,3),
-- Dining Table
(2,1,2,3),(2,2,0,2),(2,3,0,2),
-- Office Desk
(3,1,3,9),(3,2,0,0),(3,3,2,2),
-- Storage Cabinet
(4,1,2,2),(4,2,1,2),(4,3,1,2),
-- Bookshelf
(5,1,0,4),(5,2,0,3),(5,3,2,3),
-- Metal Rack
(6,1,1,3),(6,2,1,2),(6,3,0,1);

-- --------------------------- Maintenance Records --------------------------
INSERT INTO maintenance_records (machine_id, description, maintenance_date, completed) VALUES
(4, 'Spray nozzle replacement', '2026-10-28', FALSE),
(1, 'Spindle calibration',      '2026-10-20', TRUE);

SELECT 'Seed data loaded.' AS status;
