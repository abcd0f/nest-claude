# 数据库初始化指南

## 文件说明

- `init-schema.sql` - 完整的数据库初始化脚本

## 快速开始

### 方式一：使用 psql 命令行

```bash
# 1. 创建数据库
createdb nest-admin

# 2. 导入初始化脚本
psql -d nest-admin -f database/init-schema.sql
```

### 方式二：使用 PostgreSQL 客户端工具

#### pgAdmin 4
1. 打开 pgAdmin 4
2. 连接到 PostgreSQL 服务器
3. 右键点击数据库 → Create → Database
4. 数据库名：`nest-admin`
5. 右键点击 `nest-admin` → Query Tool
6. 打开 `database/init-schema.sql` 文件
7. 点击执行按钮（▶️）

#### DBeaver
1. 打开 DBeaver
2. 连接到 PostgreSQL 服务器
3. 右键点击服务器 → Create → Database
4. 数据库名：`nest-admin`
5. 右键点击 `nest-admin` → SQL Editor → Open SQL Script
6. 选择 `database/init-schema.sql` 文件
7. 点击执行按钮（Ctrl+Enter）

#### DataGrip / IntelliJ IDEA
1. 打开 DataGrip 或 IDEA
2. 连接到 PostgreSQL 数据源
3. 右键点击数据源 → New → Database
4. 数据库名：`nest-admin`
5. 打开 `database/init-schema.sql` 文件
6. 点击执行按钮（Ctrl+Enter）

### 方式三：使用 Docker + PostgreSQL

```bash
# 1. 启动 PostgreSQL 容器
docker run -d \
  --name nest-admin-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=nest-admin \
  -p 5432:5432 \
  postgres:16-alpine

# 2. 等待容器启动（约 5 秒）
sleep 5

# 3. 导入初始化脚本
docker exec -i nest-admin-db psql -U postgres -d nest-admin < database/init-schema.sql
```

## 初始化脚本内容

### 1. 创建表结构（12 张表）

**核心业务表**:
- `sys_dept` - 部门表
- `sys_post` - 职位表
- `sys_role` - 角色表
- `sys_user` - 用户表
- `sys_menu` - 菜单表
- `sys_permission` - 权限表

**关联表**:
- `sys_user_role` - 用户角色关联
- `sys_user_post` - 用户职位关联
- `sys_role_menu` - 角色菜单关联
- `sys_role_permission` - 角色权限关联
- `sys_role_dept` - 角色部门关联（数据权限）

**日志表**:
- `sys_login_log` - 登录日志
- `sys_oper_log` - 操作日志

### 2. 创建索引

- 主键索引（自动）
- 外键索引
- 查询优化索引（用户名、部门路径、登录时间等）

### 3. 创建外键约束

- 级联删除（用户删除时自动删除关联数据）
- SET NULL（部门删除时用户的部门ID设为NULL）

### 4. 插入初始数据

- 根部门（总公司）
- 4 个默认职位（董事长、项目经理、人力资源、普通员工）
- 2 个默认角色（超级管理员、普通角色）

### 5. 创建触发器

- 自动更新 `update_time` 字段
- 自动更新 `updated_at` 字段（权限表）

## 验证安装

### 检查表是否创建成功

```sql
-- 查询所有表
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'sys_%'
ORDER BY table_name;

-- 应该显示 12 张表
```

### 检查初始数据

```sql
-- 查询部门数据
SELECT * FROM sys_dept;

-- 查询职位数据
SELECT * FROM sys_post;

-- 查询角色数据
SELECT * FROM sys_role;
```

### 检查索引

```sql
-- 查询所有索引
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename LIKE 'sys_%'
ORDER BY tablename, indexname;
```

### 检查外键

```sql
-- 查询所有外键约束
SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name LIKE 'sys_%'
ORDER BY tc.table_name;
```

## 创建超级管理员

数据库初始化完成后，需要创建超级管理员账号：

```bash
# 方式一：使用 npm 脚本
npm run bootstrap:superadmin

# 方式二：使用 npx
npx tsx scripts/bootstrap-superadmin.ts

# 按提示输入用户名、密码、昵称、邮箱等信息
```

默认会创建：
- 用户名：`admin`
- 密码：`Admin@123456`
- 角色：超级管理员
- 部门：总公司
- 职位：董事长

## 配置数据库连接

### 开发环境

编辑 `config/development.local.yaml`（如果不存在则创建）：

```yaml
database:
  url: postgresql://postgres:postgres@localhost:5432/nest-admin?schema=public
```

### 生产环境

编辑 `config/production.local.yaml`：

```yaml
database:
  url: postgresql://USER:PASSWORD@HOST:5432/nest-admin?schema=public
  pool:
    max: 20
    idle-timeout: 30000
    connect-timeout: 5000
  log-queries: false
```

## 启动应用

```bash
# 开发环境
npm run start:dev

# 生产环境
export NODE_ENV=production
npm run start:prod
```

## 数据库迁移

### 使用 Prisma 迁移

```bash
# 生成迁移文件
npx prisma migrate dev --name init

# 应用迁移
npx prisma migrate deploy
```

### 手动迁移

如果需要修改表结构，可以：

1. 修改 `prisma/models/*.prisma` 文件
2. 运行 `npx prisma migrate dev --name your_migration_name`
3. Prisma 会生成 SQL 迁移文件

## 数据备份

### 备份整个数据库

```bash
# 使用 pg_dump
pg_dump -U postgres -d nest-admin -f backup.sql

# 使用 Docker
docker exec nest-admin-db pg_dump -U postgres nest-admin > backup.sql
```

### 备份特定表

