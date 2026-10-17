-- Run after schema.sql. Safe to re-run for the sample records.
USE smart_factory;

INSERT INTO machines (machine_name, machine_type, capacity, status) VALUES
('CNC-01','CNC',1,'AVAILABLE'),('CNC-02','CNC',1,'AVAILABLE'),('ASSEMBLY-01','ASSEMBLY',1,'AVAILABLE')
ON DUPLICATE KEY UPDATE machine_type=VALUES(machine_type), capacity=VALUES(capacity);

INSERT INTO workers (full_name, skill, status)
SELECT 'Ravi Kumar','CNC Operation','AVAILABLE' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name='Ravi Kumar' AND skill='CNC Operation');
INSERT INTO workers (full_name, skill, status)
SELECT 'Neha Sharma','Assembly','AVAILABLE' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name='Neha Sharma' AND skill='Assembly');
INSERT INTO workers (full_name, skill, status)
SELECT 'Arjun Singh','Quality Check','AVAILABLE' WHERE NOT EXISTS (SELECT 1 FROM workers WHERE full_name='Arjun Singh' AND skill='Quality Check');

INSERT INTO inventory (material_name, quantity_available, reorder_level) VALUES
('Wood Panels',250,50),('Steel Screws',1200,200),('Varnish',80,20)
ON DUPLICATE KEY UPDATE reorder_level=VALUES(reorder_level);

INSERT INTO production_orders (product_name,quantity,arrival_time,execution_time,priority,deadline,required_machine_type)
SELECT 'Wooden Chair',20,0,6,2,12,'CNC' WHERE NOT EXISTS (SELECT 1 FROM production_orders WHERE product_name='Wooden Chair' AND quantity=20 AND arrival_time=0 AND execution_time=6 AND priority=2 AND deadline=12 AND required_machine_type='CNC');
INSERT INTO production_orders (product_name,quantity,arrival_time,execution_time,priority,deadline,required_machine_type)
SELECT 'Dining Table',10,0,9,3,20,'CNC' WHERE NOT EXISTS (SELECT 1 FROM production_orders WHERE product_name='Dining Table' AND quantity=10 AND arrival_time=0 AND execution_time=9 AND priority=3 AND deadline=20 AND required_machine_type='CNC');
INSERT INTO production_orders (product_name,quantity,arrival_time,execution_time,priority,deadline,required_machine_type)
SELECT 'Office Desk',15,2,4,1,10,'CNC' WHERE NOT EXISTS (SELECT 1 FROM production_orders WHERE product_name='Office Desk' AND quantity=15 AND arrival_time=2 AND execution_time=4 AND priority=1 AND deadline=10 AND required_machine_type='CNC');
INSERT INTO production_orders (product_name,quantity,arrival_time,execution_time,priority,deadline,required_machine_type)
SELECT 'Storage Cabinet',8,3,7,2,18,'ASSEMBLY' WHERE NOT EXISTS (SELECT 1 FROM production_orders WHERE product_name='Storage Cabinet' AND quantity=8 AND arrival_time=3 AND execution_time=7 AND priority=2 AND deadline=18 AND required_machine_type='ASSEMBLY');
INSERT INTO production_orders (product_name,quantity,arrival_time,execution_time,priority,deadline,required_machine_type)
SELECT 'Bookshelf',12,4,3,1,11,'CNC' WHERE NOT EXISTS (SELECT 1 FROM production_orders WHERE product_name='Bookshelf' AND quantity=12 AND arrival_time=4 AND execution_time=3 AND priority=1 AND deadline=11 AND required_machine_type='CNC');

INSERT INTO maintenance_records (machine_id,description,maintenance_date,completed)
SELECT m.machine_id,'Routine CNC inspection','2026-10-01',FALSE FROM machines m
WHERE m.machine_name='CNC-01' AND NOT EXISTS (SELECT 1 FROM maintenance_records mr WHERE mr.machine_id=m.machine_id AND mr.description='Routine CNC inspection' AND mr.maintenance_date='2026-10-01');
