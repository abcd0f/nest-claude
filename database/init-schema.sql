-- ============================================================
-- NestJS Admin 系统数据库初始化脚本
-- 生成时间: 2025-01-24
-- 数据库: PostgreSQL 12+
-- ============================================================

-- 设置客户端编码
SET client_encoding = 'UTF8';

-- ============================================================
-- 1. 创建表结构
-- ============================================================

-- 系统部门表
CREATE TABLE IF NOT EXISTS sys_dept (
    dept_id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT NOT NULL DEFAULT 0,
    ancestors VARCHAR(512) NOT NULL DEFAULT '/',
    dept_name VARCHAR(64) NOT NULL,
    order_num INT NOT NULL DEFAULT 0,
    leader_id BIGINT,
    status CHAR(1) NOT NULL DEFAULT '0',
    del_flag CHAR(1) NOT NULL DEFAULT '0',
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    update_time TIMESTAMPTZ,
    remark VARCHAR(500)
);

COMMENT ON TABLE sys_dept IS '系统部门表';
COMMENT ON COLUMN sys_dept.dept_id IS '部门ID';
COMMENT ON COLUMN sys_dept.parent_id IS '父部门ID，根节点为 0';
COMMENT ON COLUMN sys_dept.ancestors IS '含自身的物化路径';
COMMENT ON COLUMN sys_dept.dept_name IS '部门名称';
COMMENT ON COLUMN sys_dept.order_num IS '显示顺序';
COMMENT ON COLUMN sys_dept.leader_id IS '负责人用户ID';
COMMENT ON COLUMN sys_dept.status IS '部门状态：0=正常 1=停用';
COMMENT ON COLUMN sys_dept.del_flag IS '删除标志：0=正常 1=删除';
COMMENT ON COLUMN sys_dept.create_time IS '创建时间';
COMMENT ON COLUMN sys_dept.update_time IS '更新时间';
COMMENT ON COLUMN sys_dept.remark IS '备注';

-- 系统职位表
CREATE TABLE IF NOT EXISTS sys_post (
    post_id BIGSERIAL PRIMARY KEY,
    post_code VARCHAR(64) NOT NULL,
    post_name VARCHAR(64) NOT NULL,
    order_num INT NOT NULL DEFAULT 0,
    status CHAR(1) NOT NULL DEFAULT '0',
    del_flag CHAR(1) NOT NULL DEFAULT '0',
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    update_time TIMESTAMPTZ,
    remark VARCHAR(500)
);

COMMENT ON TABLE sys_post IS '系统职位表';
COMMENT ON COLUMN sys_post.post_id IS '职位ID';
COMMENT ON COLUMN sys_post.post_code IS '职位编码';
COMMENT ON COLUMN sys_post.post_name IS '职位名称';
COMMENT ON COLUMN sys_post.order_num IS '显示顺序';
COMMENT ON COLUMN sys_post.status IS '职位状态：0=正常 1=停用';
COMMENT ON COLUMN sys_post.del_flag IS '删除标志：0=正常 1=删除';
COMMENT ON COLUMN sys_post.create_time IS '创建时间';
COMMENT ON COLUMN sys_post.update_time IS '更新时间';
COMMENT ON COLUMN sys_post.remark IS '备注';

-- 系统角色表
CREATE TABLE IF NOT EXISTS sys_role (
    role_id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(64) NOT NULL,
    role_key VARCHAR(64) NOT NULL,
    order_num INT NOT NULL DEFAULT 0,
    data_scope CHAR(1) NOT NULL DEFAULT '4',
    status CHAR(1) NOT NULL DEFAULT '0',
    del_flag CHAR(1) NOT NULL DEFAULT '0',
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    update_time TIMESTAMPTZ,
    remark VARCHAR(500)
);

COMMENT ON TABLE sys_role IS '系统角色表';
COMMENT ON COLUMN sys_role.role_id IS '角色ID';
COMMENT ON COLUMN sys_role.role_name IS '角色名称';
COMMENT ON COLUMN sys_role.role_key IS '角色权限字符串';
COMMENT ON COLUMN sys_role.order_num IS '显示顺序';
COMMENT ON COLUMN sys_role.data_scope IS '数据范围：1=全部 2=本部门 3=本部门及以下 4=仅本人 5=自定义部门';
COMMENT ON COLUMN sys_role.status IS '角色状态：0=正常 1=停用';
COMMENT ON COLUMN sys_role.del_flag IS '删除标志：0=正常 1=删除';
COMMENT ON COLUMN sys_role.create_time IS '创建时间';
COMMENT ON COLUMN sys_role.update_time IS '更新时间';
COMMENT ON COLUMN sys_role.remark IS '备注';

