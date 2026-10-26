# 批次 0 快速参考 - 环境准备完成 ✅

## 📦 一句话总结

批次 0 已完成所有基础类型、工具函数、枚举和文档的定义，为认证权限系统的后续实现奠定了坚实的基础。

---

## 🎯 核心交付物

### 1. BigInt 工具函数库

**文件**: `libs/common/src/utils/bigint.util.ts`

```ts
// 单个 ID 解析
const userId = parseId('123', 'userId'); // bigint

// 单个 ID 格式化
const idStr = formatId(userId); // string

// 批量 ID 解析
const ids = parseIds(['1', '2', '3']); // bigint[]

// 批量 ID 格式化
const strs = formatIds([1n, 2n, 3n]); // string[]
```

### 2. 基础 DTO 类

**文件**: `libs/common/src/dto/`

```ts
// 路径参数 DTO
export class IdParamDto {
  @IsString()
  @Matches(/^(0|[1-9][0-9]*)$/)
  id!: string;
}

// 请求体 DTO
export class IdsBodyDto {
  @IsArray()
  @MinLength(1)
  @IsString({ each: true })
  @Matches(/^(0|[1-9][0-9]*)$/, { each: true })
  ids!: string[];
}
```

### 3. 权限系统的枚举

**文件**: `libs/permission/src/enums/`

```ts
// 权限判定模式
enum Mode {
  AND = 'AND',
  OR = 'OR',
}

// 数据范围
enum DataScope {
  ALL = '1',
  DEPT = '2',
  DEPT_AND_CHILD = '3',
  SELF = '4',
  CUSTOM = '5',
}
```

### 4. 用户主体类型

**文件**: `libs/auth/src/types/user-principal.type.ts`

```ts
interface UserPrincipal {
  userId: bigint;
  username: string;
  nickName: string;
  deptId: bigint | null;
  roleKeys: string[];
  permissionCodes: Set<string>;
  permissionVersion: number;
  sessionId: string;
  status: '0' | '1';
  delFlag: '0' | '1';
  issuedAt: number;
  expiresAt: number;
}

// 辅助函数
isUserValid(user);
hasRole(user, 'admin');
hasPermission(user, 'user:view');
hasAnyPermission(user, ['user:view', 'user:edit']);
hasAllPermissions(user, ['user:view', 'user:edit']);
```

### 5. JWT 配置 ADR

**文件**: `docs/adr/jwt-configuration.md`

关键决策：

- JWT 算法: HS256（HMAC SHA-256）
- Access Token TTL: 15 分钟
- Refresh Token TTL: 7 天
- Payload 最小化：不存储权限列表
- 支持 Session 级 Token 撤销

---

## 📋 使用示例

### Controller 中的使用

```ts
import { IdParamDto, IdsBodyDto, parseId } from '@app/common';
import { Permission, Mode } from '@app/permission';
import { CurrentUser, Public } from '@app/auth';
import { UserPrincipal } from '@app/auth';

@Controller('users')
export class UserController {
  @Get(':id')
  @Permission('system:user:view')
  async findOne(@Param() params: IdParamDto) {
    const userId = parseId(params.id, 'userId');
    return this.userService.findOne(userId);
  }

  @Delete()
  @Permission({
    value: ['system:user:remove', 'system:user:admin'],
    mode: Mode.OR,
  })
  async deleteMany(@Body() body: IdsBodyDto) {
    const userIds = parseIds(body.ids, 'userIds');
    return this.userService.deleteMany(userIds);
  }

  @Post('login')
  @Public()
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  async getCurrentUser(@CurrentUser() user: UserPrincipal) {
    return {
      id: formatId(user.userId),
      username: user.username,
      roles: user.roleKeys,
    };
  }
}
```

### Service 中的使用

```ts
import {
  parseId,
  formatId,
  parseIds,
  UserPrincipal,
  Mode,
  DataScope,
  RESERVED_ROLES,
} from '@app/auth';
import { isSuperAdmin } from '@app/permission';

@Injectable()
export class UserService {
  async findOne(userId: bigint): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
    });
    return this.toDto(user);
  }

  private toDto(user: Prisma.User): UserDto {
    return {
      userId: formatId(user.userId),
      username: user.username,
      deptId: formatId(user.deptId),
    };
  }

  async checkCanManage(actor: UserPrincipal, targetId: bigint): boolean {
    // 超级管理员直接通过
    if (isSuperAdmin(actor.roleKeys)) {
      return true;
    }

    // 检查是否拥有管理权限
    return actor.permissionCodes.has('system:user:edit');
  }

  async checkDataScope(
    actor: UserPrincipal,
    scope: ResolvedDataScope,
  ): Promise<Prisma.UserWhereInput> {
    switch (scope.kind) {
      case DataScope.ALL:
        return {};
      case DataScope.DEPT:
        return { deptId: actor.deptId ?? -1n };
      case DataScope.SELF:
        return { userId: actor.userId };
      // ... 其他情况
    }
  }
}
```

---

## 📁 文件结构

