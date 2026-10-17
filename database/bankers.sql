-- Banker's Algorithm sample resource pool and Allocation/Maximum matrix.
-- Run after schema.sql and seed.sql. This is an abstract algorithm demo matrix,
-- not a literal count of physical machines/workers in the machines/workers tables.
USE smart_factory;

INSERT INTO resources (resource_name,total_units,available_units) VALUES
('CNC Resource Units',10,3),('Worker Resource Units',5,3),('Robot Resource Units',7,2)
ON DUPLICATE KEY UPDATE total_units=VALUES(total_units), available_units=VALUES(available_units);

-- Matrix rows map the sample orders to resource vectors. Need = Maximum - Allocation.
INSERT INTO order_resource_claims (order_id,resource_id,allocated_units,max_units)
SELECT po.order_id,r.resource_id,x.allocated_units,x.max_units
FROM (
 SELECT 'Wooden Chair' product_name,'CNC Resource Units' resource_name,0 allocated_units,7 max_units
 UNION ALL SELECT 'Wooden Chair','Worker Resource Units',1,5
 UNION ALL SELECT 'Wooden Chair','Robot Resource Units',0,3
 UNION ALL SELECT 'Dining Table','CNC Resource Units',2,3
 UNION ALL SELECT 'Dining Table','Worker Resource Units',0,2
 UNION ALL SELECT 'Dining Table','Robot Resource Units',0,2
 UNION ALL SELECT 'Office Desk','CNC Resource Units',3,9
 UNION ALL SELECT 'Office Desk','Worker Resource Units',0,0
 UNION ALL SELECT 'Office Desk','Robot Resource Units',2,2
 UNION ALL SELECT 'Storage Cabinet','CNC Resource Units',2,2
 UNION ALL SELECT 'Storage Cabinet','Worker Resource Units',1,2
 UNION ALL SELECT 'Storage Cabinet','Robot Resource Units',1,2
 UNION ALL SELECT 'Bookshelf','CNC Resource Units',0,4
 UNION ALL SELECT 'Bookshelf','Worker Resource Units',0,3
 UNION ALL SELECT 'Bookshelf','Robot Resource Units',2,3
) x
JOIN production_orders po ON po.product_name=x.product_name
JOIN resources r ON r.resource_name=x.resource_name
ON DUPLICATE KEY UPDATE allocated_units=VALUES(allocated_units),max_units=VALUES(max_units);

-- Review Allocation, Maximum and Need.
SELECT po.order_id,po.product_name,r.resource_name,
       c.allocated_units AS allocation,c.max_units AS maximum,
       c.max_units-c.allocated_units AS need
FROM order_resource_claims c
JOIN production_orders po ON po.order_id=c.order_id
JOIN resources r ON r.resource_id=c.resource_id
ORDER BY po.order_id,r.resource_id;

SELECT resource_name,total_units,available_units FROM resources ORDER BY resource_id;
