-- ===========================================================================
--  Smart Factory Production Scheduler  —  DATABASE SCHEMA (DDL)
--  ---------------------------------------------------------------------------
--  DBMS MODULE 1  ·  OWNER: Aman Singh Rawat (Team Lead)
--  Focus: schema design, normalisation (to BCNF), integrity constraints,
--         generated columns, and indexing strategy.
--  DBMS concepts: DDL, PK/FK, ON DELETE/UPDATE actions, CHECK, ENUM, UNIQUE,
--                 composite & secondary indexes, STORED generated columns.
--
--  Run order:  01_schema.sql -> 02_seed.sql -> 03_views.sql -> 04_procedures.sql
--                                     -> 05_triggers.sql -> 06_security.sql (optional)
--  CLI:        mysql -u root -p < database/01_schema.sql
--
--  This file never drops anything, so it fails rather than overwrite existing
--  tables. To start over, run DROP DATABASE smart_factory; yourself first.
-- ===========================================================================

CREATE DATABASE IF NOT EXISTS smart_factory CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smart_factory;

-- ---------------------------------------------------------------------------
-- 1. Users  (dashboard authentication)
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  user_id       INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  email         VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  role          ENUM('MANAGER','OPERATOR') NOT NULL DEFAULT 'MANAGER',
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 2. Machines  (physical production equipment)
-- ---------------------------------------------------------------------------
CREATE TABLE machines (
  machine_id   INT AUTO_INCREMENT PRIMARY KEY,
  machine_name VARCHAR(100) NOT NULL UNIQUE,
  machine_type VARCHAR(60)  NOT NULL,
  capacity     INT NOT NULL DEFAULT 1,
  status       ENUM('AVAILABLE','BUSY','MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT chk_machine_capacity CHECK (capacity > 0),
  INDEX idx_machine_type_status (machine_type, status)   -- composite: lookups by type+status
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 3. Workers  (operators assigned to orders)
-- ---------------------------------------------------------------------------
CREATE TABLE workers (
  worker_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  skill     VARCHAR(100) NOT NULL,
  machine_type VARCHAR(60) NULL,   -- the machine type this worker is trained on; NULL = any machine
  status    ENUM('AVAILABLE','ASSIGNED','OFF_SHIFT') NOT NULL DEFAULT 'AVAILABLE',
  INDEX idx_worker_status (status)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 4. Inventory  (raw materials)
--    below_reorder is a STORED generated column — the DB derives it so the
--    application never has to compute "is this material low?".
-- ---------------------------------------------------------------------------
CREATE TABLE inventory (
  material_id        INT AUTO_INCREMENT PRIMARY KEY,
  material_name      VARCHAR(100) NOT NULL UNIQUE,
  quantity_available INT NOT NULL DEFAULT 0,
  reorder_level      INT NOT NULL DEFAULT 0,
  unit               VARCHAR(20) NOT NULL DEFAULT 'units',
  below_reorder      BOOLEAN AS (quantity_available <= reorder_level) STORED,
  CONSTRAINT chk_inv_qty     CHECK (quantity_available >= 0),
  CONSTRAINT chk_inv_reorder CHECK (reorder_level >= 0),
  INDEX idx_inv_low (below_reorder)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 5. Production Orders  (each order = an OS process / PCB)
--    priority: 1 = highest ... 5 = lowest
-- ---------------------------------------------------------------------------
CREATE TABLE production_orders (
  order_id              INT AUTO_INCREMENT PRIMARY KEY,
  product_name          VARCHAR(120) NOT NULL,
  quantity              INT NOT NULL,
  arrival_time          INT NOT NULL DEFAULT 0,
  execution_time        INT NOT NULL,
  priority              INT NOT NULL DEFAULT 3,
  deadline              INT NOT NULL,
  required_machine_type VARCHAR(60),
  status                ENUM('READY','RUNNING','BLOCKED','COMPLETED') NOT NULL DEFAULT 'READY',
  materials_taken       BOOLEAN NOT NULL DEFAULT FALSE,  -- stock is deducted once, when the order first starts
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ord_qty      CHECK (quantity > 0),
  CONSTRAINT chk_ord_arrival  CHECK (arrival_time >= 0),
  CONSTRAINT chk_ord_exec     CHECK (execution_time > 0),
  CONSTRAINT chk_ord_priority CHECK (priority BETWEEN 1 AND 5),
  CONSTRAINT chk_ord_deadline CHECK (deadline >= 0),
  INDEX idx_ord_status_priority (status, priority)  -- composite: ready-queue ordering
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 6. Resource Pools  (abstract resource TYPES for Banker's Algorithm)
-- ---------------------------------------------------------------------------
CREATE TABLE resource_pools (
  pool_id         INT AUTO_INCREMENT PRIMARY KEY,
  pool_name       VARCHAR(100) NOT NULL UNIQUE,
  total_units     INT NOT NULL,
  available_units INT NOT NULL,
  auto_managed    BOOLEAN NOT NULL DEFAULT FALSE,  -- kept in step with machines / workers
  CONSTRAINT chk_pool_total CHECK (total_units >= 0),
  CONSTRAINT chk_pool_avail CHECK (available_units >= 0 AND available_units <= total_units)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 7. Order Resource Claims  (Allocation & Max matrices; Need = max - allocated)
--    Composite primary key (order_id, pool_id) = a junction / associative table.
-- ---------------------------------------------------------------------------
CREATE TABLE order_resource_claims (
  order_id        INT NOT NULL,
  pool_id         INT NOT NULL,
  allocated_units INT NOT NULL DEFAULT 0,
  max_units       INT NOT NULL,
  requested_units INT NOT NULL DEFAULT 0,  -- Request matrix for deadlock detection
  PRIMARY KEY (order_id, pool_id),
  CONSTRAINT chk_claim_alloc CHECK (allocated_units >= 0),
  CONSTRAINT chk_claim_max   CHECK (max_units >= 0),
  CONSTRAINT chk_claim_le    CHECK (allocated_units <= max_units),
  CONSTRAINT fk_claim_order FOREIGN KEY (order_id) REFERENCES production_orders(order_id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_claim_pool  FOREIGN KEY (pool_id)  REFERENCES resource_pools(pool_id)     ON DELETE CASCADE ON UPDATE CASCADE,
  -- Finished orders keep their rows (all zeros) for ever. Pool totals only add up
  -- the units actually held, so this lets them skip all of those.
  -- (Keep in step with backend/src/db/index.js.)
  INDEX idx_claim_held (allocated_units, pool_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 8. Resource Allocations  (physical machine/worker assigned to an order)
-- ---------------------------------------------------------------------------
CREATE TABLE resource_allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id      INT NOT NULL,
  machine_id    INT NULL,
  worker_id     INT NULL,
  status        ENUM('ALLOCATED','RELEASED','WAITING') NOT NULL DEFAULT 'WAITING',
  allocated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_alloc_order   FOREIGN KEY (order_id)   REFERENCES production_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id)        ON DELETE SET NULL,
  CONSTRAINT fk_alloc_worker  FOREIGN KEY (worker_id)  REFERENCES workers(worker_id)          ON DELETE SET NULL,
  INDEX idx_alloc_order_status (order_id, status),
  -- Released rows are kept as history and pile up, while almost every lookup is
  -- for the few that are still ALLOCATED. These keep those lookups small.
  -- (Keep in step with ensureIndexes in backend/src/db/index.js.)
  INDEX idx_alloc_machine_status (machine_id, status),
  INDEX idx_alloc_worker_status (worker_id, status),
  INDEX idx_alloc_status_machine (status, machine_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 9. Schedule Runs  (one row per scheduler execution)
-- ---------------------------------------------------------------------------
CREATE TABLE schedule_runs (
  run_id         BIGINT AUTO_INCREMENT PRIMARY KEY,
  algorithm      VARCHAR(20) NOT NULL,
  quantum        INT NOT NULL DEFAULT 0,
  avg_waiting    DECIMAL(8,3) NOT NULL DEFAULT 0,
  avg_turnaround DECIMAL(8,3) NOT NULL DEFAULT 0,
  avg_response   DECIMAL(8,3) NOT NULL DEFAULT 0,
  throughput     DECIMAL(8,3) NOT NULL DEFAULT 0,
  makespan       INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_run_algo (algorithm)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 10. Schedule Entries  (per-order result inside a run)
-- ---------------------------------------------------------------------------
CREATE TABLE schedule_entries (
  entry_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  run_id          BIGINT NOT NULL,
  order_id        INT NOT NULL,
  start_time      INT NOT NULL,
  completion_time INT NOT NULL,
  waiting_time    INT NOT NULL,
  turnaround_time INT NOT NULL,
  response_time   INT NOT NULL,
  missed_deadline BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT chk_entry_times CHECK (completion_time >= start_time),
  CONSTRAINT fk_entry_run   FOREIGN KEY (run_id)   REFERENCES schedule_runs(run_id)      ON DELETE CASCADE,
  CONSTRAINT fk_entry_order FOREIGN KEY (order_id) REFERENCES production_orders(order_id) ON DELETE CASCADE,
  INDEX idx_entry_run (run_id)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 11. Maintenance Records
-- ---------------------------------------------------------------------------
CREATE TABLE maintenance_records (
  maintenance_id   INT AUTO_INCREMENT PRIMARY KEY,
  machine_id       INT NOT NULL,
  description      VARCHAR(255) NOT NULL,
  maintenance_date DATE NOT NULL,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_maint_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 12. Inventory Transactions  (append-only stock ledger; written by triggers)
-- ---------------------------------------------------------------------------
CREATE TABLE inventory_transactions (
  txn_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  material_id   INT NOT NULL,
  delta         INT NOT NULL,                 -- +restock / -consume
  balance_after INT NOT NULL,
  reason        VARCHAR(60) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_invtxn_material FOREIGN KEY (material_id) REFERENCES inventory(material_id) ON DELETE CASCADE,
  INDEX idx_invtxn_material (material_id, created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 13. Audit Log  (written automatically by triggers)
-- ---------------------------------------------------------------------------
CREATE TABLE audit_log (
  log_id     BIGINT AUTO_INCREMENT PRIMARY KEY,
  entity     VARCHAR(40)  NOT NULL,
  entity_id  INT          NULL,
  action     VARCHAR(40)  NOT NULL,
  details    VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity),
  INDEX idx_audit_time (created_at)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------------
-- 14. Order Materials  (what an order uses; deducted from inventory when it starts)
--     Composite primary key (order_id, material_id) = a junction table.
--     Keep this in step with the copy in backend/src/db/index.js, which adds it
--     to databases created before it existed.
-- ---------------------------------------------------------------------------
CREATE TABLE order_materials (
  order_id    INT NOT NULL,
  material_id INT NOT NULL,
  quantity    INT NOT NULL,
  PRIMARY KEY (order_id, material_id),
  CONSTRAINT chk_om_qty CHECK (quantity > 0),
  CONSTRAINT fk_om_order    FOREIGN KEY (order_id)    REFERENCES production_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_om_material FOREIGN KEY (material_id) REFERENCES inventory(material_id)      ON DELETE CASCADE
) ENGINE=InnoDB;

SELECT 'Schema created successfully (14 tables).' AS status;