```
libs/
├── auth/src/
│   ├── types/
│   │   └── user-principal.type.ts        ← 用户主体类型
│   └── index.ts                          ✅ 已更新导出
│
├── common/src/
│   ├── dto/
│   │   ├── id-param.dto.ts              ← 单个 ID DTO
│   │   ├── ids-body.dto.ts              ← 批量 ID DTO
│   │   └── index.ts                     ✅ 已更新导出
│   ├── utils/
│   │   ├── bigint.util.ts               ← BigInt 工具
│   │   └── bigint.util.spec.ts          ← 单元测试
│   └── index.ts                         ✅ 已更新导出
│
└── permission/src/
    ├── constants/
    │   └── reserved-roles.ts            ← 保留角色常量
    ├── enums/
    │   ├── mode.enum.ts                 ← 权限模式枚举
    │   └── data-scope.enum.ts           ← 数据范围枚举
    ├── types/
    │   ├── permission-metadata.type.ts  ← 权限元数据类型
    │   └── resolved-data-scope.type.ts  ← 已解析范围类型
    └── index.ts                         ✅ 已更新导出

docs/
├── adr/
│   └── jwt-configuration.md             ← JWT 配置 ADR
├── BATCH-0-QUICK-START.md              ← 本文件
└── rbac/
    ├── b-rbac-implementation.md         ← 完整实现文档
    └── BATCH-0-SUMMARY.md               ← 详细总结
```

---

## 🔗 导入导出示例

### 从 @app/common 导入

```ts
import { IdParamDto, IdsBodyDto, parseId, formatId, parseIds, formatIds } from '@app/common';
```

### 从 @app/auth 导入

```ts
import {
  UserPrincipal,
  isUserValid,
  hasRole,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from '@app/auth';
```

### 从 @app/permission 导入

```ts
import {
  Mode,
  DataScope,
  PermissionMetadata,
  ResolvedDataScope,
  isDataScopeKind,
  isAllScope,
  isScopeWithDepts,
  RESERVED_ROLES,
  isSuperAdmin,
} from '@app/permission';
```

---

## 🧪 测试

### 运行 BigInt 工具测试

```bash
npm run test libs/common/src/utils/bigint.util.spec.ts
```

**测试覆盖**:

- ✅ 有效十进制字符串
- ✅ 无效格式拒绝
- ✅ 超大 BigInt
- ✅ 精度无损
- ✅ Null/Undefined 处理
- ✅ PostgreSQL BIGINT 范围

---

## ⚠️ 关键约束

### BigInt 使用规则

| 边界      | 类型     | 注意事项                       |
| --------- | -------- | ------------------------------ |
| HTTP 入参 | `string` | 必须通过 `parseId` 转为 BigInt |
| HTTP 出参 | `string` | 必须通过 `formatId` 转为字符串 |
| Service   | `bigint` | 内部统一使用 BigInt            |
| Prisma    | `bigint` | Prisma schema 使用 BigInt      |
| JWT       | `string` | sub/sid 都用字符串             |

❌ **禁止**:

- 不要在 HTTP 中使用 `number` 类型
- 不要把 BigInt 放入 JSON.stringify
- 不要在 Prisma 中使用 `number`
- 不要混合 BigInt 和 number 比较

### 权限判定规则

```ts
// ✅ 正确
@Permission('system:user:view')                    // 单权限
@Permission(['user:view', 'user:edit'])            // AND 模式（默认）
@Permission({ value: ['user:view', 'user:edit'], mode: Mode.OR })  // OR 模式
@Permission({ value: 'user:view', role: 'admin' }) // 权限或角色

// ❌ 错误
@Permission({ mode: Mode.AND })      // 缺少 value
@Permission(['user:*'])               // 不支持通配符
```

---

## 🚀 下一步（批次 1）

批次 1（数据库迁移）需要：

1. **确认数据范围映射**
   - 与业务方协商旧 dataScope 值到新枚举的映射
   - 处理旧值 6 和非法值

2. **准备 Prisma schema**
   - 添加 `Permission` 模型
   - 添加 `RolePermission` 关联表
   - 给 `User` 添加 `permissionVersion` 字段

3. **迁移脚本**
   - 从 `Menu.perms` 生成 `Permission` 记录
   - 反推出兼容的 `RolePermission`
   - 编写回滚脚本

4. **数据验证**
   - 检查 `Menu.perms` 重复编码
   - 统计孤儿关联
   - 对账迁移前后数据

---

## 📞 常见问题

### Q: 为什么 ID 必须是字符串？

**A**: JavaScript 的 `Number` 只能安全表示到 `2^53 - 1`，而 PostgreSQL BIGINT 范围更大。使用字符串可以保证往返精度不丧失。

### Q: BigInt 能用在 JSON 中吗？

**A**: 不能。`JSON.stringify` 会抛错。必须在边界处转为字符串，内部才能使用 BigInt。

### Q: 权限编码有 length 限制吗？

**A**: 建议不超过 128 字符，数据库对应 `VARCHAR(128)`。格式: `<module>:<resource>:<action>`

### Q: 超级管理员需要显式授权吗？

**A**: 不需要。检查到 `superadmin` 角色时自动通过所有权限检查。但菜单/权限配置仍需维护（用于前端展示）。

### Q: 如何测试权限判定？

**A**: 后续在批次 3 实现 `PermissionGuard` 后，有完整的单元和集成测试。

---

## 📚 相关文档

- **完整实现文档**: `docs/rbac/b-rbac-implementation.md`
- **批次 0 详细总结**: `docs/rbac/BATCH-0-SUMMARY.md`
- **JWT 配置 ADR**: `docs/adr/jwt-configuration.md`

---

**批次 0 完成**: 2025-01-17 ✅
**下一步**: 批次 1（数据库迁移）
**预计时间**: 2-3 天
