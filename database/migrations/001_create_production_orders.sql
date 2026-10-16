-- Migration: 001_create_production_orders
-- Member: Aman Singh Rawat
-- Description: Creates the production_orders, production_steps, and schedules tables

CREATE DATABASE IF NOT EXISTS smart_factory;
USE smart_factory;

-- Table: production_orders
-- Each row represents one production order (modeled as an OS process)
CREATE TABLE IF NOT EXISTS production_orders (
    order_id        INT AUTO_INCREMENT PRIMARY KEY,
    order_name      VARCHAR(100) NOT NULL,
    product_name    VARCHAR(100) NOT NULL,
    quantity        INT NOT NULL DEFAULT 1,
    priority        INT NOT NULL DEFAULT 5,          -- 1 = highest, 10 = lowest
    execution_time  INT NOT NULL,                    -- estimated time in minutes
    arrival_time    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deadline        DATETIME NOT NULL,
    process_state   ENUM('NEW', 'READY', 'RUNNING', 'WAITING', 'COMPLETED', 'TERMINATED')
                    NOT NULL DEFAULT 'NEW',
    created_by      INT NOT NULL,                    -- FK to users.user_id
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT chk_priority   CHECK (priority BETWEEN 1 AND 10),
    CONSTRAINT chk_quantity   CHECK (quantity > 0),
    CONSTRAINT chk_exec_time  CHECK (execution_time > 0)
);

-- Table: production_steps
-- Each production order can have multiple sequential steps
CREATE TABLE IF NOT EXISTS production_steps (
    step_id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id        INT NOT NULL,
    step_number     INT NOT NULL,
    step_name       VARCHAR(100) NOT NULL,
    step_duration   INT NOT NULL,                    -- duration in minutes
    step_state      ENUM('PENDING', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'PENDING',
    machine_id      INT,                             -- FK to machines.machine_id
    worker_id       INT,                             -- FK to workers.worker_id
    started_at      DATETIME,
    completed_at    DATETIME,
    CONSTRAINT fk_step_order FOREIGN KEY (order_id)
        REFERENCES production_orders(order_id) ON DELETE CASCADE
);

-- Table: schedules
-- Stores the scheduling result produced by the OS Scheduling Engine
CREATE TABLE IF NOT EXISTS schedules (
    schedule_id     INT AUTO_INCREMENT PRIMARY KEY,
    order_id        INT NOT NULL,
    algorithm       ENUM('FCFS', 'SJF', 'PRIORITY') NOT NULL,
    scheduled_start DATETIME NOT NULL,
    scheduled_end   DATETIME NOT NULL,
    actual_start    DATETIME,
    actual_end      DATETIME,
    turnaround_time INT,                             -- in minutes
    waiting_time    INT,                             -- in minutes
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_schedule_order FOREIGN KEY (order_id)
        REFERENCES production_orders(order_id) ON DELETE CASCADE
);

-- Indexes for fast querying
CREATE INDEX idx_orders_state    ON production_orders(process_state);
CREATE INDEX idx_orders_priority ON production_orders(priority);
CREATE INDEX idx_orders_deadline ON production_orders(deadline);
CREATE INDEX idx_steps_order     ON production_steps(order_id);
CREATE INDEX idx_schedule_order  ON schedules(order_id);
