import { andWhere, toDto, toDtoList } from '@app/common';
import { PrismaService } from '@app/database';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateDeptDto } from './dto/create-dept.dto.js';
import { DeptResponseDto } from './dto/dept-response.dto.js';
import { DeptTreeDto } from './dto/dept-tree.dto.js';
import { ListDeptDto } from './dto/list-dept.dto.js';
import { UpdateDeptDto } from './dto/update-dept.dto.js';

/**
 * 部门服务
 *
 * 职责：
 * - 部门 CRUD
 * - 部门树构建
 * - 祖先路径维护
 * - 部门移动检查
 */
@Injectable()
export class DeptService {
  private readonly logger = new Logger(DeptService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 获取部门详情
   * @param deptId 部门 ID（bigint）
   * @returns 部门详情
   */
  async getDeptById(deptId: bigint): Promise<DeptResponseDto> {
    const dept = await this.prisma.dept.findUnique({
      where: { deptId },
    });

    if (!dept) {
      throw new NotFoundException(`部门 ${deptId} 不存在`);
    }

    return toDto(DeptResponseDto, dept);
  }

  /**
   * 创建部门
   * @param dto 创建部门 DTO
   * @returns 创建的部门
   */
  async createDept(dto: CreateDeptDto): Promise<DeptResponseDto> {
    const parentId = dto.parentId;
    const leaderId = dto.leaderId ?? null;

    return await this.prisma.$transaction(
      async (tx) => {
        // 检查父部门存在（非根节点）
        let ancestors = '/';
        if (parentId !== 0n) {
          const parent = await tx.dept.findUnique({ where: { deptId: parentId } });
          if (!parent) {
            throw new BadRequestException(`父部门 ${dto.parentId} 不存在`);
          }
          ancestors = `${parent.ancestors}${parentId}/`;
        }

        // 验证部门名称不重复（在同一父部门下）
        const existing = await tx.dept.findFirst({
          where: {
            parentId,
            deptName: dto.deptName,
          },
        });

        if (existing) {
          throw new BadRequestException(`部门名称 ${dto.deptName} 在此父部门下已存在`);
        }

        // 创建部门
        const dept = await tx.dept.create({
          data: {
            parentId,
            deptName: dto.deptName,
            orderNum: dto.orderNum ?? 0,
            leaderId,
            status: dto.status ?? '0',
            ancestors,
            remark: dto.remark,
          },
        });

        this.logger.log(`Created dept ${dept.deptId}: ${dept.deptName}`);

        return toDto(DeptResponseDto, dept);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 更新部门
   * @param deptId 部门 ID（bigint）
   * @param dto 更新部门 DTO
   * @returns 更新后的部门
   */
  async updateDept(deptId: bigint, dto: UpdateDeptDto): Promise<DeptResponseDto> {
    const parentId = dto.parentId;
    const leaderId = dto.leaderId;

    return await this.prisma.$transaction(
      async (tx) => {
        // 检查部门是否存在
        const existing = await tx.dept.findUnique({ where: { deptId } });
        if (!existing) {
          throw new NotFoundException(`部门 ${deptId} 不存在`);
        }

        // 如果更改父部门，检查合法性
        let ancestors = existing.ancestors;
        if (parentId !== undefined && parentId !== existing.parentId) {
          // 检查父部门不能是当前部门的后代
          if (parentId !== 0n) {
            const parent = await tx.dept.findUnique({ where: { deptId: parentId } });
            if (!parent) {
              throw new BadRequestException(`父部门 ${dto.parentId} 不存在`);
            }

            // 检查循环依赖
            const descendants = await this.getDescendantIds(deptId, tx);
            if (descendants.includes(parentId)) {
              throw new BadRequestException('父部门不能是当前部门的后代，会形成循环');
            }

            ancestors = `${parent.ancestors}${parentId}/`;
          } else {
            ancestors = '/';
          }
        }

        // 更新部门
        const dept = await tx.dept.update({
          where: { deptId },
          data: {
            ...(parentId !== undefined && { parentId }),
            ...(dto.deptName && { deptName: dto.deptName }),
            ...(dto.orderNum !== undefined && { orderNum: dto.orderNum }),
            ...(leaderId !== undefined && { leaderId }),
            ...(dto.status && { status: dto.status }),
            ...(ancestors !== existing.ancestors && { ancestors }),
            updateTime: new Date(),
            remark: dto.remark,
          },
        });

        // 如果父部门或 ID 变化，需要更新所有后代的 ancestors
        if ((parentId !== undefined && parentId !== existing.parentId) || deptId !== existing.deptId) {
          await this.updateDescendantAncestors(deptId, ancestors, tx);
        }

        this.logger.log(`Updated dept ${dept.deptId}: ${dept.deptName}`);

        return toDto(DeptResponseDto, dept);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 删除部门
   * @param deptId 部门 ID（bigint）
   */
  async deleteDept(deptId: bigint): Promise<void> {
    await this.prisma.$transaction(
      async (tx) => {
        const dept = await tx.dept.findUnique({ where: { deptId } });

        if (!dept) {
          throw new NotFoundException(`部门 ${deptId} 不存在`);
        }

        // 检查是否有子部门
        const childCount = await tx.dept.count({
          where: { parentId: deptId },
        });

        if (childCount > 0) {
          throw new BadRequestException(`部门 ${deptId} 存在子部门，无法删除`);
        }

        // 检查是否有用户
        const userCount = await tx.user.count({
          where: { deptId },
        });

        if (userCount > 0) {
          throw new BadRequestException(`部门 ${deptId} 存在用户，无法删除`);
        }

        // 删除部门
        await tx.dept.delete({ where: { deptId } });

        this.logger.log(`Deleted dept ${deptId}`);
      },
      { timeout: 10_000 },
    );
  }

  /**
   * 获取部门列表
   *
   * 部门是树形结构，必须拿到完整层级才能正确渲染，分页会把父节点截断，
   * 因此这里不分页：一次返回全部未删除部门，由前端按 `parentId` 自行组树。
   * `dto` 中只有 `status` 生效，`page` / `pageSize` 不再起作用。
   *
   * @param dto 列表查询 DTO
   * @returns 部门列表（按 `orderNum`、`deptId` 升序）
   */
  async listDepts(dto: ListDeptDto): Promise<DeptResponseDto[]> {
    const where = andWhere(dto.status ? { status: dto.status } : null, { delFlag: '0' });

    const items = await this.prisma.dept.findMany({
      where,
      orderBy: [{ orderNum: 'asc' }, { deptId: 'asc' }],
    });

    return toDtoList(DeptResponseDto, items);
  }

  /**
   * 获取部门树
   *
   * 返回给树形组件用的精简结构（`id/parentId/label/weight/disabled/children`），
   * 与 `listDepts()` 的分工：
   * - `listDepts()` 给表格用，扁平、字段全（含 `createTime` / `leaderId` / `remark`）；
   * - 本方法给树选择器用，字段少、层级已由后端组好。
   *
   * 实现要点：
   * - 一次查全表，在内存里用 Map 建树（O(n)），不按层级递归查库（避免 N+1）；
   * - **不按 `status` 过滤**：停用的部门用 `disabled: true` 标记而不是丢弃，
   *   否则其子树会因为找不到父节点而整枝消失；
   * - 父节点缺失（数据异常）的节点提升到根层，宁可位置不对也不能凭空少数据；
   * - `parentId` 指向自己（脏数据）的节点直接当根节点处理，否则会自引用成环，
   *   序列化阶段直接抛 `Converting circular structure to JSON`。
   *
   * @returns 部门树，同级按 `orderNum`、`deptId` 升序
   */
  async getDeptTree(): Promise<DeptTreeDto[]> {
    const depts = await this.prisma.dept.findMany({
      where: { delFlag: '0' },
      orderBy: [{ orderNum: 'asc' }, { deptId: 'asc' }],
      select: { deptId: true, parentId: true, deptName: true, orderNum: true, status: true },
    });

    // 建树用的中间节点：`id` / `parentId` 保持 BigInt（与库一致），
    // 最后统一交给 `toDtoList()` 做类型转换，不在每个节点上手工 toString。
    type TreeNode = Omit<DeptTreeDto, 'children' | 'id' | 'parentId'> & {
      children: TreeNode[];
      id: bigint;
      parentId: bigint;
    };

    // 用字符串做 Map key：BigInt 直接当 key 虽然能命中，但一旦上游改了字段类型
    // （比如某天 `parentId` 变成 string）匹配会静默失效，统一 toString 更稳。
    const nodeMap = new Map<string, TreeNode>();

    for (const dept of depts) {
      const key = dept.deptId.toString();
      nodeMap.set(key, {
        id: dept.deptId,
        parentId: dept.parentId,
        label: dept.deptName,
        weight: dept.orderNum,
        disabled: dept.status === '1',
        children: [],
      });
    }

    const tree: TreeNode[] = [];

    // Map 保持插入顺序（即 orderNum、deptId 升序），push 顺序天然就是排序结果。
    for (const [key, node] of nodeMap) {
      const parent = nodeMap.get(node.parentId.toString());

      if (parent && parent.id.toString() !== key) {
        parent.children.push(node);
      } else {
        // parentId = 0 的真根节点，以及父节点缺失/自引用的脏数据
        tree.push(node);
      }
    }

    return toDtoList(DeptTreeDto, tree);
  }

  /**
   * 获取部门的所有后代 ID
   */
  private async getDescendantIds(deptId: bigint, tx: any): Promise<bigint[]> {
    const descendants: bigint[] = [];
    const queue = [deptId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await tx.dept.findMany({
        where: { parentId: currentId },
        select: { deptId: true },
      });

      for (const child of children) {
        descendants.push(child.deptId);
        queue.push(child.deptId);
      }
    }

    return descendants;
  }

  /**
   * 更新所有后代的 ancestors 字段
   */
  private async updateDescendantAncestors(
    parentId: bigint,
    newParentAncestors: string,
    tx: any,
  ): Promise<void> {
    const queue = [{ deptId: parentId, ancestorPath: newParentAncestors }];

    while (queue.length > 0) {
      const { deptId, ancestorPath } = queue.shift()!;

      const children = await tx.dept.findMany({
        where: { parentId: deptId },
        select: { deptId: true },
      });

      for (const child of children) {
        const newAncestors = `${ancestorPath}${deptId}/`;
        await tx.dept.update({
          where: { deptId: child.deptId },
          data: { ancestors: newAncestors },
        });
        queue.push({ deptId: child.deptId, ancestorPath: newAncestors });
      }
    }
  }
}
