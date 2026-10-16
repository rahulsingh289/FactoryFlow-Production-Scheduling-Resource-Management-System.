-- Migration: 002_create_resources
-- Member: Rahul Singh
-- Description: Creates resources, resource_allocations, and robots tables.
--              These tables feed directly into the Banker's Algorithm and
--              deadlock detection logic in the OS Engine.

USE smart_factory;

-- Table: resources
-- Represents every type of limited resource in the factory
-- (machines, robots, raw materials are registered here as resource types)
CREATE TABLE IF NOT EXISTS resources (
    resource_id     INT AUTO_INCREMENT PRIMARY KEY,
    resource_name   VARCHAR(100) NOT NULL,
    resource_type   ENUM('MACHINE', 'ROBOT', 'MATERIAL', 'WORKER') NOT NULL,
    total_units     INT NOT NULL,                   -- maximum available units
    available_units INT NOT NULL,                   -- currently free units
    unit_label      VARCHAR(30) NOT NULL DEFAULT 'units',  -- e.g. "kg", "units", "hours"
    description     VARCHAR(255),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_total_units     CHECK (total_units > 0),
    CONSTRAINT chk_available_units CHECK (available_units >= 0),
    CONSTRAINT chk_available_lte   CHECK (available_units <= total_units)
);

-- Table: robots
-- Stores robot-specific details (robots are also registered in resources)
CREATE TABLE IF NOT EXISTS robots (
    robot_id        INT AUTO_INCREMENT PRIMARY KEY,
    resource_id     INT NOT NULL,                   -- FK to resources
    robot_name      VARCHAR(100) NOT NULL,
    robot_type      VARCHAR(50) NOT NULL,           -- e.g. "Welding", "Assembly", "Painting"
    status          ENUM('IDLE', 'BUSY', 'MAINTENANCE', 'OFFLINE') NOT NULL DEFAULT 'IDLE',
    last_serviced   DATE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_robot_resource FOREIGN KEY (resource_id)
        REFERENCES resources(resource_id) ON DELETE CASCADE
);

-- Table: resource_allocations
-- Tracks which production order currently holds which resources.
-- This is the Allocation Matrix used by Banker's Algorithm.
CREATE TABLE IF NOT EXISTS resource_allocations (
    allocation_id   INT AUTO_INCREMENT PRIMARY KEY,
    order_id        INT NOT NULL,                   -- FK to production_orders
    resource_id     INT NOT NULL,                   -- FK to resources
    units_requested INT NOT NULL,                   -- how many units the order wants
    units_allocated INT NOT NULL DEFAULT 0,         -- how many units are currently granted
    allocation_state ENUM('REQUESTED', 'ALLOCATED', 'RELEASED', 'DENIED')
                     NOT NULL DEFAULT 'REQUESTED',
    requested_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    allocated_at    DATETIME,
    released_at     DATETIME,
    CONSTRAINT fk_alloc_order    FOREIGN KEY (order_id)
        REFERENCES production_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_alloc_resource FOREIGN KEY (resource_id)
        REFERENCES resources(resource_id) ON DELETE CASCADE,
    CONSTRAINT chk_units_req     CHECK (units_requested > 0),
    CONSTRAINT chk_units_alloc   CHECK (units_allocated >= 0)
);

-- Table: deadlock_logs
-- Records every deadlock event detected by the OS Engine for audit purposes
CREATE TABLE IF NOT EXISTS deadlock_logs (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    detected_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    involved_orders TEXT NOT NULL,                  -- comma-separated order_ids in the cycle
    involved_resources TEXT NOT NULL,               -- comma-separated resource_ids
    resolution      ENUM('TERMINATED_PROCESS', 'RESOURCE_PREEMPTED', 'NONE')
                    NOT NULL DEFAULT 'NONE',
    resolved_at     DATETIME,
    notes           TEXT
);

-- Indexes for fast Banker's Algorithm lookups
CREATE INDEX idx_alloc_order    ON resource_allocations(order_id);
CREATE INDEX idx_alloc_resource ON resource_allocations(resource_id);
CREATE INDEX idx_alloc_state    ON resource_allocations(allocation_state);
CREATE INDEX idx_resource_type  ON resources(resource_type);