-- 系统用户表
CREATE TABLE IF NOT EXISTS sys_user (
    user_id BIGSERIAL PRIMARY KEY,
    dept_id BIGINT,
    user_name VARCHAR(64) NOT NULL,
    nick_name VARCHAR(100) NOT NULL,
    email VARCHAR(254),
    phonenumber VARCHAR(32),
    sex CHAR(1) NOT NULL DEFAULT '2',
    password VARCHAR(255) NOT NULL,
    status CHAR(1) NOT NULL DEFAULT '0',
    del_flag CHAR(1) NOT NULL DEFAULT '0',
    login_ip VARCHAR(128),
    login_date TIMESTAMPTZ,
    permission_version INT NOT NULL DEFAULT 0,
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    update_time TIMESTAMPTZ,
    remark VARCHAR(500)
);

COMMENT ON TABLE sys_user IS '系统用户表';
COMMENT ON COLUMN sys_user.user_id IS '用户ID';
COMMENT ON COLUMN sys_user.dept_id IS '所属部门';
COMMENT ON COLUMN sys_user.user_name IS '用户名称';
COMMENT ON COLUMN sys_user.nick_name IS '用户昵称';
COMMENT ON COLUMN sys_user.email IS '用户邮箱';
COMMENT ON COLUMN sys_user.phonenumber IS '用户手机号';
COMMENT ON COLUMN sys_user.sex IS '用户性别：0=男 1=女 2=未知';
COMMENT ON COLUMN sys_user.password IS '用户密码（bcrypt哈希）';
COMMENT ON COLUMN sys_user.status IS '用户状态：0=正常 1=停用';
COMMENT ON COLUMN sys_user.del_flag IS '删除标志：0=正常 1=删除';
COMMENT ON COLUMN sys_user.login_ip IS '最后登录地址';
COMMENT ON COLUMN sys_user.login_date IS '最后登录时间';
COMMENT ON COLUMN sys_user.permission_version IS '权限版本号（用于权限缓存失效）';
COMMENT ON COLUMN sys_user.create_time IS '创建时间';
COMMENT ON COLUMN sys_user.update_time IS '更新时间';
COMMENT ON COLUMN sys_user.remark IS '备注';

-- 系统菜单表
CREATE TABLE IF NOT EXISTS sys_menu (
    menu_id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT NOT NULL DEFAULT 0,
    menu_name VARCHAR(64) NOT NULL,
    menu_type CHAR(1) NOT NULL,
    order_num INT NOT NULL DEFAULT 0,
    path VARCHAR(200),
    component VARCHAR(255),
    query VARCHAR(255),
    is_frame CHAR(1) NOT NULL DEFAULT '1',
    is_cache CHAR(1) NOT NULL DEFAULT '0',
    visible CHAR(1) NOT NULL DEFAULT '0',
    status CHAR(1) NOT NULL DEFAULT '0',
    perms VARCHAR(100),
    icon VARCHAR(100),
    create_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    update_time TIMESTAMPTZ,
    remark VARCHAR(500)
);

