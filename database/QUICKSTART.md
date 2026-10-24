# 5 分钟快速开始

## 最简单的方式

### Windows 用户

1. **双击运行**
   ```
   双击 database/quick-import.bat
   ```

2. **创建管理员**
   ```bash
   npm run bootstrap:superadmin
   ```

3. **启动应用**
   ```bash
   npm run start:dev
   ```

4. **访问**
   ```
   http://localhost:3000/api/docs
   ```

### Linux/Mac 用户

1. **运行导入脚本**
   ```bash
   cd database
   chmod +x quick-import.sh
   ./quick-import.sh
   ```

2. **创建管理员**
   ```bash
   npm run bootstrap:superadmin
   ```

3. **启动应用**
   ```bash
   npm run start:dev
   ```

4. **访问**
   ```
   http://localhost:3000/api/docs
   ```

## 使用 Docker（推荐）

不需要安装 PostgreSQL，只需要 Docker：

### Windows
```bash
database\quick-import.bat --docker
npm run bootstrap:superadmin
npm run start:dev
```

### Linux/Mac
```bash
./database/quick-import.sh --docker
npm run bootstrap:superadmin
npm run start:dev
```

## 手动方式

如果你已经有 PostgreSQL：

### 1. 创建数据库
```bash
createdb nest-admin
```

### 2. 导入表结构
```bash
psql -d nest-admin -f database/init-schema.sql
```

### 3. 配置连接
创建 `config/development.local.yaml`:
```yaml
database:
  url: postgresql://postgres:postgres@localhost:5432/nest-admin?schema=public
```

### 4. 创建管理员
```bash
npm run bootstrap:superadmin
```

按提示输入：
- 用户名：`admin`
- 密码：`Admin@123456`（至少 8 位，包含大小写字母和数字）
- 昵称：`超级管理员`
- 邮箱：`admin@example.com`

### 5. 启动应用
```bash
npm run start:dev
```

### 6. 测试登录

#### 使用 API 文档
访问 http://localhost:3000/api/docs

#### 使用 curl
```bash
# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "Admin@123456"
  }'

# 响应（获取 accessToken）
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 1800
}

# 使用 Token 访问用户信息
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

## 故障排查

### 问题：数据库连接失败

**检查**:
1. PostgreSQL 是否启动
   ```bash
   # Linux
   sudo systemctl status postgresql

   # Mac
   brew services list

   # Windows
   net start postgresql-x64-16
   ```

2. 端口是否被占用
   ```bash
   # 检查 5432 端口
   netstat -ano | findstr 5432  # Windows
   lsof -i :5432                 # Mac/Linux
   ```

3. 密码是否正确
   ```bash
   # 测试连接
   psql -U postgres -d postgres
   ```

### 问题：表已存在

**解决**:

使用 `--force` 参数重建：
```bash
# Windows
database\quick-import.bat --force

# Linux/Mac
./database/quick-import.sh --force
```

### 问题：psql 命令未找到

**解决**:

使用 Docker 模式：
```bash
# Windows
database\quick-import.bat --docker

# Linux/Mac
./database/quick-import.sh --docker
```

或下载 PostgreSQL 客户端工具：
- Windows: https://www.postgresql.org/download/windows/
- Mac: `brew install postgresql`
- Linux: `sudo apt-get install postgresql-client`

### 问题：创建管理员失败

**检查**:
1. 数据库是否已初始化
2. 角色表是否有数据
   ```sql
   SELECT * FROM sys_role WHERE role_key = 'superadmin';
   ```
3. 部门表是否有数据
   ```sql
   SELECT * FROM sys_dept WHERE dept_id = 1;
   ```

如果缺少数据，重新导入：
```bash
psql -d nest-admin -f database/init-schema.sql
```

## 验证成功

### 检查表
```sql
-- 连接数据库
psql -d nest-admin

-- 查询所有表
\dt sys_*

-- 应该看到 12 张表
```

### 检查初始数据
```sql
-- 查询部门
SELECT * FROM sys_dept;

-- 查询职位
SELECT * FROM sys_post;

-- 查询角色
SELECT * FROM sys_role;

-- 查询用户（创建管理员后）
SELECT user_id, user_name, nick_name, status FROM sys_user;
```

### 检查应用启动
```bash
npm run start:dev
```

应该看到：
```
[Nest] 12345  - 2025/01/24 10:00:00 LOG [NestFactory] Starting Nest application...
[Nest] 12345  - 2025/01/24 10:00:00 LOG [InstanceLoader] AppConfigModule dependencies initialized
[Nest] 12345  - 2025/01/24 10:00:00 LOG [InstanceLoader] DatabaseModule dependencies initialized
...
[Nest] 12345  - 2025/01/24 10:00:01 LOG [NestApplication] Nest application successfully started
[Nest] 12345  - 2025/01/24 10:00:01 LOG Application is running on: http://localhost:3000
```

## 下一步

1. **配置生产环境**
   - 复制 `config/production.local.yaml.example`
   - 配置真实的数据库连接和 JWT 密钥

2. **配置权限种子**
   ```bash
   npm run permission:sync
   ```

3. **备份数据库**
   ```bash
   npm run db:backup
   ```

4. **查看文档**
   - [完整配置指南](../docs/configuration-guide.md)
   - [RBAC 实现文档](../docs/rbac/b-rbac-implementation.md)
   - [批次实施记录](../docs/rbac/)

## 常用命令

```bash
# 开发环境启动
npm run start:dev

# 生产环境启动
npm run start:prod

# 创建超级管理员
npm run bootstrap:superadmin

# 同步权限种子
npm run permission:sync

# 检查权限差异
npm run permission:check

# 备份数据库
npm run db:backup

# 恢复数据库
npm run db:restore backups/your_backup.sql
```

## 测试数据

如需测试数据，可以手动插入：

```sql
-- 插入测试部门
INSERT INTO sys_dept (parent_id, ancestors, dept_name, order_num, status)
VALUES
    (1, '/1/2/', '技术部', 1, '0'),
    (1, '/1/3/', '市场部', 2, '0'),
    (2, '/1/2/4/', '开发组', 1, '0');

-- 插入测试用户
INSERT INTO sys_user (dept_id, user_name, nick_name, email, password, status)
VALUES
    (2, 'zhangsan', '张三', 'zhangsan@example.com', '$2b$10$...', '0'),
    (3, 'lisi', '李四', 'lisi@example.com', '$2b$10$...', '0');

-- 注意：password 字段需要使用 bcrypt 哈希
-- 可以使用超级管理员创建用户，或使用注册接口
```

---

遇到问题？查看 [database/README.md](README.md) 获取详细文档。
