-- ============================================================================
-- nest-admin 初始化数据（PostgreSQL）
--
-- 用途：新环境建表后灌入基础数据，让系统能登录、能渲染菜单、能做权限校验。
--
-- 前提：已执行 `pnpm db:deploy`（或 prisma migrate deploy）建好表结构。
--
-- 执行：
--   psql -h 127.0.0.1 -U <user> -d <db> -f prisma/seed.sql
--   或在容器内：docker exec -i <pg容器> psql -U <user> -d <db> < prisma/seed.sql
--
-- 幂等：重复运行不会插入重复行；岗位示例数据会同步所属部门。
--       末尾会修正自增序列，保证后续通过接口新增的数据 ID 不撞车。
--
-- 默认账号：admin / admin123（上线前必须改密码）
--
-- 设计说明（与「菜单优先」权限架构对齐）：
--   1. 菜单是权限的唯一创建入口：每个 sys_permission 行的 menu_id 都指向一个
--      C（菜单）或 F（按钮）节点，code 与该节点的 perms 一致。
--   2. C 菜单承载「查看」权限，F 按钮承载「增删改导」权限，一个 code 只绑一个节点。
--   3. 删除菜单会连带删除权限，因此不要单独删 F 节点。
--   4. component 路径按 vben 惯例填写，请按你前端实际目录结构调整后再执行。
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. 部门
--    ancestors 为物化路径，格式 /父ID/.../，根部门为 /
-- ============================================================================
INSERT INTO "sys_dept" ("dept_id", "parent_id", "ancestors", "dept_name", "order_num", "leader_id", "status", "del_flag", "remark")
VALUES
  (1, 0, '/',    '总公司', 1, NULL, '0', '0', '根部门'),
  (2, 1, '/1/',  '研发部', 1, 1,    '0', '0', NULL),
  (3, 1, '/1/',  '市场部', 2, NULL, '0', '0', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 2. 职位
-- ============================================================================
INSERT INTO "sys_post" ("post_id", "dept_id", "post_code", "post_name", "order_num", "status", "del_flag", "remark")
VALUES
  (1, 1, 'ceo', '董事长',   1, '0', '0', NULL),
  (2, 2, 'se',  '项目经理', 2, '0', '0', NULL),
  (3, 1, 'hr',  '人力资源', 3, '0', '0', NULL)
ON CONFLICT ("post_id") DO UPDATE
SET "dept_id" = EXCLUDED."dept_id";

-- ============================================================================
-- 3. 角色
--    role_key = 'superadmin' 是保留角色：PermissionGuard 检测到直接放行，
--    且 DataScopeService 返回全部数据范围。不要改这个 role_key。
-- ============================================================================
INSERT INTO "sys_role" ("role_id", "role_name", "role_key", "order_num", "data_scope", "status", "del_flag", "remark")
VALUES
  (1, '超级管理员', 'superadmin', 1, '1', '0', '0', '保留角色，拥有全部权限，不可删除'),
  (2, '普通角色',   'common',     2, '4', '0', '0', '示例角色，仅只读权限')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 4. 用户
--    密码为 argon2id 哈希（m=65536,t=3,p=1,len=32），明文 admin123
--    如需换密码，用 libs/crypto 的 PasswordHashService.hashPassword() 重新生成
-- ============================================================================
INSERT INTO "sys_user" ("user_id", "dept_id", "user_name", "nick_name", "email", "phonenumber", "sex", "password", "status", "del_flag", "permission_version", "remark")
VALUES
  (1, 1, 'admin', '超级管理员', 'admin@example.com', '13800000000', '1',
   '$argon2id$v=19$m=65536,p=1,t=3$8FDwjEy7r96rvvUF2PUn+w$xzVK8alRiXhUu3O6S21BpPTCamkejFdUZDwmERzW9Q4',
   '0', '0', 0, '系统内置管理员'),
  (2, 2, 'demo', '演示用户', 'demo@example.com', '13900000000', '1',
   '$argon2id$v=19$m=65536,p=1,t=3$8FDwjEy7r96rvvUF2PUn+w$xzVK8alRiXhUu3O6S21BpPTCamkejFdUZDwmERzW9Q4',
   '0', '0', 0, '只读演示账号，密码同 admin123')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. 菜单
--    M = 目录（不允许 perms）、C = 菜单（需 path + component）、F = 按钮（不允许 path/component）
--    ID 段规划：1-99 目录 / 101-299 C 菜单 / 1001+ F 按钮
-- ============================================================================
INSERT INTO "sys_menu" ("menu_id", "parent_id", "menu_name", "menu_type", "order_num", "path", "component", "is_frame", "is_cache", "visible", "status", "perms", "icon", "remark")
VALUES
  -- ---------- 目录 ----------
  (1,   0, '系统管理', 'M', 1, '/system',  NULL, '1', '0', '0', '0', NULL, 'settings', NULL),
  (2,   0, '系统监控', 'M', 2, '/monitor', NULL, '1', '0', '0', '0', NULL, 'activity', NULL),

  -- ---------- 系统管理 / C 菜单（承载 view 权限）----------
  (101, 1, '用户管理', 'C', 1, 'user',       'system/user/index',       '1', '0', '0', '0', 'system:user:view',       'users',      NULL),
  (102, 1, '角色管理', 'C', 2, 'role',       'system/role/index',       '1', '0', '0', '0', 'system:role:view',       'shield',     NULL),
  (103, 1, '菜单管理', 'C', 3, 'menu',       'system/menu/index',       '1', '0', '0', '0', 'system:menu:view',       'list-tree',  NULL),
  (104, 1, '部门管理', 'C', 4, 'dept',       'system/dept/index',       '1', '0', '0', '0', 'system:dept:view',       'building',   NULL),
  (105, 1, '岗位管理', 'C', 5, 'post',       'system/post/index',       '1', '0', '0', '0', 'system:post:view',       'id-card',    NULL),
  (106, 1, '权限诊断', 'C', 6, 'permission', 'system/permission/index', '1', '0', '0', '0', 'system:permission:check','key-round',  '无前端页面时可隐藏'),

  -- ---------- 系统监控 / C 菜单 ----------
  (201, 2, '登录日志', 'C', 1, 'login-log', 'monitor/login-log/index', '1', '0', '0', '0', 'system:loginLog:view', 'log-in',  NULL),
  (202, 2, '操作日志', 'C', 2, 'oper-log',  'monitor/oper-log/index',  '1', '0', '0', '0', 'system:operLog:view',  'history', NULL),

  -- ---------- 用户管理按钮 ----------
  (1001, 101, '用户新增',  'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:user:add',      NULL, NULL),
  (1002, 101, '用户修改',  'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:user:edit',     NULL, NULL),
  (1003, 101, '用户删除',  'F', 3, NULL, NULL, '1', '0', '0', '0', 'system:user:remove',   NULL, NULL),
  (1004, 101, '重置密码',  'F', 4, NULL, NULL, '1', '0', '0', '0', 'system:user:resetPwd', NULL, NULL),
  (1005, 101, '分配角色',  'F', 5, NULL, NULL, '1', '0', '0', '0', 'system:user:assign',   NULL, '同时控制分配职位'),
  (1006, 101, '用户导出',  'F', 6, NULL, NULL, '1', '0', '0', '0', 'system:user:export',   NULL, '后端暂无导出接口'),
  (1007, 101, '用户导入',  'F', 7, NULL, NULL, '1', '0', '0', '0', 'system:user:import',   NULL, '后端暂无导入接口'),

  -- ---------- 角色管理按钮 ----------
  (1011, 102, '角色新增', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:role:add',    NULL, NULL),
  (1012, 102, '角色修改', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:role:edit',   NULL, NULL),
  (1013, 102, '角色删除', 'F', 3, NULL, NULL, '1', '0', '0', '0', 'system:role:remove', NULL, NULL),
  (1014, 102, '菜单授权', 'F', 4, NULL, NULL, '1', '0', '0', '0', 'system:role:assign', NULL, NULL),
  (1015, 102, '数据范围', 'F', 5, NULL, NULL, '1', '0', '0', '0', 'system:role:scope',  NULL, NULL),
  (1016, 102, '角色导出', 'F', 6, NULL, NULL, '1', '0', '0', '0', 'system:role:export', NULL, '后端暂无导出接口'),

  -- ---------- 菜单管理按钮 ----------
  (1021, 103, '菜单新增', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:menu:add',    NULL, NULL),
  (1022, 103, '菜单修改', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:menu:edit',   NULL, NULL),
  (1023, 103, '菜单删除', 'F', 3, NULL, NULL, '1', '0', '0', '0', 'system:menu:remove', NULL, NULL),

  -- ---------- 部门管理按钮 ----------
  (1031, 104, '部门新增', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:dept:add',    NULL, NULL),
  (1032, 104, '部门修改', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:dept:edit',   NULL, NULL),
  (1033, 104, '部门删除', 'F', 3, NULL, NULL, '1', '0', '0', '0', 'system:dept:remove', NULL, NULL),
  (1034, 104, '部门导出', 'F', 4, NULL, NULL, '1', '0', '0', '0', 'system:dept:export', NULL, '后端暂无导出接口'),

  -- ---------- 岗位管理按钮 ----------
  (1041, 105, '岗位新增', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:post:add',    NULL, NULL),
  (1042, 105, '岗位修改', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:post:edit',   NULL, NULL),
  (1043, 105, '岗位删除', 'F', 3, NULL, NULL, '1', '0', '0', '0', 'system:post:remove', NULL, NULL),
  (1044, 105, '岗位导出', 'F', 4, NULL, NULL, '1', '0', '0', '0', 'system:post:export', NULL, '后端暂无导出接口'),

  -- ---------- 权限诊断按钮 ----------
  (1051, 106, '权限清理', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:permission:cleanup', NULL, NULL),
  (1052, 106, '权限修复', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:permission:fix',     NULL, NULL),
  (1053, 106, '缓存清理', 'F', 3, NULL, NULL, '1', '0', '0', '0', 'system:permission:cache',   NULL, NULL),

  -- ---------- 登录日志按钮 ----------
  (1061, 201, '日志删除', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:loginLog:remove', NULL, NULL),
  (1062, 201, '日志导出', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:loginLog:export', NULL, '后端暂无导出接口'),

  -- ---------- 操作日志按钮 ----------
  (1071, 202, '日志删除', 'F', 1, NULL, NULL, '1', '0', '0', '0', 'system:operLog:remove', NULL, NULL),
  (1072, 202, '日志导出', 'F', 2, NULL, NULL, '1', '0', '0', '0', 'system:operLog:export', NULL, '后端暂无导出接口')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 6. 权限
--    与菜单节点 1:1：code = 对应菜单的 perms，menu_id = 对应菜单 ID。
--    resource / action 由 code 的倒数两段解析，与 MenuService.parsePermissionCode 保持一致。
--    注意 updated_at 无数据库默认值（由 Prisma 客户端维护），这里必须显式给值。
-- ============================================================================
INSERT INTO "sys_permission" ("permission_id", "code", "name", "resource", "action", "menu_id", "status", "remark", "created_at", "updated_at")
VALUES
  -- 用户
  (1,  'system:user:view',        '用户管理', 'user',       'view',     101,  '0', '查看用户列表和详情', now(), now()),
  (2,  'system:user:add',         '用户新增', 'user',       'add',      1001, '0', NULL, now(), now()),
  (3,  'system:user:edit',        '用户修改', 'user',       'edit',     1002, '0', NULL, now(), now()),
  (4,  'system:user:remove',      '用户删除', 'user',       'remove',   1003, '0', NULL, now(), now()),
  (5,  'system:user:resetPwd',    '重置密码', 'user',       'resetPwd', 1004, '0', NULL, now(), now()),
  (6,  'system:user:assign',      '分配角色', 'user',       'assign',   1005, '0', '分配用户角色和职位', now(), now()),
  (7,  'system:user:export',      '用户导出', 'user',       'export',   1006, '0', NULL, now(), now()),
  (8,  'system:user:import',      '用户导入', 'user',       'import',   1007, '0', NULL, now(), now()),

  -- 角色
  (9,  'system:role:view',        '角色管理', 'role',       'view',     102,  '0', '查看角色列表和详情', now(), now()),
  (10, 'system:role:add',         '角色新增', 'role',       'add',      1011, '0', NULL, now(), now()),
  (11, 'system:role:edit',        '角色修改', 'role',       'edit',     1012, '0', NULL, now(), now()),
  (12, 'system:role:remove',      '角色删除', 'role',       'remove',   1013, '0', NULL, now(), now()),
  (13, 'system:role:assign',      '菜单授权', 'role',       'assign',   1014, '0', '为角色分配菜单权限', now(), now()),
  (14, 'system:role:scope',       '数据范围', 'role',       'scope',    1015, '0', '设置角色数据范围', now(), now()),
  (15, 'system:role:export',      '角色导出', 'role',       'export',   1016, '0', NULL, now(), now()),

  -- 菜单
  (16, 'system:menu:view',        '菜单管理', 'menu',       'view',     103,  '0', '查看菜单列表和树', now(), now()),
  (17, 'system:menu:add',         '菜单新增', 'menu',       'add',      1021, '0', NULL, now(), now()),
  (18, 'system:menu:edit',        '菜单修改', 'menu',       'edit',     1022, '0', NULL, now(), now()),
  (19, 'system:menu:remove',      '菜单删除', 'menu',       'remove',   1023, '0', NULL, now(), now()),

  -- 部门
  (20, 'system:dept:view',        '部门管理', 'dept',       'view',     104,  '0', '查看部门列表和树', now(), now()),
  (21, 'system:dept:add',         '部门新增', 'dept',       'add',      1031, '0', NULL, now(), now()),
  (22, 'system:dept:edit',        '部门修改', 'dept',       'edit',     1032, '0', NULL, now(), now()),
  (23, 'system:dept:remove',      '部门删除', 'dept',       'remove',   1033, '0', NULL, now(), now()),
  (24, 'system:dept:export',      '部门导出', 'dept',       'export',   1034, '0', NULL, now(), now()),

  -- 岗位
  (25, 'system:post:view',        '岗位管理', 'post',       'view',     105,  '0', '查看岗位列表和详情', now(), now()),
  (26, 'system:post:add',         '岗位新增', 'post',       'add',      1041, '0', NULL, now(), now()),
  (27, 'system:post:edit',        '岗位修改', 'post',       'edit',     1042, '0', NULL, now(), now()),
  (28, 'system:post:remove',      '岗位删除', 'post',       'remove',   1043, '0', NULL, now(), now()),
  (29, 'system:post:export',      '岗位导出', 'post',       'export',   1044, '0', NULL, now(), now()),

  -- 权限诊断
  (30, 'system:permission:check',   '权限诊断', 'permission', 'check',   106,  '0', '体检与代码引用一致性检查', now(), now()),
  (31, 'system:permission:cleanup', '权限清理', 'permission', 'cleanup', 1051, '0', '清理孤儿权限', now(), now()),
  (32, 'system:permission:fix',     '权限修复', 'permission', 'fix',     1052, '0', '修复无效的菜单绑定', now(), now()),
  (33, 'system:permission:cache',   '缓存清理', 'permission', 'cache',   1053, '0', '清除权限缓存', now(), now()),

  -- 登录日志
  (34, 'system:loginLog:view',    '登录日志', 'loginLog',   'view',     201,  '0', '查看登录日志', now(), now()),
  (35, 'system:loginLog:remove',  '日志删除', 'loginLog',   'remove',   1061, '0', NULL, now(), now()),
  (36, 'system:loginLog:export',  '日志导出', 'loginLog',   'export',   1062, '0', NULL, now(), now()),

  -- 操作日志
  (37, 'system:operLog:view',     '操作日志', 'operLog',    'view',     202,  '0', '查看操作日志', now(), now()),
  (38, 'system:operLog:remove',   '日志删除', 'operLog',    'remove',   1071, '0', NULL, now(), now()),
  (39, 'system:operLog:export',   '日志导出', 'operLog',    'export',   1072, '0', NULL, now(), now())
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. 关联关系
-- ============================================================================

-- 7.1 用户 → 角色
INSERT INTO "sys_user_role" ("user_id", "role_id")
VALUES (1, 1), (2, 2)
ON CONFLICT DO NOTHING;

-- 7.2 用户 → 职位
INSERT INTO "sys_user_post" ("user_id", "post_id")
VALUES (1, 1), (2, 2)
ON CONFLICT DO NOTHING;

-- 7.3 角色 → 菜单
--     超级管理员：全部菜单（前端据此渲染完整侧边栏）
INSERT INTO "sys_role_menu" ("role_id", "menu_id")
SELECT 1, "menu_id" FROM "sys_menu"
ON CONFLICT DO NOTHING;

--     普通角色：目录 + 业务菜单，不含「权限诊断」
INSERT INTO "sys_role_menu" ("role_id", "menu_id")
VALUES
  (2, 1), (2, 2),
  (2, 101), (2, 102), (2, 103), (2, 104), (2, 105),
  (2, 201), (2, 202)
ON CONFLICT DO NOTHING;

-- 7.4 角色 → 权限
--     超级管理员：全部权限
--     注意：PermissionGuard 对 superadmin 是直接放行，这份数据主要是为了让
--     /auth/permissions 返回完整编码集合，前端按钮级控制才不会漏。
INSERT INTO "sys_role_permission" ("role_id", "permission_id")
SELECT 1, "permission_id" FROM "sys_permission"
ON CONFLICT DO NOTHING;

--     普通角色：仅只读权限（各 C 菜单对应的 view）
INSERT INTO "sys_role_permission" ("role_id", "permission_id")
VALUES (2, 1), (2, 9), (2, 16), (2, 20), (2, 25), (2, 34), (2, 37)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 8. 修正自增序列
--    显式插入 ID 不会推进 BIGSERIAL 的序列，不修正的话后续接口新增数据会主键冲突。
-- ============================================================================
SELECT setval(pg_get_serial_sequence('sys_dept',       'dept_id'),       COALESCE((SELECT MAX(dept_id)       FROM "sys_dept"),       0) + 1, false);
SELECT setval(pg_get_serial_sequence('sys_post',       'post_id'),       COALESCE((SELECT MAX(post_id)       FROM "sys_post"),       0) + 1, false);
SELECT setval(pg_get_serial_sequence('sys_role',       'role_id'),       COALESCE((SELECT MAX(role_id)       FROM "sys_role"),       0) + 1, false);
SELECT setval(pg_get_serial_sequence('sys_user',       'user_id'),       COALESCE((SELECT MAX(user_id)       FROM "sys_user"),       0) + 1, false);
SELECT setval(pg_get_serial_sequence('sys_menu',       'menu_id'),       COALESCE((SELECT MAX(menu_id)       FROM "sys_menu"),       0) + 1, false);
SELECT setval(pg_get_serial_sequence('sys_permission', 'permission_id'), COALESCE((SELECT MAX(permission_id) FROM "sys_permission"), 0) + 1, false);

COMMIT;

-- ============================================================================
-- 执行后自检
-- ============================================================================
-- 1) 数量应为：dept=3, post=3, role=2, user=2, menu=41, permission=39
--    SELECT
--      (SELECT COUNT(*) FROM "sys_dept")       AS dept,
--      (SELECT COUNT(*) FROM "sys_post")       AS post,
--      (SELECT COUNT(*) FROM "sys_role")       AS role,
--      (SELECT COUNT(*) FROM "sys_user")       AS "user",
--      (SELECT COUNT(*) FROM "sys_menu")       AS menu,
--      (SELECT COUNT(*) FROM "sys_permission") AS permission;
--
-- 2) 每个权限都必须绑到一个菜单（menu_id 不为空），否则说明数据不完整：
--    SELECT code FROM "sys_permission" WHERE menu_id IS NULL;
--
-- 3) 权限 code 必须与菜单 perms 完全一致（应返回 0 行）：
--    SELECT p.code, m.perms
--    FROM "sys_permission" p
--    JOIN "sys_menu" m ON m.menu_id = p.menu_id
--    WHERE p.code <> m.perms;
--
-- 4) 登录后调用 GET /system/permission/references，
--    missing 应为空数组；非空说明代码里引用了未初始化的权限编码。
--
-- 5) 示例岗位应关联到有效部门（应返回 0 行）：
--    SELECT p.post_code
--    FROM "sys_post" p
--    LEFT JOIN "sys_dept" d ON d.dept_id = p.dept_id
--    WHERE p.post_id IN (1, 2, 3) AND d.dept_id IS NULL;
-- ============================================================================