COMMENT ON TABLE sys_menu IS '系统菜单表';
COMMENT ON COLUMN sys_menu.menu_id IS '菜单ID';
COMMENT ON COLUMN sys_menu.parent_id IS '父菜单ID，根节点为 0';
COMMENT ON COLUMN sys_menu.menu_name IS '菜单名称';
COMMENT ON COLUMN sys_menu.menu_type IS '类型：M=目录 C=菜单 F=按钮';
COMMENT ON COLUMN sys_menu.order_num IS '显示顺序';
COMMENT ON COLUMN sys_menu.path IS '路由地址';
COMMENT ON COLUMN sys_menu.component IS '前端组件路径';
COMMENT ON COLUMN sys_menu.query IS '路由参数';
COMMENT ON COLUMN sys_menu.is_frame IS '是否外链：0=是 1=否';
COMMENT ON COLUMN sys_menu.is_cache IS '是否缓存：0=缓存 1=不缓存';
COMMENT ON COLUMN sys_menu.visible IS '是否隐藏：0=显示 1=隐藏';
COMMENT ON COLUMN sys_menu.status IS '菜单状态：0=正常 1=停用';
COMMENT ON COLUMN sys_menu.perms IS '操作权限标识';
COMMENT ON COLUMN sys_menu.icon IS '菜单图标';
COMMENT ON COLUMN sys_menu.create_time IS '创建时间';
COMMENT ON COLUMN sys_menu.update_time IS '更新时间';
COMMENT ON COLUMN sys_menu.remark IS '备注';

-- 系统权限表
CREATE TABLE IF NOT EXISTS sys_permission (
    permission_id BIGSERIAL PRIMARY KEY,
    code VARCHAR(128) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    resource VARCHAR(100),
    action VARCHAR(64),
    menu_id BIGINT UNIQUE,
    status CHAR(1) NOT NULL DEFAULT '0',
    remark VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sys_permission IS '系统权限表';
COMMENT ON COLUMN sys_permission.permission_id IS '权限ID';
COMMENT ON COLUMN sys_permission.code IS '权限编码（全局唯一，稳定标识）';
COMMENT ON COLUMN sys_permission.name IS '权限名称';
COMMENT ON COLUMN sys_permission.resource IS '资源名称（可选，便于分组）';
COMMENT ON COLUMN sys_permission.action IS '操作动作（可选，如：view/add/edit/remove）';
COMMENT ON COLUMN sys_permission.menu_id IS '关联菜单ID（可选，C/F 类型菜单）';
COMMENT ON COLUMN sys_permission.status IS '权限状态：0=启用 1=停用';
COMMENT ON COLUMN sys_permission.remark IS '备注';
COMMENT ON COLUMN sys_permission.created_at IS '创建时间';
COMMENT ON COLUMN sys_permission.updated_at IS '更新时间';

-- ============================================================
-- 2. 创建关联表
-- ============================================================

-- 用户与角色关联表
CREATE TABLE IF NOT EXISTS sys_user_role (
    user_id BIGINT NOT NULL,
    role_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE sys_user_role IS '用户与角色关联表';
COMMENT ON COLUMN sys_user_role.user_id IS '用户ID';
COMMENT ON COLUMN sys_user_role.role_id IS '角色ID';

-- 用户与职位关联表
CREATE TABLE IF NOT EXISTS sys_user_post (
    user_id BIGINT NOT NULL,
    post_id BIGINT NOT NULL,
    PRIMARY KEY (user_id, post_id)
);

COMMENT ON TABLE sys_user_post IS '用户与职位关联表';
COMMENT ON COLUMN sys_user_post.user_id IS '用户ID';
COMMENT ON COLUMN sys_user_post.post_id IS '职位ID';

-- 角色与菜单关联表
CREATE TABLE IF NOT EXISTS sys_role_menu (
    role_id BIGINT NOT NULL,
    menu_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, menu_id)
);

COMMENT ON TABLE sys_role_menu IS '角色与菜单关联表';
COMMENT ON COLUMN sys_role_menu.role_id IS '角色ID';
COMMENT ON COLUMN sys_role_menu.menu_id IS '菜单ID';

-- 角色与权限关联表
CREATE TABLE IF NOT EXISTS sys_role_permission (
    role_id BIGINT NOT NULL,
    permission_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, permission_id)
);

COMMENT ON TABLE sys_role_permission IS '角色与权限关联表';
COMMENT ON COLUMN sys_role_permission.role_id IS '角色ID';
COMMENT ON COLUMN sys_role_permission.permission_id IS '权限ID';

-- 角色与部门关联表（自定义数据范围）
CREATE TABLE IF NOT EXISTS sys_role_dept (
    role_id BIGINT NOT NULL,
    dept_id BIGINT NOT NULL,
    PRIMARY KEY (role_id, dept_id)
);

COMMENT ON TABLE sys_role_dept IS '角色与部门关联表（自定义数据范围）';
COMMENT ON COLUMN sys_role_dept.role_id IS '角色ID';
COMMENT ON COLUMN sys_role_dept.dept_id IS '部门ID';

