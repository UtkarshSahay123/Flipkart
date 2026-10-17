-- Additive PostgreSQL migration for organization departments and department task flow.
CREATE TABLE IF NOT EXISTS departments (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (org_id, name)
);
INSERT INTO departments (org_id, name)
SELECT o.id, d.name FROM organizations o
CROSS JOIN (VALUES ('Traffic Police Department'), ('Public Works Department (PWD)'),
                   ('Municipal Corporation / Municipality'), ('Police Department')) AS d(name)
ON CONFLICT (org_id, name) DO NOTHING;

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS department_role VARCHAR(12);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS authority_title VARCHAR(100);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS authority_type VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_admin_users_department ON admin_users(organization_id, department_id, department_role);
CREATE UNIQUE INDEX IF NOT EXISTS uq_department_one_active_head ON admin_users(department_id)
    WHERE department_id IS NOT NULL AND department_role='HEAD' AND approved=TRUE AND account_active=TRUE;

ALTER TABLE work_tasks ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS assigned_by_head BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS direct_admin_assignment BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_work_tasks_department ON work_tasks(organization_id, department_id, status);

CREATE TABLE IF NOT EXISTS task_history (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    action VARCHAR(60) NOT NULL,
    from_status VARCHAR(32),
    to_status VARCHAR(32),
    details TEXT,
    "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE task_history ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_task_history_task_timestamp ON task_history(task_id, "timestamp");
