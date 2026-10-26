import { PrismaService } from '@app/database';
import { Injectable, Logger } from '@nestjs/common';
import {
  PermissionDiagnosticResult,
  PermissionSeedDefinition,
  PermissionSyncResult,
} from '../types/permission-seed.type.js';

/**
 * 权限同步服务
 *
 * 职责：
 * - 从种子文件同步权限到数据库
 * - 权限对账：检查未绑定权限、孤儿权限、重复编码
 * - 权限诊断：生成权限健康报告
 */
@Injectable()
export class PermissionSyncService {
  private readonly logger = new Logger(PermissionSyncService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 同步权限种子到数据库
   *
   * 流程：
   * 1. 读取种子文件中的权限定义
   * 2. 逐个权限检查是否存在
   * 3. 不存在则创建，存在则对比并更新
   * 4. 标记孤儿权限（数据库中存在但种子中不存在）
   *
   * @param seeds 权限种子定义数组
   * @returns 同步结果
   */
  async syncPermissions(seeds: PermissionSeedDefinition[]): Promise<PermissionSyncResult> {
    this.logger.log(`Starting permission sync with ${seeds.length} seeds`);

    const result: PermissionSyncResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      orphans: [],
      details: [],
    };

    // 获取种子编码集合
    const seedCodes = new Set(seeds.map((s) => s.code));

    // 获取数据库中所有权限（不包括菜单绑定的权限）
    const existingPermissions = await this.prisma.permission.findMany({
      where: {
        menuId: null, // 只处理非菜单绑定的权限
      },
      select: {
        permissionId: true,
        code: true,
        name: true,
        resource: true,
        action: true,
        remark: true,
        status: true,
      },
    });

    // 构建现有权限 Map
    const existingMap = new Map(existingPermissions.map((p) => [p.code, p]));

    // 同步每个种子权限
    for (const seed of seeds) {
      try {
        const existing = existingMap.get(seed.code);

        if (!existing) {
          // 创建新权限
          await this.prisma.permission.create({
            data: {
              code: seed.code,
              name: seed.name,
              resource: seed.resource ?? null,
              action: seed.action ?? null,
              remark: seed.remark ?? null,
              status: seed.status ?? '0',
              menuId: null, // 种子权限不绑定菜单
            },
          });

          result.created++;
          result.details.push({
            code: seed.code,
            action: 'created',
            message: `Created permission: ${seed.name}`,
          });

          this.logger.debug(`Created permission: ${seed.code}`);
        } else {
          // 检查是否需要更新
          const needsUpdate =
            existing.name !== seed.name ||
            existing.resource !== (seed.resource ?? null) ||
            existing.action !== (seed.action ?? null) ||
            existing.remark !== (seed.remark ?? null) ||
            existing.status !== (seed.status ?? '0');

          if (needsUpdate) {
            await this.prisma.permission.update({
              where: { permissionId: existing.permissionId },
              data: {
                name: seed.name,
                resource: seed.resource ?? null,
                action: seed.action ?? null,
                remark: seed.remark ?? null,
                status: seed.status ?? '0',
              },
            });

            result.updated++;
            result.details.push({
              code: seed.code,
              action: 'updated',
              message: `Updated permission: ${seed.name}`,
            });

            this.logger.debug(`Updated permission: ${seed.code}`);
          } else {
            result.skipped++;
            result.details.push({
              code: seed.code,
              action: 'skipped',
              message: `No changes for: ${seed.name}`,
            });
          }
        }
      } catch (error: any) {
        this.logger.error(`Failed to sync permission ${seed.code}: ${error.message}`);
        result.details.push({
          code: seed.code,
          action: 'skipped',
          message: `Error: ${error.message}`,
        });
      }
    }

    // 查找孤儿权限（数据库中存在但种子中不存在，且未绑定菜单）
    for (const existing of existingPermissions) {
      if (!seedCodes.has(existing.code)) {
        result.orphans.push({
          code: existing.code,
          name: existing.name,
          menuId: null,
        });
      }
    }

    this.logger.log(
      `Permission sync completed: created=${result.created}, updated=${result.updated}, skipped=${result.skipped}, orphans=${result.orphans.length}`,
    );

    return result;
  }

  /**
   * 权限诊断检查
   *
   * 检查项：
   * 1. 总权限数、启用/停用权限数
   * 2. 未绑定菜单的权限
   * 3. 孤儿权限（没有任何角色使用）
   * 4. 重复编码（理论上不应存在）
   * 5. 无效的菜单绑定（绑定了不存在的菜单）
   *
   * @returns 诊断结果
   */
  async checkPermissions(): Promise<PermissionDiagnosticResult> {
    this.logger.log('Starting permission check');

    // 1. 统计权限数量
    const total = await this.prisma.permission.count();
    const enabled = await this.prisma.permission.count({
      where: { status: '0' },
    });
    const disabled = total - enabled;

    // 2. 查找未绑定菜单的权限
    const unbound = await this.prisma.permission.findMany({
      where: { menuId: null },
      select: { code: true, name: true },
    });

    // 3. 查找孤儿权限（没有任何角色使用）
    const orphans = await this.prisma.permission.findMany({
      where: {
        roles: {
          none: {}, // 没有任何 RolePermission 关联
        },
      },
      select: {
        code: true,
        name: true,
        menuId: true,
      },
    });

    // 4. 查找重复编码（通过分组统计）
    const duplicates = await this.prisma.$queryRaw<Array<{ code: string; count: bigint }>>`
      SELECT code, COUNT(*) as count
      FROM sys_permission
      GROUP BY code
      HAVING COUNT(*) > 1
    `;

    // 5. 查找无效的菜单绑定
    const invalidMenuBindings = await this.prisma.permission.findMany({
      where: {
        menuId: { not: null },
        menu: null, // 菜单不存在
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
      `Permission check completed: total=${total}, enabled=${enabled}, disabled=${disabled}, unbound=${unbound.length}, orphans=${orphans.length}, duplicates=${duplicates.length}, invalidBindings=${invalidMenuBindings.length}`,
    );

    return result;
  }

  /**
   * 清理孤儿权限
   *
   * 删除没有任何角色使用且未绑定菜单的权限
   *
   * @returns 删除的权限数量
   */
  async cleanupOrphanPermissions(): Promise<number> {
    this.logger.log('Starting orphan permission cleanup');

    const result = await this.prisma.permission.deleteMany({
      where: {
        menuId: null, // 未绑定菜单
        roles: {
          none: {}, // 没有任何角色使用
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

    // 查找所有绑定了菜单但菜单不存在的权限
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

    // 批量解除绑定
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
