-- ===========================================================================
--  Smart Factory Production Scheduler  —  PROCEDURES, FUNCTIONS & TRANSACTIONS
--  ---------------------------------------------------------------------------
--  DBMS MODULE 2  ·  OWNER: Rahul Singh
--  Focus: procedural SQL — stored procedures, user-defined functions,
--         transactions (COMMIT / ROLLBACK / SAVEPOINT), row locking, a CURSOR.
--  DBMS concepts: routines, parameters (IN/OUT), transactions, isolation,
--                 SELECT ... FOR UPDATE, handlers, SIGNAL, cursors, loops.
--
--  Load WITH 05_triggers.sql (resource_pools.available_units is kept in sync by
--  Karan's trigger, so these routines only touch the claim rows).
--  mysql -u root -p smart_factory < database/04_procedures.sql
-- ===========================================================================
USE smart_factory;

DROP PROCEDURE IF EXISTS sp_add_order;
DROP PROCEDURE IF EXISTS sp_complete_order;
DROP PROCEDURE IF EXISTS sp_record_schedule_run;
DROP PROCEDURE IF EXISTS sp_allocate_resources;
DROP PROCEDURE IF EXISTS sp_restock_inventory;
DROP FUNCTION  IF EXISTS fn_orders_by_status;
DROP FUNCTION  IF EXISTS fn_pool_available;
DROP FUNCTION  IF EXISTS fn_order_need;
DROP FUNCTION  IF EXISTS fn_pool_total_need;
DROP FUNCTION  IF EXISTS fn_avg_waiting;

DELIMITER $$

-- ===========================  FUNCTIONS  ===================================

-- Count orders in a given status.
CREATE FUNCTION fn_orders_by_status(p_status VARCHAR(20))
RETURNS INT DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE c INT;
  SELECT COUNT(*) INTO c FROM production_orders WHERE status = p_status;
  RETURN c;
END$$

-- Units currently free in a pool.
CREATE FUNCTION fn_pool_available(p_pool_id INT)
RETURNS INT DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE a INT;
  SELECT available_units INTO a FROM resource_pools WHERE pool_id = p_pool_id;
  RETURN IFNULL(a, 0);
END$$

-- Remaining need of one order for one pool  (Need = Max - Allocation).
CREATE FUNCTION fn_order_need(p_order_id INT, p_pool_id INT)
RETURNS INT DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE n INT;
  SELECT (max_units - allocated_units) INTO n
  FROM order_resource_claims WHERE order_id = p_order_id AND pool_id = p_pool_id;
  RETURN IFNULL(n, 0);
END$$

-- Total outstanding need for a pool across all active orders.
CREATE FUNCTION fn_pool_total_need(p_pool_id INT)
RETURNS INT DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE n INT;
  SELECT IFNULL(SUM(c.max_units - c.allocated_units), 0) INTO n
  FROM order_resource_claims c
  JOIN production_orders o ON o.order_id = c.order_id
  WHERE c.pool_id = p_pool_id AND o.status <> 'COMPLETED';
  RETURN n;
END$$

-- Average waiting time recorded for an algorithm (0 if never run).
CREATE FUNCTION fn_avg_waiting(p_algorithm VARCHAR(20))
RETURNS DECIMAL(8,3) DETERMINISTIC READS SQL DATA
BEGIN
  DECLARE a DECIMAL(8,3);
  SELECT AVG(avg_waiting) INTO a FROM schedule_runs WHERE algorithm = p_algorithm;
  RETURN IFNULL(a, 0);
END$$

-- ===========================  PROCEDURES  =================================

-- Create an order + one claim row per pool, atomically.
CREATE PROCEDURE sp_add_order(
  IN p_product VARCHAR(120), IN p_quantity INT, IN p_arrival INT, IN p_exec INT,
  IN p_priority INT, IN p_deadline INT, IN p_machine VARCHAR(60), OUT p_order_id INT)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
    INSERT INTO production_orders
      (product_name, quantity, arrival_time, execution_time, priority, deadline, required_machine_type)
    VALUES (p_product, p_quantity, p_arrival, p_exec, p_priority, p_deadline, p_machine);
    SET p_order_id = LAST_INSERT_ID();
    INSERT INTO order_resource_claims (order_id, pool_id, allocated_units, max_units)
    SELECT p_order_id, pool_id, 0,
           CASE WHEN auto_managed AND (pool_name = 'Workers' OR pool_name = CONCAT(p_machine, ' slots')) THEN 1 ELSE 0 END
    FROM resource_pools;
  COMMIT;
END$$

-- Complete an order: free its machine and worker, release its claims (pools are
-- recomputed by the trigger), set status COMPLETED — all atomically.
CREATE PROCEDURE sp_complete_order(IN p_order_id INT)
BEGIN
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
    UPDATE machines m JOIN resource_allocations a ON a.machine_id = m.machine_id
      SET m.status = 'AVAILABLE'
      WHERE a.order_id = p_order_id AND a.status = 'ALLOCATED' AND m.status = 'BUSY';
    UPDATE workers w JOIN resource_allocations a ON a.worker_id = w.worker_id
      SET w.status = 'AVAILABLE'
      WHERE a.order_id = p_order_id AND a.status = 'ALLOCATED' AND w.status = 'ASSIGNED';
    UPDATE resource_allocations  SET status = 'RELEASED' WHERE order_id = p_order_id AND status = 'ALLOCATED';
    UPDATE order_resource_claims SET allocated_units = 0, requested_units = 0 WHERE order_id = p_order_id;
    UPDATE production_orders      SET status = 'COMPLETED' WHERE order_id = p_order_id;
  COMMIT;
END$$

-- Persist a scheduling-run header and return its id.
CREATE PROCEDURE sp_record_schedule_run(
  IN p_algorithm VARCHAR(20), IN p_quantum INT,
  IN p_avg_wait DECIMAL(8,3), IN p_avg_turn DECIMAL(8,3), IN p_avg_resp DECIMAL(8,3),
  IN p_throughput DECIMAL(8,3), IN p_makespan INT, OUT p_run_id BIGINT)
BEGIN
  INSERT INTO schedule_runs
    (algorithm, quantum, avg_waiting, avg_turnaround, avg_response, throughput, makespan)
  VALUES (p_algorithm, p_quantum, p_avg_wait, p_avg_turn, p_avg_resp, p_throughput, p_makespan);
  SET p_run_id = LAST_INSERT_ID();
END$$

-- Safely grant resources to an order. Demonstrates row locking (FOR UPDATE),
-- a SAVEPOINT, validation and SIGNAL. Only the claim is updated; the trigger
-- keeps resource_pools.available_units consistent.
CREATE PROCEDURE sp_allocate_resources(IN p_order INT, IN p_pool INT, IN p_units INT)
BEGIN
  DECLARE v_avail INT; DECLARE v_alloc INT; DECLARE v_max INT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;

  START TRANSACTION;
    SELECT available_units INTO v_avail FROM resource_pools WHERE pool_id = p_pool FOR UPDATE;
    SELECT allocated_units, max_units INTO v_alloc, v_max
      FROM order_resource_claims WHERE order_id = p_order AND pool_id = p_pool FOR UPDATE;

    SAVEPOINT before_alloc;
    IF p_units <= 0 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requested units must be positive';
    END IF;
    IF v_alloc + p_units > v_max THEN
      ROLLBACK TO before_alloc;
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation would exceed the declared maximum (Need)';
    END IF;
    IF p_units > v_avail THEN
      ROLLBACK TO before_alloc;
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Not enough available units in the pool';
    END IF;

    UPDATE order_resource_claims
      SET allocated_units = allocated_units + p_units
      WHERE order_id = p_order AND pool_id = p_pool;
  COMMIT;
END$$

-- Top up every low-stock material to (reorder_level * p_multiplier) using a
-- CURSOR. Each UPDATE is logged to the ledger by Karan's trigger.
CREATE PROCEDURE sp_restock_inventory(IN p_multiplier INT)
BEGIN
  DECLARE v_done INT DEFAULT 0;
  DECLARE v_id INT; DECLARE v_reorder INT;
  DECLARE cur CURSOR FOR
    SELECT material_id, reorder_level FROM inventory WHERE quantity_available <= reorder_level;
  DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_done = 1;

  IF p_multiplier < 1 THEN SET p_multiplier = 2; END IF;

  START TRANSACTION;
  OPEN cur;
  restock_loop: LOOP
    FETCH cur INTO v_id, v_reorder;
    IF v_done = 1 THEN LEAVE restock_loop; END IF;
    UPDATE inventory SET quantity_available = v_reorder * p_multiplier WHERE material_id = v_id;
  END LOOP;
  CLOSE cur;
  COMMIT;
END$$

DELIMITER ;

SELECT 'Procedures and functions created.' AS status;
