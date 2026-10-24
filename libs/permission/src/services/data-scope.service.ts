import { PrismaService } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DataScope } from '../enums/data-scope.enum.js';
import { ResolvedDataScope } from '../types/resolved-data-scope.type.js';

/**
 * 数据范围服务
 *
 * 职责：
 * - 解析用户的数据访问范围
 * - 根据范围生成 Prisma where 条件
 * - 支持多角色范围合并（并集策略）
 * - 处理部门子树查询
 */
@Injectable()
export class DataScopeService {
  private readonly logger = new Logger(DataScopeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 解析用户的数据范围
   *
   * 流程：
   * 1. 获取用户的所有有效角色
   * 2. 合并多个角色的范围（并集策略）
   * 3. 返回解析后的范围
   *
   * 合并规则（按优先级）：
   * - 任意角色是 ALL，则返回 ALL
   * - 任意角色是 CUSTOM，则收集所有自定义部门
   * - 任意角色是 DEPT_AND_CHILD，则包含
   * - 其次是 DEPT
   * - 最低是 SELF
   *
   * @param userId 用户 ID
   * @returns 已解析的数据范围
   */
  async resolveUserScope(userId: bigint): Promise<ResolvedDataScope> {
    // 1. 查询用户的所有有效角色
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        userId,
        user: { status: '0', delFlag: '0' },
        role: { status: '0', delFlag: '0' },
      },
      include: {
        role: {
          select: {
            dataScope: true,
            depts: { select: { deptId: true } },
          },
        },
      },
    });

    const roles = userRoles.map((ur) => ur.role).filter(Boolean);

    this.logger.debug(`User ${userId} has ${roles.length} valid roles`);

    // 没有有效角色，返回空范围（拒绝访问）
    if (roles.length === 0) {
      this.logger.debug(`User ${userId} has no valid roles, returning empty scope`);
      return { kind: DataScope.SELF }; // 最严格的范围
    }

    // 2. 合并多角色范围（并集策略）
    return this.mergeDataScopes(roles);
  }

  /**
   * 合并多个角色的数据范围
   *
   * 合并策略（并集，取最大可见范围）：
   * - ALL 吸收其它所有范围
   * - CUSTOM 部门 ID 集合合并
   * - DEPT_AND_CHILD 与其它范围合并
   * - DEPT 与其它范围合并
   * - SELF 作为最低优先级
   *
   * @param roles 角色列表，每个角色包含 dataScope 和 depts（RoleDept 关系）
   * @returns 合并后的数据范围
   */
  private mergeDataScopes(
    roles: Array<{ dataScope: string; depts: Array<{ deptId: bigint }> }>,
  ): ResolvedDataScope {
    // 第一优先级：任意角色是 ALL，则为全部
    if (roles.some((r) => r.dataScope === DataScope.ALL)) {
      this.logger.debug('Found ALL scope in user roles');
      return { kind: DataScope.ALL };
    }

    // 收集所有 CUSTOM 部门 ID
    const customDepts = new Set<bigint>();
    let hasCustom = false;
    for (const role of roles) {
      if (role.dataScope === DataScope.CUSTOM) {
        hasCustom = true;
        for (const dept of role.depts) {
          customDepts.add(dept.deptId);
        }
      }
    }

    // 第二优先级：CUSTOM 范围
    if (hasCustom && customDepts.size > 0) {
      this.logger.debug(`Found CUSTOM scope with ${customDepts.size} departments`);
      return { kind: DataScope.CUSTOM, deptIds: [...customDepts] };
    }

    // 第三优先级：DEPT_AND_CHILD
    if (roles.some((r) => r.dataScope === DataScope.DEPT_AND_CHILD)) {
      this.logger.debug('Found DEPT_AND_CHILD scope in user roles');
      return { kind: DataScope.DEPT_AND_CHILD, deptIds: [] };
    }

    // 第四优先级：DEPT
    if (roles.some((r) => r.dataScope === DataScope.DEPT)) {
      this.logger.debug('Found DEPT scope in user roles');
      return { kind: DataScope.DEPT };
    }

    // 最后是 SELF
    this.logger.debug('No special scope found, returning SELF scope');
    return { kind: DataScope.SELF };
  }

  /**
   * 为用户资源构建 where 条件
   *
   * 根据用户的数据范围和用户信息，生成相应的 Prisma where 条件
   *
   * @param scope 已解析的数据范围
   * @param userDeptId 用户所在部门 ID
   * @param userId 用户 ID
   * @returns Prisma where 条件，用于 findMany/count 等查询
   */
  async buildUserWhereCondition(
    scope: ResolvedDataScope,
    userDeptId: bigint | null,
    userId: bigint,
  ): Promise<Prisma.WhereInput> {
    switch (scope.kind) {
      case DataScope.ALL:
        // 全部数据，无条件限制
        return {};

      case DataScope.DEPT:
        // 本部门，按 deptId 过滤
        // 如果用户没有部门，无法匹配任何记录
        return userDeptId ? { deptId: userDeptId } : { deptId: { equals: -1n } };

      case DataScope.DEPT_AND_CHILD:
        // 本部门及以下，需要查询子部门
        if (!userDeptId) {
          return { deptId: { equals: -1n } };
        }
        const deptIds = await this.getDeptChildrenIds(userDeptId);
        return { deptId: { in: deptIds } };

      case DataScope.SELF:
        // 仅本人，按用户 ID 过滤
        return { userId };

      case DataScope.CUSTOM:
        // 自定义部门，按部门 ID 列表过滤
        return scope.deptIds.length > 0
          ? { deptId: { in: scope.deptIds } }
          : { deptId: { equals: -1n } };

      default:
        // 未知范围，拒绝访问
        return { deptId: { equals: -1n } };
    }
  }

  /**
   * 为部门资源构建 where 条件
   *
   * 部门资源有特殊的处理：需要根据部门树的 ancestors 字段进行过滤
   *
   * @param scope 已解析的数据范围
   * @param userDeptId 用户所在部门 ID
   * @param userId 用户 ID
   * @returns Prisma where 条件
   */
  async buildDeptWhereCondition(
    scope: ResolvedDataScope,
    userDeptId: bigint | null,
    userId: bigint,
  ): Promise<Prisma.WhereInput> {
    switch (scope.kind) {
      case DataScope.ALL:
        return {};

      case DataScope.DEPT:
        // 仅本部门
        return userDeptId ? { deptId: userDeptId } : { deptId: { equals: -1n } };

      case DataScope.DEPT_AND_CHILD:
        // 本部门及以下
        if (!userDeptId) {
          return { deptId: { equals: -1n } };
        }
        const deptIds = await this.getDeptChildrenIds(userDeptId);
        return { deptId: { in: deptIds } };

      case DataScope.SELF:
        // 部门资源中，SELF 通常表示无法访问（除非是部门负责人）
        return { leaderId: userId };

      case DataScope.CUSTOM:
        return scope.deptIds.length > 0
          ? { deptId: { in: scope.deptIds } }
          : { deptId: { equals: -1n } };

      default:
        return { deptId: { equals: -1n } };
    }
  }

  /**
   * 为操作日志资源构建 where 条件
   *
   * 操作日志通常有 operUserId 字段表示操作人
   *
   * @param scope 已解析的数据范围
   * @param userDeptId 用户所在部门 ID
   * @param userId 用户 ID
   * @returns Prisma where 条件
   */
  async buildOperLogWhereCondition(
    scope: ResolvedDataScope,
    userDeptId: bigint | null,
    userId: bigint,
  ): Promise<Prisma.WhereInput> {
    // 操作日志按操作人的部门范围过滤
    switch (scope.kind) {
      case DataScope.ALL:
        return {};

      case DataScope.DEPT:
        return userDeptId
          ? { operUser: { deptId: userDeptId } }
          : { operUser: { deptId: { equals: -1n } } };

      case DataScope.DEPT_AND_CHILD:
        if (!userDeptId) {
          return { operUser: { deptId: { equals: -1n } } };
        }
        const deptIds = await this.getDeptChildrenIds(userDeptId);
        return { operUser: { deptId: { in: deptIds } } };

      case DataScope.SELF:
        return { operUserId: userId };

      case DataScope.CUSTOM:
        return scope.deptIds.length > 0
          ? { operUser: { deptId: { in: scope.deptIds } } }
          : { operUser: { deptId: { equals: -1n } } };

      default:
        return { operUser: { deptId: { equals: -1n } } };
    }
  }

  /**
   * 获取部门的所有子部门 ID（包含自身）
   *
   * 基于 Dept.ancestors 字段实现，ancestors 为物化路径
   * 例如：根部门 /1，一级子部门 /1/2，二级子部门 /1/2/3
   *
   * @param deptId 部门 ID
   * @returns 部门及其所有子部门的 ID 列表
   */
  async getDeptChildrenIds(deptId: bigint): Promise<bigint[]> {
    // 查询该部门及其所有子部门
    const depts = await this.prisma.dept.findMany({
      where: {
        // 使用 ancestors 进行模糊匹配找到所有子部门
        // ancestors 中包含 deptId 的记录都是该部门的子部门（包含自身）
        OR: [
          { deptId },
          { ancestors: { contains: `/${deptId}/` } },
          { ancestors: { endsWith: `/${deptId}` } },
        ],
      },
      select: { deptId: true },
    });

    return depts.map((d) => d.deptId);
  }

  /**
   * 获取部门的所有父部门 ID（包含自身）
   *
   * 基于 Dept.ancestors 字段实现
   *
   * @param deptId 部门 ID
   * @returns 部门及其所有父部门的 ID 列表
   */
  async getDeptParentIds(deptId: bigint): Promise<bigint[]> {
    const dept = await this.prisma.dept.findUnique({
      where: { deptId },
      select: { ancestors: true, deptId: true },
    });

    if (!dept) {
      return [];
    }

    // ancestors 格式如 /1/2/3，当前部门 ID 为 3
    // 需要提取其中的所有部门 ID
    const ancestorIds = dept.ancestors
      .split('/')
      .filter((id) => id.trim() !== '')
      .map((id) => BigInt(id));

    return ancestorIds;
  }

  /**
   * 合并多个 where 条件
   *
   * 用于将数据范围条件与其他业务条件合并
   * 推荐使用 AND 逻辑：范围条件和业务条件都必须满足
   *
   * @param conditions 条件列表
   * @returns 合并后的 where 条件
   */
  static mergeWhereConditions(
    ...conditions: (Prisma.WhereInput | null | undefined)[]
  ): Prisma.WhereInput {
    const valid = conditions.filter((c) => c !== null && c !== undefined);

    if (valid.length === 0) {
      return {};
    }

    if (valid.length === 1) {
      return valid[0]!;
    }

    return {
      AND: valid,
    };
  }
}
