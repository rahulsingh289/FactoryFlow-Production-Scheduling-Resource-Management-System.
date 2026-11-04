-- ===========================================================================
--  Smart Factory Production Scheduler  —  SEED DATA
--  ---------------------------------------------------------------------------
--  The factory's fixed resources: its machines and its workers. These are what
--  limit production, so the factory starts with them in place. Orders, resource
--  pools and inventory are created from the web app.
--
--  Safe to run more than once: rows that already exist are left alone.
-- ===========================================================================
USE smart_factory;

-- -------------------------------- Machines --------------------------------
-- capacity = how many orders the machine can run at the same time.
INSERT IGNORE INTO machines (machine_name, machine_type, capacity) VALUES
('CNC-01',      'CNC Machine', 2),
('CNC-02',      'CNC Machine', 1),
('Assembly-01', 'Assembly',    3),
('Paint-01',    'Paint Booth', 1),
('Weld-01',     'Welding',     2);

-- --------------------------------- Workers --------------------------------
-- workers.full_name isn't unique, so each row checks for itself first.
-- machine_type is the machine type a worker is trained on; NULL means any machine.
INSERT INTO workers (full_name, skill, machine_type)
SELECT 'Ravi Kumar', 'CNC Operator', 'CNC Machine' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name = 'Ravi Kumar');
INSERT INTO workers (full_name, skill, machine_type)
SELECT 'Sunita Devi', 'Assembly Lead', 'Assembly' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name = 'Sunita Devi');
INSERT INTO workers (full_name, skill, machine_type)
SELECT 'Amit Sharma', 'Painter', 'Paint Booth' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name = 'Amit Sharma');
INSERT INTO workers (full_name, skill, machine_type)
SELECT 'Neha Verma', 'Welder', 'Welding' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name = 'Neha Verma');
INSERT INTO workers (full_name, skill, machine_type)
SELECT 'Karan Mehta', 'Quality Inspector', NULL WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name = 'Karan Mehta');

SELECT 'Machines and workers loaded.' AS status;