-- ============================================================
-- 3. 创建日志表
-- ============================================================

-- 登录日志表
CREATE TABLE IF NOT EXISTS sys_login_log (
    info_id BIGSERIAL PRIMARY KEY,
    user_name VARCHAR(64) NOT NULL,
    ipaddr VARCHAR(128),
    user_agent VARCHAR(500),
    status CHAR(1) NOT NULL DEFAULT '0',
    msg VARCHAR(255),
    login_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sys_login_log IS '登录日志表';
COMMENT ON COLUMN sys_login_log.info_id IS '访问ID';
COMMENT ON COLUMN sys_login_log.user_name IS '登录账号';
COMMENT ON COLUMN sys_login_log.ipaddr IS '登录IP';
COMMENT ON COLUMN sys_login_log.user_agent IS '客户端标识';
COMMENT ON COLUMN sys_login_log.status IS '登录状态：0=成功 1=失败';
COMMENT ON COLUMN sys_login_log.msg IS '提示消息';
COMMENT ON COLUMN sys_login_log.login_time IS '登录时间';

-- 操作日志表
CREATE TABLE IF NOT EXISTS sys_oper_log (
    oper_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(64),
    method VARCHAR(200),
    request_method VARCHAR(10),
    oper_user_id BIGINT,
    oper_url VARCHAR(255),
    oper_ip VARCHAR(128),
    oper_param TEXT,
    status CHAR(1) NOT NULL DEFAULT '0',
    error_msg TEXT,
    cost_time INT NOT NULL DEFAULT 0,
    oper_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sys_oper_log IS '操作日志表';
COMMENT ON COLUMN sys_oper_log.oper_id IS '操作日志ID';
COMMENT ON COLUMN sys_oper_log.title IS '模块标题';
COMMENT ON COLUMN sys_oper_log.method IS '控制器方法';
COMMENT ON COLUMN sys_oper_log.request_method IS '请求方式';
COMMENT ON COLUMN sys_oper_log.oper_user_id IS '操作人用户ID';
COMMENT ON COLUMN sys_oper_log.oper_url IS '请求地址';
COMMENT ON COLUMN sys_oper_log.oper_ip IS '操作IP';
COMMENT ON COLUMN sys_oper_log.oper_param IS '脱敏后的请求参数';
COMMENT ON COLUMN sys_oper_log.status IS '操作状态：0=成功 1=失败';
COMMENT ON COLUMN sys_oper_log.error_msg IS '错误消息';
COMMENT ON COLUMN sys_oper_log.cost_time IS '耗时（毫秒）';
COMMENT ON COLUMN sys_oper_log.oper_time IS '操作时间';

-- ============================================================
-- 4. 创建索引
-- ============================================================

-- sys_dept 索引
CREATE INDEX IF NOT EXISTS idx_sys_dept_parent_id ON sys_dept(parent_id);
CREATE INDEX IF NOT EXISTS idx_sys_dept_ancestors ON sys_dept(ancestors);

-- sys_user 索引
CREATE INDEX IF NOT EXISTS idx_sys_user_dept_id ON sys_user(dept_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sys_user_user_name ON sys_user(user_name) WHERE del_flag = '0';

-- sys_menu 索引
CREATE INDEX IF NOT EXISTS idx_sys_menu_parent_id ON sys_menu(parent_id);

-- sys_permission 索引
CREATE INDEX IF NOT EXISTS idx_sys_permission_status ON sys_permission(status);
CREATE INDEX IF NOT EXISTS idx_sys_permission_resource ON sys_permission(resource);

-- sys_user_role 索引
CREATE INDEX IF NOT EXISTS idx_sys_user_role_role_id ON sys_user_role(role_id);

-- sys_user_post 索引
CREATE INDEX IF NOT EXISTS idx_sys_user_post_post_id ON sys_user_post(post_id);

-- sys_role_menu 索引
CREATE INDEX IF NOT EXISTS idx_sys_role_menu_menu_id ON sys_role_menu(menu_id);

-- sys_role_permission 索引
CREATE INDEX IF NOT EXISTS idx_sys_role_permission_permission_id ON sys_role_permission(permission_id);

-- sys_role_dept 索引
CREATE INDEX IF NOT EXISTS idx_sys_role_dept_dept_id ON sys_role_dept(dept_id);

-- sys_login_log 索引
CREATE INDEX IF NOT EXISTS idx_sys_login_log_user_name ON sys_login_log(user_name);
CREATE INDEX IF NOT EXISTS idx_sys_login_log_login_time ON sys_login_log(login_time);

-- sys_oper_log 索引
CREATE INDEX IF NOT EXISTS idx_sys_oper_log_oper_user_id ON sys_oper_log(oper_user_id);
CREATE INDEX IF NOT EXISTS idx_sys_oper_log_oper_time ON sys_oper_log(oper_time);

-- ============================================================
-- 5. 创建外键约束
-- ============================================================

-- sys_user 外键
ALTER TABLE sys_user
    DROP CONSTRAINT IF EXISTS fk_sys_user_dept_id,
    ADD CONSTRAINT fk_sys_user_dept_id
        FOREIGN KEY (dept_id) REFERENCES sys_dept(dept_id)
        ON DELETE SET NULL;

-- sys_permission 外键
ALTER TABLE sys_permission
    DROP CONSTRAINT IF EXISTS fk_sys_permission_menu_id,
    ADD CONSTRAINT fk_sys_permission_menu_id
        FOREIGN KEY (menu_id) REFERENCES sys_menu(menu_id)
        ON DELETE SET NULL;

-- sys_user_role 外键
ALTER TABLE sys_user_role
    DROP CONSTRAINT IF EXISTS fk_sys_user_role_user_id,
    ADD CONSTRAINT fk_sys_user_role_user_id
        FOREIGN KEY (user_id) REFERENCES sys_user(user_id)
        ON DELETE CASCADE;

ALTER TABLE sys_user_role
    DROP CONSTRAINT IF EXISTS fk_sys_user_role_role_id,
    ADD CONSTRAINT fk_sys_user_role_role_id
        FOREIGN KEY (role_id) REFERENCES sys_role(role_id)
        ON DELETE CASCADE;

-- sys_user_post 外键
ALTER TABLE sys_user_post
    DROP CONSTRAINT IF EXISTS fk_sys_user_post_user_id,
    ADD CONSTRAINT fk_sys_user_post_user_id
        FOREIGN KEY (user_id) REFERENCES sys_user(user_id)
        ON DELETE CASCADE;

ALTER TABLE sys_user_post
    DROP CONSTRAINT IF EXISTS fk_sys_user_post_post_id,
    ADD CONSTRAINT fk_sys_user_post_post_id
        FOREIGN KEY (post_id) REFERENCES sys_post(post_id)
        ON DELETE CASCADE;

-- sys_role_menu 外键
ALTER TABLE sys_role_menu
    DROP CONSTRAINT IF EXISTS fk_sys_role_menu_role_id,
    ADD CONSTRAINT fk_sys_role_menu_role_id
        FOREIGN KEY (role_id) REFERENCES sys_role(role_id)
        ON DELETE CASCADE;

ALTER TABLE sys_role_menu
    DROP CONSTRAINT IF EXISTS fk_sys_role_menu_menu_id,
    ADD CONSTRAINT fk_sys_role_menu_menu_id
        FOREIGN KEY (menu_id) REFERENCES sys_menu(menu_id)
        ON DELETE CASCADE;

-- sys_role_permission 外键
ALTER TABLE sys_role_permission
    DROP CONSTRAINT IF EXISTS fk_sys_role_permission_role_id,
    ADD CONSTRAINT fk_sys_role_permission_role_id
        FOREIGN KEY (role_id) REFERENCES sys_role(role_id)
        ON DELETE CASCADE;

ALTER TABLE sys_role_permission
    DROP CONSTRAINT IF EXISTS fk_sys_role_permission_permission_id,
    ADD CONSTRAINT fk_sys_role_permission_permission_id
        FOREIGN KEY (permission_id) REFERENCES sys_permission(permission_id)
        ON DELETE CASCADE;

-- sys_role_dept 外键
ALTER TABLE sys_role_dept
    DROP CONSTRAINT IF EXISTS fk_sys_role_dept_role_id,
    ADD CONSTRAINT fk_sys_role_dept_role_id
        FOREIGN KEY (role_id) REFERENCES sys_role(role_id)
        ON DELETE CASCADE;

ALTER TABLE sys_role_dept
    DROP CONSTRAINT IF EXISTS fk_sys_role_dept_dept_id,
    ADD CONSTRAINT fk_sys_role_dept_dept_id
        FOREIGN KEY (dept_id) REFERENCES sys_dept(dept_id)
        ON DELETE CASCADE;

-- ============================================================
-- 6. 插入初始数据
-- ============================================================

-- 插入根部门
INSERT INTO sys_dept (dept_id, parent_id, ancestors, dept_name, order_num, status, remark)
VALUES (1, 0, '/1/', '总公司', 0, '0', '顶级部门')
ON CONFLICT (dept_id) DO NOTHING;

-- 插入默认职位
INSERT INTO sys_post (post_id, post_code, post_name, order_num, status, remark)
VALUES
    (1, 'CEO', '董事长', 1, '0', '董事长'),
    (2, 'SE', '项目经理', 2, '0', '项目经理'),
    (3, 'HR', '人力资源', 3, '0', '人力资源'),
    (4, 'USER', '普通员工', 4, '0', '普通员工')
ON CONFLICT (post_id) DO NOTHING;

-- 插入超级管理员角色
INSERT INTO sys_role (role_id, role_name, role_key, order_num, data_scope, status, remark)
VALUES (1, '超级管理员', 'superadmin', 1, '1', '0', '超级管理员角色，拥有所有权限')
ON CONFLICT (role_id) DO NOTHING;

-- 插入普通角色
INSERT INTO sys_role (role_id, role_name, role_key, order_num, data_scope, status, remark)
VALUES (2, '普通角色', 'common', 2, '4', '0', '普通用户角色')
ON CONFLICT (role_id) DO NOTHING;

-- 重置序列（确保下次自增ID正确）
SELECT setval('sys_dept_dept_id_seq', (SELECT MAX(dept_id) FROM sys_dept));
SELECT setval('sys_post_post_id_seq', (SELECT MAX(post_id) FROM sys_post));
SELECT setval('sys_role_role_id_seq', (SELECT MAX(role_id) FROM sys_role));

-- ============================================================
-- 7. 创建更新时间触发器
-- ============================================================

-- 创建更新时间触发器函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.update_time = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为主表添加更新时间触发器
DROP TRIGGER IF EXISTS trigger_sys_dept_update_time ON sys_dept;
CREATE TRIGGER trigger_sys_dept_update_time
    BEFORE UPDATE ON sys_dept
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_sys_post_update_time ON sys_post;
CREATE TRIGGER trigger_sys_post_update_time
    BEFORE UPDATE ON sys_post
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_sys_role_update_time ON sys_role;
CREATE TRIGGER trigger_sys_role_update_time
    BEFORE UPDATE ON sys_role
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_sys_user_update_time ON sys_user;
CREATE TRIGGER trigger_sys_user_update_time
    BEFORE UPDATE ON sys_user
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_sys_menu_update_time ON sys_menu;
CREATE TRIGGER trigger_sys_menu_update_time
    BEFORE UPDATE ON sys_menu
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为 sys_permission 创建专用的更新时间触发器
CREATE OR REPLACE FUNCTION update_permission_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sys_permission_updated_at ON sys_permission;
CREATE TRIGGER trigger_sys_permission_updated_at
    BEFORE UPDATE ON sys_permission
    FOR EACH ROW
    EXECUTE FUNCTION update_permission_updated_at();

-- ============================================================
-- 初始化完成
-- ============================================================

-- 显示表统计
SELECT
    'Tables Created' as info,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'sys_%';

-- 显示索引统计
SELECT
    'Indexes Created' as info,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'sys_%';

-- 显示外键统计
SELECT
    'Foreign Keys Created' as info,
    COUNT(*) as count
FROM information_schema.table_constraints
WHERE constraint_schema = 'public'
AND constraint_type = 'FOREIGN KEY'
AND table_name LIKE 'sys_%';

-- 提示
SELECT '数据库初始化完成！' as message;
SELECT '请使用 npm run bootstrap:superadmin 命令创建超级管理员用户。' as next_step;
