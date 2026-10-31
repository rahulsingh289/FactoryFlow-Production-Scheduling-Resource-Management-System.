-- ===========================================================================
--  Smart Factory Production Scheduler  —  SECURITY / ACCESS CONTROL (DCL)
--  ---------------------------------------------------------------------------
--  DBMS MODULE 1 (part 2)  ·  OWNER: Aman Singh Rawat (Team Lead)
--  Focus: Data Control Language — roles, users, GRANT / REVOKE, least privilege.
--  DBMS concepts: DCL, roles, privilege management.
--
--  Run as an admin (root) AFTER schema.sql.  Optional for the running app.
--  mysql -u root -p < database/security.sql
-- ===========================================================================
USE smart_factory;

-- ---- 1. Roles (MySQL 8 supports roles) -----------------------------------
CREATE ROLE IF NOT EXISTS 'factory_app', 'factory_readonly';

-- Application role: full read/write on business tables, EXECUTE on routines.
GRANT SELECT, INSERT, UPDATE, DELETE ON smart_factory.* TO 'factory_app';
GRANT EXECUTE ON smart_factory.* TO 'factory_app';

-- Reporting role: read-only (good for analysts / BI tools).
GRANT SELECT ON smart_factory.* TO 'factory_readonly';

-- ---- 2. Users and role assignment ----------------------------------------
CREATE USER IF NOT EXISTS 'factory_service'@'localhost' IDENTIFIED BY 'change_me_app';
CREATE USER IF NOT EXISTS 'factory_analyst'@'localhost' IDENTIFIED BY 'change_me_ro';

GRANT 'factory_app'      TO 'factory_service'@'localhost';
GRANT 'factory_readonly' TO 'factory_analyst'@'localhost';

-- Activate the roles automatically on login.
SET DEFAULT ROLE ALL TO 'factory_service'@'localhost';
SET DEFAULT ROLE ALL TO 'factory_analyst'@'localhost';

FLUSH PRIVILEGES;

-- ---- 3. Inspect granted privileges ---------------------------------------
SHOW GRANTS FOR 'factory_app';
SHOW GRANTS FOR 'factory_readonly';

SELECT 'Roles and users created. Point backend/.env at factory_service for least privilege.' AS status;
