CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(160) NOT NULL UNIQUE,
    join_code VARCHAR(32) NOT NULL UNIQUE,
    employee_email_pattern VARCHAR(300) DEFAULT '^[^\s@]+@[^\s@]+\.[^\s@]+$'
);

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS employee_email_pattern VARCHAR(300) DEFAULT '^[^\s@]+@[^\s@]+\.[^\s@]+$';

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    designation VARCHAR(100),
    profile_image TEXT,
    organization_id BIGINT REFERENCES organizations(id),
    pending_organization_id BIGINT REFERENCES organizations(id),
    organization_change_status VARCHAR(20),
    role VARCHAR(20) DEFAULT 'ADMIN',
    approved BOOLEAN DEFAULT TRUE,
    approval_status VARCHAR(20) DEFAULT 'APPROVED',
    account_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'ADMIN';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT TRUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'APPROVED';
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS account_active BOOLEAN DEFAULT TRUE;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS pending_organization_id BIGINT REFERENCES organizations(id);
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS organization_change_status VARCHAR(20);

-- Organization departments and staff metadata. Seed each organization independently.
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

CREATE TABLE IF NOT EXISTS designation_permissions (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    designation VARCHAR(100) NOT NULL,
    can_report_issues BOOLEAN NOT NULL DEFAULT TRUE,
    can_view_all_issues BOOLEAN NOT NULL DEFAULT FALSE,
    can_update_tasks BOOLEAN NOT NULL DEFAULT TRUE,
    can_assign_tasks BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE (organization_id, designation)
);

-- Organization-scoped RBAC. Role permissions are read from PostgreSQL per request,
-- so revocations and grants take effect immediately without restarting the service.
CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    description VARCHAR(300),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, name)
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    permission_key VARCHAR(60) NOT NULL,
    PRIMARY KEY (role_id, permission_key)
);

-- Configurable hierarchy levels. rank_order 1 is the highest level; larger values
-- represent lower levels. No level names or level count are hard-coded.
CREATE TABLE IF NOT EXISTS org_levels (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    level_name VARCHAR(100) NOT NULL,
    rank_order INTEGER NOT NULL CHECK (rank_order > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, level_name),
    UNIQUE (organization_id, rank_order)
);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS level_id BIGINT REFERENCES org_levels(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_org_level ON admin_users(organization_id, level_id);

-- Organization-owned privilege catalog and individual grant lineage.
CREATE TABLE IF NOT EXISTS privileges (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    privilege_key VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (organization_id, privilege_key)
);

CREATE TABLE IF NOT EXISTS user_privileges (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    privilege_id BIGINT NOT NULL REFERENCES privileges(id) ON DELETE RESTRICT,
    granted_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    parent_grant_id BIGINT REFERENCES user_privileges(id) ON DELETE SET NULL,
    can_grant BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE'
        CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    revoked_by BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(500),
    CHECK (expires_at IS NULL OR expires_at > granted_at)
);

CREATE INDEX IF NOT EXISTS idx_user_privileges_subject_status
    ON user_privileges(organization_id, user_id, privilege_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_user_privileges_parent_status
    ON user_privileges(parent_grant_id, status);

CREATE TABLE IF NOT EXISTS privilege_audit_log (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    subject_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    privilege_id BIGINT REFERENCES privileges(id) ON DELETE SET NULL,
    grant_id BIGINT REFERENCES user_privileges(id) ON DELETE SET NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('GRANT', 'REVOKE', 'EXPIRE', 'DEFINE', 'DISABLE')),
    can_grant BOOLEAN,
    expires_at TIMESTAMPTZ,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_privilege_audit_org_time
    ON privilege_audit_log(organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_privilege_audit_subject_time
    ON privilege_audit_log(subject_id, occurred_at DESC);

ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS rbac_role_id BIGINT REFERENCES admin_roles(id) ON DELETE SET NULL;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS rbac_enabled BOOLEAN DEFAULT FALSE;
UPDATE admin_users SET rbac_enabled=FALSE WHERE rbac_enabled IS NULL;
ALTER TABLE admin_users ALTER COLUMN rbac_enabled SET DEFAULT FALSE;
ALTER TABLE admin_users ALTER COLUMN rbac_enabled SET NOT NULL;
ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS manager_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_admin_users_manager ON admin_users(manager_id);

CREATE TABLE IF NOT EXISTS work_tasks (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    created_by_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    parent_task_id BIGINT REFERENCES work_tasks(id) ON DELETE SET NULL,
    title VARCHAR(160) NOT NULL,
    description VARCHAR(2000),
    issue_id VARCHAR(80),
    status VARCHAR(32) NOT NULL DEFAULT 'Assigned',
    priority VARCHAR(20) NOT NULL DEFAULT 'Medium',
    due_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS created_by_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS parent_task_id BIGINT REFERENCES work_tasks(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ALTER COLUMN employee_id DROP NOT NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS department_id BIGINT REFERENCES departments(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS assigned_by_head BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE work_tasks ADD COLUMN IF NOT EXISTS direct_admin_assignment BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_work_tasks_parent ON work_tasks(parent_task_id);
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
CREATE INDEX IF NOT EXISTS idx_task_history_task_timestamp ON task_history(task_id, "timestamp");

CREATE TABLE IF NOT EXISTS task_status_history (
    id BIGSERIAL PRIMARY KEY,
    organization_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_id BIGINT NOT NULL REFERENCES work_tasks(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    status VARCHAR(32) NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- General per-user notifications (overdue issue reminder scheduling remains in admin_issue_reminders).
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_key TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
