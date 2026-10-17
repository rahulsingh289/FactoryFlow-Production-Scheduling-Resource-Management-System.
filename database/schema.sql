-- Smart Factory Production Scheduler; MySQL 8.x
CREATE DATABASE IF NOT EXISTS smart_factory;
USE smart_factory;

CREATE TABLE IF NOT EXISTS machines (
  machine_id INT AUTO_INCREMENT PRIMARY KEY,
  machine_name VARCHAR(100) NOT NULL UNIQUE,
  machine_type VARCHAR(60) NOT NULL,
  capacity INT NOT NULL DEFAULT 1,
  status ENUM('AVAILABLE','BUSY','MAINTENANCE') NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT chk_machine_capacity CHECK (capacity > 0)
);
CREATE TABLE IF NOT EXISTS workers (
  worker_id INT AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  skill VARCHAR(100) NOT NULL,
  status ENUM('AVAILABLE','ASSIGNED','OFF_SHIFT') NOT NULL DEFAULT 'AVAILABLE'
);
CREATE TABLE IF NOT EXISTS inventory (
  material_id INT AUTO_INCREMENT PRIMARY KEY,
  material_name VARCHAR(100) NOT NULL UNIQUE,
  quantity_available INT NOT NULL DEFAULT 0,
  reorder_level INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_inventory_quantity CHECK (quantity_available >= 0),
  CONSTRAINT chk_inventory_reorder CHECK (reorder_level >= 0)
);
CREATE TABLE IF NOT EXISTS production_orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  product_name VARCHAR(120) NOT NULL,
  quantity INT NOT NULL,
  arrival_time INT NOT NULL DEFAULT 0,
  execution_time INT NOT NULL,
  priority INT NOT NULL DEFAULT 3,
  deadline INT NOT NULL,
  required_machine_type VARCHAR(60),
  status ENUM('READY','RUNNING','BLOCKED','COMPLETED') NOT NULL DEFAULT 'READY',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_order_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_arrival CHECK (arrival_time >= 0),
  CONSTRAINT chk_order_execution CHECK (execution_time > 0),
  CONSTRAINT chk_order_priority CHECK (priority BETWEEN 1 AND 5),
  CONSTRAINT chk_order_deadline CHECK (deadline >= 0)
);
CREATE TABLE IF NOT EXISTS resource_allocations (
  allocation_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  machine_id INT NULL,
  worker_id INT NULL,
  allocated_units INT NOT NULL DEFAULT 1,
  allocation_status ENUM('ALLOCATED','RELEASED','WAITING') NOT NULL DEFAULT 'WAITING',
  allocated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_allocated_units CHECK (allocated_units > 0),
  CONSTRAINT fk_alloc_order FOREIGN KEY (order_id) REFERENCES production_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_alloc_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE SET NULL,
  CONSTRAINT fk_alloc_worker FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS schedule_history (
  schedule_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  algorithm ENUM('FCFS','SJF','PRIORITY') NOT NULL,
  start_time INT NOT NULL,
  completion_time INT NOT NULL,
  waiting_time INT NOT NULL,
  missed_deadline BOOLEAN NOT NULL DEFAULT FALSE,
  generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_schedule_times CHECK (start_time >= 0 AND completion_time >= start_time),
  CONSTRAINT chk_waiting_time CHECK (waiting_time >= 0),
  CONSTRAINT fk_schedule_order FOREIGN KEY (order_id) REFERENCES production_orders(order_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS maintenance_records (
  maintenance_id INT AUTO_INCREMENT PRIMARY KEY,
  machine_id INT NOT NULL,
  description VARCHAR(255) NOT NULL,
  maintenance_date DATE NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_maintenance_machine FOREIGN KEY (machine_id) REFERENCES machines(machine_id) ON DELETE CASCADE
);

-- Abstract resource pools used by Banker's Algorithm (not individual machine rows).
CREATE TABLE IF NOT EXISTS resources (
  resource_id INT AUTO_INCREMENT PRIMARY KEY,
  resource_name VARCHAR(100) NOT NULL UNIQUE,
  total_units INT NOT NULL,
  available_units INT NOT NULL,
  CONSTRAINT chk_resource_total CHECK (total_units >= 0),
  CONSTRAINT chk_resource_available CHECK (available_units >= 0 AND available_units <= total_units)
);
CREATE TABLE IF NOT EXISTS order_resource_claims (
  order_id INT NOT NULL,
  resource_id INT NOT NULL,
  allocated_units INT NOT NULL DEFAULT 0,
  max_units INT NOT NULL,
  PRIMARY KEY (order_id, resource_id),
  CONSTRAINT chk_claim_allocated CHECK (allocated_units >= 0),
  CONSTRAINT chk_claim_max CHECK (max_units >= 0),
  CONSTRAINT chk_claim_allocated_max CHECK (allocated_units <= max_units),
  CONSTRAINT fk_claim_order FOREIGN KEY (order_id) REFERENCES production_orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_claim_resource FOREIGN KEY (resource_id) REFERENCES resources(resource_id) ON DELETE CASCADE
);
