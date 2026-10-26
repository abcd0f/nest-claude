import { PrismaService } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import {
  PermissionDiagnosticResult,
  PermissionReferenceCheckResult,
} from '../types/permission-diagnostic.type.js';
import { PermissionReferenceScanner } from './permission-reference.scanner.js';

/**
 * 权限诊断服务
 *
 * 菜单优先架构（方案 B）下，权限行由菜单管理创建与维护，本服务只负责**检查与修复**，
 * 不提供任何"从代码同步权限"的能力 —— 权限的唯一入口是菜单数据。
 *
 * 提供三类能力：
 * - 数据体检：统计、孤儿、未授权、重复编码、无效菜单绑定
 * - 引用对账：代码里 `@Permission` 声明的编码与数据库权限行做差集
 * - 数据修复：清理孤儿权限、解除失效的菜单绑定
 */
@Injectable()
export class PermissionDiagnosticService {
  private readonly logger = new Logger(PermissionDiagnosticService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly referenceScanner: PermissionReferenceScanner,
  ) {}

  /**
   * 权限数据体检
   *
   * 一次查询拉全量权限及其角色引用情况，在内存中完成各项统计，避免多次往返数据库。
   *
   * @returns 诊断结果
   */
  async checkPermissions(): Promise<PermissionDiagnosticResult> {
    this.logger.log('Starting permission check');

    const permissions = await this.prisma.permission.findMany({
      select: {
        code: true,
        name: true,
        status: true,
        menuId: true,
        // 只需要判断"有没有角色在用"，取一条即可
        roles: { select: { roleId: true }, take: 1 },
      },
    });

    const total = permissions.length;
    const enabled = permissions.filter((p) => p.status === '0').length;
    const disabled = total - enabled;

    const unbound = permissions.filter((p) => p.menuId === null);
    const unassigned = permissions.filter((p) => p.roles.length === 0);
    // 孤儿：既没有菜单入口，也没有任何角色持有，属于纯数据残留
    const orphans = unbound.filter((p) => p.roles.length === 0);

    // 重复编码（理论上不应存在，因为有唯一约束）
    const duplicates = await this.prisma.$queryRaw<Array<{ code: string; count: bigint }>>`
      SELECT code, COUNT(*) as count
      FROM sys_permission
      GROUP BY code
      HAVING COUNT(*) > 1
    `;

    // 绑定了菜单但菜单不存在的权限
    const invalidMenuBindings = await this.prisma.permission.findMany({
      where: {
        menuId: { not: null },
        menu: null,
      },
      select: {
        code: true,
        name: true,
        menuId: true,
      },
    });

    const result: PermissionDiagnosticResult = {
      total,
      enabled,
      disabled,
      unbound: unbound.map((p) => ({ code: p.code, name: p.name })),
      orphans: orphans.map((p) => ({
        code: p.code,
        name: p.name,
        menuId: p.menuId,
      })),
      unassigned: unassigned.map((p) => ({ code: p.code, name: p.name })),
      duplicates: duplicates.map((d) => ({
        code: d.code,
        count: Number(d.count),
      })),
      invalidMenuBindings: invalidMenuBindings.map((p) => ({
        code: p.code,
        name: p.name,
        menuId: p.menuId!,
      })),
    };

    this.logger.log(
      `Permission check completed: total=${total}, enabled=${enabled}, disabled=${disabled}, unbound=${unbound.length}, orphans=${orphans.length}, unassigned=${unassigned.length}, duplicates=${duplicates.length}, invalidBindings=${invalidMenuBindings.length}`,
    );

    return result;
  }

  /**
   * 代码引用一致性检查
   *
   * 扫描所有 Controller 上 `@Permission` 声明的编码，与数据库权限行做双向差集：
   * - `missing`：代码引用了但数据库没有 → 相关接口对非超管用户返回 403，必须处理
   * - `unused`：数据库有但代码没引用 → 可能是纯前端按钮权限，也可能是废弃权限
   *
   * @returns 引用检查结果
   */
  async checkCodeReferences(): Promise<PermissionReferenceCheckResult> {
    this.logger.log('Starting permission reference check');

    const references = this.referenceScanner.collect();
    const codes = [...references.keys()].sort();

    const dbPermissions = await this.prisma.permission.findMany({
      select: { code: true, name: true, menuId: true },
    });
    const dbCodeSet = new Set(dbPermissions.map((p) => p.code));

    const missing = codes
      .filter((code) => !dbCodeSet.has(code))
      .map((code) => ({
        code,
        locations: references.get(code) ?? [],
      }));

    const unused = dbPermissions.filter((p) => !references.has(p.code));

    if (missing.length > 0) {
      this.logger.warn(
        `检测到 ${missing.length} 个代码引用但数据库缺失的权限编码：${missing
          .map((m) => m.code)
          .join(', ')}。相关接口将对非超管用户返回 403`,
      );
    }

    this.logger.log(
      `Reference check completed: codes=${codes.length}, missing=${missing.length}, unused=${unused.length}`,
    );

    return {
      total: codes.length,
      missing,
      unused: unused.map((p) => ({
        code: p.code,
        name: p.name,
        menuId: p.menuId,
      })),
      codes,
    };
  }

  /**
   * 清理孤儿权限
   *
   * 删除同时满足以下条件的权限：
   * - 未绑定任何菜单
   * - 没有任何角色引用
   *
   * 这两条同时成立意味着该权限既无法通过菜单授权、也不在任何角色的权限集中，
   * 属于纯数据残留。只要还有菜单入口或角色持有，就不会被删除。
   *
   * @returns 删除的权限数量
   */
  async cleanupOrphanPermissions(): Promise<number> {
    this.logger.log('Starting orphan permission cleanup');

    const result = await this.prisma.permission.deleteMany({
      where: {
        menuId: null,
        roles: {
          none: {},
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} orphan permissions`);

    return result.count;
  }

  /**
   * 修复无效的菜单绑定
   *
   * 将绑定了不存在菜单的权限解除绑定
   *
   * @returns 修复的权限数量
   */
  async fixInvalidMenuBindings(): Promise<number> {
    this.logger.log('Starting invalid menu binding fix');

    const invalid = await this.prisma.permission.findMany({
      where: {
        menuId: { not: null },
        menu: null,
      },
      select: { permissionId: true },
    });

    if (invalid.length === 0) {
      this.logger.log('No invalid menu bindings found');
      return 0;
    }

    const result = await this.prisma.permission.updateMany({
      where: {
        permissionId: { in: invalid.map((p) => p.permissionId) },
      },
      data: {
        menuId: null,
      },
    });

    this.logger.log(`Fixed ${result.count} invalid menu bindings`);

    return result.count;
  }
}
