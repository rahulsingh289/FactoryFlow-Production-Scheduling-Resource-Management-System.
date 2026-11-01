-- ===========================================================================
--  Smart Factory Production Scheduler  —  TRIGGERS, AUDITING & EVENTS
--  ---------------------------------------------------------------------------
--  DBMS MODULE 3  ·  OWNER: Karan Singh
--  Focus: automation and data integrity with triggers; an append-only audit /
--         ledger; a scheduled EVENT.
--  DBMS concepts: BEFORE/AFTER INSERT/UPDATE/DELETE triggers, SIGNAL, derived
--                 data maintained by the DB, trigger-based auditing, EVENTs.
--
--  Run AFTER 02_seed.sql (so resource_pools.available_units starts correct).
--  mysql -u root -p smart_factory < database/05_triggers.sql
-- ===========================================================================
USE smart_factory;

DROP TRIGGER IF EXISTS trg_order_after_insert;
DROP TRIGGER IF EXISTS trg_order_after_update;
DROP TRIGGER IF EXISTS trg_claim_before_insert;
DROP TRIGGER IF EXISTS trg_claim_before_update;
DROP TRIGGER IF EXISTS trg_claim_after_insert;
DROP TRIGGER IF EXISTS trg_claim_after_update;
DROP TRIGGER IF EXISTS trg_claim_after_delete;
DROP TRIGGER IF EXISTS trg_inventory_after_update;
DROP TRIGGER IF EXISTS trg_machine_before_delete;
DROP EVENT   IF EXISTS ev_daily_lowstock_report;

DELIMITER $$

-- ---- Audit: production orders --------------------------------------------
CREATE TRIGGER trg_order_after_insert
AFTER INSERT ON production_orders FOR EACH ROW
BEGIN
  INSERT INTO audit_log (entity, entity_id, action, details)
  VALUES ('production_orders', NEW.order_id, 'INSERT',
          CONCAT('Created "', NEW.product_name, '" (qty ', NEW.quantity, ', priority ', NEW.priority, ')'));
END$$

CREATE TRIGGER trg_order_after_update
AFTER UPDATE ON production_orders FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO audit_log (entity, entity_id, action, details)
    VALUES ('production_orders', NEW.order_id, 'STATUS_CHANGE',
            CONCAT('Order ', NEW.order_id, ': ', OLD.status, ' -> ', NEW.status));
  END IF;
END$$

-- ---- Integrity: claims never allocate beyond their maximum -----------------
CREATE TRIGGER trg_claim_before_insert
BEFORE INSERT ON order_resource_claims FOR EACH ROW
BEGIN
  IF NEW.allocated_units > NEW.max_units THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'allocated_units cannot exceed max_units';
  END IF;
END$$

CREATE TRIGGER trg_claim_before_update
BEFORE UPDATE ON order_resource_claims FOR EACH ROW
BEGIN
  IF NEW.allocated_units > NEW.max_units THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'allocated_units cannot exceed max_units';
  END IF;
END$$

-- ---- Derived data: keep resource_pools.available_units in sync -------------
-- available_units = total_units - SUM(allocated across claims). Maintained
-- incrementally so the application never has to recompute pool balances.
CREATE TRIGGER trg_claim_after_insert
AFTER INSERT ON order_resource_claims FOR EACH ROW
BEGIN
  UPDATE resource_pools SET available_units = available_units - NEW.allocated_units
  WHERE pool_id = NEW.pool_id;
END$$

CREATE TRIGGER trg_claim_after_update
AFTER UPDATE ON order_resource_claims FOR EACH ROW
BEGIN
  UPDATE resource_pools
  SET available_units = available_units - (NEW.allocated_units - OLD.allocated_units)
  WHERE pool_id = NEW.pool_id;
END$$

CREATE TRIGGER trg_claim_after_delete
AFTER DELETE ON order_resource_claims FOR EACH ROW
BEGIN
  UPDATE resource_pools SET available_units = available_units + OLD.allocated_units
  WHERE pool_id = OLD.pool_id;
END$$

-- ---- Inventory ledger + low-stock alert ------------------------------------
CREATE TRIGGER trg_inventory_after_update
AFTER UPDATE ON inventory FOR EACH ROW
BEGIN
  IF NEW.quantity_available <> OLD.quantity_available THEN
    INSERT INTO inventory_transactions (material_id, delta, balance_after, reason)
    VALUES (NEW.material_id,
            NEW.quantity_available - OLD.quantity_available,
            NEW.quantity_available,
            IF(NEW.quantity_available > OLD.quantity_available, 'RESTOCK', 'CONSUME'));
  END IF;
  -- generated column below_reorder is already computed in an AFTER trigger
  IF NEW.below_reorder = TRUE AND OLD.below_reorder = FALSE THEN
    INSERT INTO audit_log (entity, entity_id, action, details)
    VALUES ('inventory', NEW.material_id, 'LOW_STOCK',
            CONCAT(NEW.material_name, ' dropped to ', NEW.quantity_available, ' ', NEW.unit));
  END IF;
END$$

-- ---- Guard: do not delete a machine that is actively allocated -------------
CREATE TRIGGER trg_machine_before_delete
BEFORE DELETE ON machines FOR EACH ROW
BEGIN
  IF (SELECT COUNT(*) FROM resource_allocations
      WHERE machine_id = OLD.machine_id AND status = 'ALLOCATED') > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cannot delete a machine with active allocations';
  END IF;
END$$

DELIMITER ;

-- ---- Scheduled EVENT: daily low-stock summary into the audit log -----------
SET GLOBAL event_scheduler = ON;

DELIMITER $$
CREATE EVENT ev_daily_lowstock_report
ON SCHEDULE EVERY 1 DAY
COMMENT 'Logs a daily count of materials at or below reorder level'
DO
BEGIN
  INSERT INTO audit_log (entity, action, details)
  SELECT 'inventory', 'LOW_STOCK_REPORT',
         CONCAT(COUNT(*), ' material(s) at or below reorder level')
  FROM inventory WHERE below_reorder = TRUE;
END$$
DELIMITER ;

SELECT 'Triggers and scheduled event created.' AS status;