```bash
# 只备份用户表
pg_dump -U postgres -d nest-admin -t sys_user -f sys_user_backup.sql
```

### 使用项目脚本

```bash
# 备份到 backups/ 目录
npm run db:backup

# 恢复备份
npm run db:restore backups/backup_20250124_123456.sql
```

## 数据恢复

### 恢复完整备份

```bash
# 1. 删除现有数据库（可选）
dropdb nest-admin

# 2. 创建新数据库
createdb nest-admin

# 3. 恢复备份
psql -U postgres -d nest-admin -f backup.sql

# 使用 Docker
docker exec -i nest-admin-db psql -U postgres nest-admin < backup.sql
```

### 恢复特定表

```bash
psql -U postgres -d nest-admin -f sys_user_backup.sql
```

## 常见问题

### 问题 1: 数据库已存在

```
ERROR: database "nest-admin" already exists
```

**解决**:
```bash
# 删除现有数据库
dropdb nest-admin

# 重新创建
createdb nest-admin
```

### 问题 2: 权限不足

```
ERROR: permission denied to create database
```

**解决**:
```bash
# 使用超级用户身份
psql -U postgres

# 或授予创建数据库权限
GRANT CREATE ON DATABASE postgres TO your_user;
```

### 问题 3: 连接被拒绝

```
ERROR: connection to server at "localhost" (::1), port 5432 failed
```

**解决**:
1. 确认 PostgreSQL 服务已启动
2. 检查端口是否正确
3. 检查防火墙设置
4. 检查 `pg_hba.conf` 配置

### 问题 4: 表已存在

```
ERROR: relation "sys_user" already exists
```

**解决**:

脚本使用了 `IF NOT EXISTS` 和 `ON CONFLICT DO NOTHING`，所以重复执行是安全的。如果需要完全重建：

```sql
-- 删除所有表
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- 重新导入脚本
\i database/init-schema.sql
```

## 表结构说明

### sys_user（用户表）

| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | BIGSERIAL | 用户ID（主键） |
| dept_id | BIGINT | 所属部门 |
| user_name | VARCHAR(64) | 用户名（唯一） |
| nick_name | VARCHAR(100) | 用户昵称 |
| email | VARCHAR(254) | 邮箱 |
| phonenumber | VARCHAR(32) | 手机号 |
| sex | CHAR(1) | 性别：0=男 1=女 2=未知 |
| password | VARCHAR(255) | 密码（bcrypt哈希） |
| status | CHAR(1) | 状态：0=正常 1=停用 |
| del_flag | CHAR(1) | 删除标志：0=正常 1=删除 |
| permission_version | INT | 权限版本号 |

### sys_role（角色表）

| 字段 | 类型 | 说明 |
|------|------|------|
| role_id | BIGSERIAL | 角色ID（主键） |
| role_name | VARCHAR(64) | 角色名称 |
| role_key | VARCHAR(64) | 角色标识 |
| data_scope | CHAR(1) | 数据范围：1=全部 2=本部门 3=本部门及以下 4=仅本人 5=自定义 |
| status | CHAR(1) | 状态：0=正常 1=停用 |

### sys_permission（权限表）

| 字段 | 类型 | 说明 |
|------|------|------|
| permission_id | BIGSERIAL | 权限ID（主键） |
| code | VARCHAR(128) | 权限编码（唯一） |
| name | VARCHAR(100) | 权限名称 |
| resource | VARCHAR(100) | 资源名称 |
| action | VARCHAR(64) | 操作动作 |
| menu_id | BIGINT | 关联菜单ID |
| status | CHAR(1) | 状态：0=启用 1=停用 |

详细的表结构说明请参考 `prisma/models/*.prisma` 文件。

## 性能优化建议

### 1. 定期清理日志表

```sql
-- 清理 30 天前的登录日志
DELETE FROM sys_login_log
WHERE login_time < NOW() - INTERVAL '30 days';

-- 清理 90 天前的操作日志
DELETE FROM sys_oper_log
WHERE oper_time < NOW() - INTERVAL '90 days';
```

### 2. 定期执行 VACUUM

```sql
-- 清理和分析所有表
VACUUM ANALYZE;

-- 针对特定表
VACUUM ANALYZE sys_user;
VACUUM ANALYZE sys_login_log;
```

### 3. 监控慢查询

```sql
-- 启用慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 记录超过1秒的查询
SELECT pg_reload_conf();
```

### 4. 优化连接池

在 `config/production.yaml` 中：

```yaml
database:
  pool:
    max: 20  # 根据实例数调整
    idle-timeout: 30000
    connect-timeout: 5000
```

建议：`实例数 × max < PostgreSQL max_connections`

## 安全建议

### 1. 修改默认密码

```sql
ALTER USER postgres WITH PASSWORD 'your_strong_password';
```

### 2. 限制网络访问

编辑 `postgresql.conf`:
```
listen_addresses = 'localhost'  # 只监听本地
```

编辑 `pg_hba.conf`:
```
# 只允许本地连接
host    all             all             127.0.0.1/32            md5
```

### 3. 定期备份

```bash
# 设置定时任务（crontab）
0 2 * * * pg_dump -U postgres nest-admin > /backups/nest-admin_$(date +\%Y\%m\%d).sql
```

### 4. 加密连接

在连接字符串中启用 SSL：
```
postgresql://user:pass@host:5432/nest-admin?sslmode=require
```

## 相关文档

- [PostgreSQL 官方文档](https://www.postgresql.org/docs/)
- [Prisma 文档](https://www.prisma.io/docs)
- [项目配置指南](../docs/configuration-guide.md)
- [RBAC 实现文档](../docs/rbac/b-rbac-implementation.md)

---

**最后更新**: 2025-01-24
