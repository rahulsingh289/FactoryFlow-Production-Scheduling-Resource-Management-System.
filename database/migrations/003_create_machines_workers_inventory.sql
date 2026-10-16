-- Migration: 003_create_machines_workers_inventory
-- Member: Karan Singh
-- Description: Creates machines, workers, inventory, and maintenance_records tables.
--              Machines and workers are the physical assets assigned to production steps.
--              Inventory tracks raw material stock levels.

USE smart_factory;

-- Table: machines
-- Each row is one physical machine on the factory floor
CREATE TABLE IF NOT EXISTS machines (
    machine_id      INT AUTO_INCREMENT PRIMARY KEY,
    machine_name    VARCHAR(100) NOT NULL,
    machine_type    VARCHAR(50)  NOT NULL,           -- e.g. "CNC", "Lathe", "Welding", "Assembly"
    status          ENUM('IDLE', 'BUSY', 'MAINTENANCE', 'OFFLINE')
                    NOT NULL DEFAULT 'IDLE',
    location        VARCHAR(100),                    -- factory zone / bay
    capacity_per_hr INT NOT NULL DEFAULT 1,          -- units it can process per hour
    resource_id     INT,                             -- FK to resources (machine registered as resource)
    purchased_on    DATE,
    last_serviced   DATE,
    next_service_due DATE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_machine_resource FOREIGN KEY (resource_id)
        REFERENCES resources(resource_id) ON DELETE SET NULL,
    CONSTRAINT chk_capacity CHECK (capacity_per_hr > 0)
);

-- Table: maintenance_records
-- Tracks every maintenance event for each machine
CREATE TABLE IF NOT EXISTS maintenance_records (
    record_id       INT AUTO_INCREMENT PRIMARY KEY,
    machine_id      INT NOT NULL,
    maintenance_type ENUM('SCHEDULED', 'EMERGENCY', 'INSPECTION') NOT NULL,
    description     TEXT,
    performed_by    VARCHAR(100),
    started_at      DATETIME NOT NULL,
    completed_at    DATETIME,
    cost            DECIMAL(10,2) DEFAULT 0.00,
    CONSTRAINT fk_maint_machine FOREIGN KEY (machine_id)
        REFERENCES machines(machine_id) ON DELETE CASCADE
);

-- Table: workers
-- Each row is one factory worker (human labour resource)
CREATE TABLE IF NOT EXISTS workers (
    worker_id       INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(50)  NOT NULL,
    last_name       VARCHAR(50)  NOT NULL,
    employee_code   VARCHAR(20)  NOT NULL UNIQUE,
    skill_set       VARCHAR(255),                    -- comma-separated skills e.g. "Welding,CNC,Assembly"
    shift           ENUM('MORNING', 'AFTERNOON', 'NIGHT', 'FLEXIBLE')
                    NOT NULL DEFAULT 'MORNING',
    status          ENUM('AVAILABLE', 'ASSIGNED', 'ON_LEAVE', 'INACTIVE')
                    NOT NULL DEFAULT 'AVAILABLE',
    resource_id     INT,                             -- FK to resources (worker registered as resource)
    hourly_rate     DECIMAL(8,2) DEFAULT 0.00,
    hire_date       DATE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_worker_resource FOREIGN KEY (resource_id)
        REFERENCES resources(resource_id) ON DELETE SET NULL
);

-- Table: worker_assignments
-- Tracks which worker is assigned to which production step
CREATE TABLE IF NOT EXISTS worker_assignments (
    assignment_id   INT AUTO_INCREMENT PRIMARY KEY,
    worker_id       INT NOT NULL,
    order_id        INT NOT NULL,
    step_id         INT,                             -- FK to production_steps
    assigned_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at     DATETIME,
    assignment_state ENUM('ACTIVE', 'COMPLETED', 'CANCELLED')
                    NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT fk_assign_worker FOREIGN KEY (worker_id)
        REFERENCES workers(worker_id) ON DELETE CASCADE,
    CONSTRAINT fk_assign_order  FOREIGN KEY (order_id)
        REFERENCES production_orders(order_id) ON DELETE CASCADE
);

-- Table: inventory
-- Tracks raw material and component stock levels
CREATE TABLE IF NOT EXISTS inventory (
    item_id         INT AUTO_INCREMENT PRIMARY KEY,
    item_name       VARCHAR(100) NOT NULL,
    item_code       VARCHAR(50)  NOT NULL UNIQUE,
    category        VARCHAR(50)  NOT NULL,           -- e.g. "Raw Material", "Component", "Tool"
    unit            VARCHAR(20)  NOT NULL DEFAULT 'units',  -- kg, litres, units, metres
    quantity_in_stock   DECIMAL(10,2) NOT NULL DEFAULT 0,
    minimum_stock_level DECIMAL(10,2) NOT NULL DEFAULT 0,  -- triggers low-stock alert
    reorder_quantity    DECIMAL(10,2) DEFAULT 0,
    unit_cost       DECIMAL(10,2) DEFAULT 0.00,
    supplier_name   VARCHAR(100),
    last_restocked  DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_qty_stock  CHECK (quantity_in_stock >= 0),
    CONSTRAINT chk_min_stock  CHECK (minimum_stock_level >= 0)
);

-- Table: inventory_transactions
-- Audit trail for every stock change (consumption, restock, adjustment)
CREATE TABLE IF NOT EXISTS inventory_transactions (
    txn_id          INT AUTO_INCREMENT PRIMARY KEY,
    item_id         INT NOT NULL,
    order_id        INT,                             -- NULL if manual adjustment
    txn_type        ENUM('CONSUMED', 'RESTOCKED', 'ADJUSTED', 'RESERVED')
                    NOT NULL,
    quantity_change DECIMAL(10,2) NOT NULL,          -- negative = consumed, positive = restocked
    quantity_after  DECIMAL(10,2) NOT NULL,          -- stock level after this transaction
    notes           TEXT,
    performed_by    INT,                             -- FK to users.user_id
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inv_txn_item  FOREIGN KEY (item_id)
        REFERENCES inventory(item_id) ON DELETE CASCADE,
    CONSTRAINT fk_inv_txn_order FOREIGN KEY (order_id)
        REFERENCES production_orders(order_id) ON DELETE SET NULL
);

-- Indexes for fast lookups
CREATE INDEX idx_machine_status     ON machines(status);
CREATE INDEX idx_machine_type       ON machines(machine_type);
CREATE INDEX idx_worker_status      ON workers(status);
CREATE INDEX idx_worker_shift       ON workers(shift);
CREATE INDEX idx_inventory_category ON inventory(category);
CREATE INDEX idx_inventory_stock    ON inventory(quantity_in_stock);
CREATE INDEX idx_worker_assign      ON worker_assignments(worker_id, assignment_state);
