-- Migration: 004_create_users_history_audit
-- Member: Anmol Bhatt
-- Description: Creates users, production_history, audit_logs, and
--              performance_reports tables.
--              users        — authentication and role management
--              production_history — completed order records for analytics
--              audit_logs   — every state-change event in the system
--              performance_reports — pre-computed metrics per schedule run

USE smart_factory;

-- Table: users
-- Factory managers and operators who log into the system
CREATE TABLE IF NOT EXISTS users (
    user_id         INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    email           VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,           -- bcrypt hash, never plaintext
    full_name       VARCHAR(100) NOT NULL,
    role            ENUM('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')
                    NOT NULL DEFAULT 'OPERATOR',
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login      DATETIME,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: user_sessions
-- Tracks active JWT sessions for token invalidation support
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id      INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    token_hash      VARCHAR(255) NOT NULL,           -- hash of the issued JWT
    issued_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME NOT NULL,
    is_revoked      BOOLEAN NOT NULL DEFAULT FALSE,
    ip_address      VARCHAR(45),                     -- IPv4 or IPv6
    CONSTRAINT fk_session_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE
);

-- Table: production_history
-- Immutable record of every completed (or terminated) production order.
-- Written once when an order reaches COMPLETED or TERMINATED state.
-- Used for analytics, reports, and audit trail.
CREATE TABLE IF NOT EXISTS production_history (
    history_id          INT AUTO_INCREMENT PRIMARY KEY,
    order_id            INT NOT NULL,
    order_name          VARCHAR(100) NOT NULL,
    product_name        VARCHAR(100) NOT NULL,
    quantity            INT NOT NULL,
    priority            INT NOT NULL,
    scheduling_algorithm ENUM('FCFS', 'SJF', 'PRIORITY') NOT NULL,
    final_state         ENUM('COMPLETED', 'TERMINATED') NOT NULL,
    arrival_time        DATETIME NOT NULL,
    scheduled_start     DATETIME,
    actual_start        DATETIME,
    actual_end          DATETIME,
    deadline            DATETIME NOT NULL,
    execution_time_min  INT NOT NULL,                -- planned execution time
    actual_time_min     INT,                         -- real time taken
    waiting_time_min    INT,                         -- total time spent waiting
    turnaround_time_min INT,                         -- actual_end - arrival_time
    met_deadline        BOOLEAN,                     -- TRUE if actual_end <= deadline
    machines_used       TEXT,                        -- comma-separated machine_ids
    workers_used        TEXT,                        -- comma-separated worker_ids
    created_by          INT NOT NULL,                -- FK to users
    recorded_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_order FOREIGN KEY (order_id)
        REFERENCES production_orders(order_id) ON DELETE CASCADE,
    CONSTRAINT fk_history_user  FOREIGN KEY (created_by)
        REFERENCES users(user_id) ON DELETE RESTRICT
);

-- Table: audit_logs
-- Captures every significant state change in the system.
-- Every API write action that changes data creates one audit log entry.
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id          INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT,                             -- NULL for system-generated events
    action          VARCHAR(100) NOT NULL,           -- e.g. "ORDER_CREATED", "RESOURCE_ALLOCATED"
    entity_type     VARCHAR(50)  NOT NULL,           -- "order" | "machine" | "worker" | "resource"
    entity_id       INT NOT NULL,                    -- PK of the affected row
    old_value       TEXT,                            -- JSON snapshot before change
    new_value       TEXT,                            -- JSON snapshot after change
    ip_address      VARCHAR(45),
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE SET NULL
);

-- Table: performance_reports
-- Stores aggregate performance metrics computed after each scheduling run.
-- One row per algorithm run — used by the reports dashboard.
CREATE TABLE IF NOT EXISTS performance_reports (
    report_id               INT AUTO_INCREMENT PRIMARY KEY,
    report_name             VARCHAR(100) NOT NULL,
    algorithm               ENUM('FCFS', 'SJF', 'PRIORITY') NOT NULL,
    total_orders            INT NOT NULL DEFAULT 0,
    completed_orders        INT NOT NULL DEFAULT 0,
    terminated_orders       INT NOT NULL DEFAULT 0,
    orders_met_deadline     INT NOT NULL DEFAULT 0,
    avg_waiting_time_min    DECIMAL(8,2) DEFAULT 0,
    avg_turnaround_time_min DECIMAL(8,2) DEFAULT 0,
    avg_execution_time_min  DECIMAL(8,2) DEFAULT 0,
    machine_utilization_pct DECIMAL(5,2) DEFAULT 0, -- 0.00 to 100.00
    worker_utilization_pct  DECIMAL(5,2) DEFAULT 0,
    generated_by            INT,                    -- FK to users
    generated_at            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    period_start            DATETIME,               -- reporting period start
    period_end              DATETIME,               -- reporting period end
    notes                   TEXT,
    CONSTRAINT fk_report_user FOREIGN KEY (generated_by)
        REFERENCES users(user_id) ON DELETE SET NULL
);

-- Indexes for fast queries
CREATE INDEX idx_users_role         ON users(role);
CREATE INDEX idx_users_active       ON users(is_active);
CREATE INDEX idx_session_user       ON user_sessions(user_id);
CREATE INDEX idx_session_token      ON user_sessions(token_hash);
CREATE INDEX idx_history_order      ON production_history(order_id);
CREATE INDEX idx_history_state      ON production_history(final_state);
CREATE INDEX idx_history_deadline   ON production_history(met_deadline);
CREATE INDEX idx_history_recorded   ON production_history(recorded_at);
CREATE INDEX idx_audit_entity       ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user         ON audit_logs(user_id);
CREATE INDEX idx_audit_action       ON audit_logs(action);
CREATE INDEX idx_report_algorithm   ON performance_reports(algorithm);
CREATE INDEX idx_report_generated   ON performance_reports(generated_at);

-- Default admin user (password: 'admin123' — CHANGE IN PRODUCTION)
-- Password hash is a bcrypt placeholder — real hash generated at runtime
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES ('admin', 'admin@factory.local',
        '$2b$12$placeholder_hash_change_this_before_deploy',
        'System Administrator', 'ADMIN');
