import { Expose, Transform, Type } from 'class-transformer';

/**
 * 部门树节点 DTO
 *
 * 面向树形组件（`el-tree` / `vxe-table` 树、`TreeSelect`）的精简结构，
 * 与 `DeptResponseDto` 的区别是**只保留渲染树必需的字段并改成语义化的键名**：
 * `deptName` → `label`、`orderNum` → `weight`、`status` → `disabled`。
 * 前端拿到后可直接作为 `:data` 传入，不必再做字段映射。
 *
 * 层级由后端组好（`children`），不再让前端按 `parentId` 自己拼。
 */
export class DeptTreeDto {
  /**
   * 部门 ID
   *
   * 库中是 BigInt，序列化成十进制字符串。
   * 与 `parentId` **必须同类型**：前端 `listToTree()` 用 `Map.get(node.parentId)`
   * 匹配父节点，一边数字一边字符串会让整棵树拍平成根节点。
   * @example "100"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  id!: string;

  /**
   * 父部门 ID
   *
   * 根节点为 `"0"`（字符串而不是数字 0，理由见 `id`）。
   * @example "0"
   */
  @Expose()
  @Transform(({ value }) => value?.toString(), { toPlainOnly: true })
  parentId!: string;

  /**
   * 节点显示名（对应 `sys_dept.dept_name`）
   * @example "XXX科技"
   */
  @Expose()
  label!: string;

  /**
   * 排序权重（对应 `sys_dept.order_num`，值越小越靠前）
   *
   * 直接透传 `orderNum`，不做取反或重排。
   * @example 0
   */
  @Expose()
  weight!: number;

  /**
   * 是否禁用
   *
   * 取自 `status === '1'`（停用）。停用的部门**只标记不剔除**：
   * 直接过滤掉会让它的子部门失去父节点、整枝从树里消失，
   * 用户看不到自己名下的组织反而更糟。
   * @example false
   */
  @Expose()
  disabled!: boolean;

  /**
   * 子部门
   *
   * 叶子节点返回空数组而不是省略字段，前端树组件不必额外判空。
   */
  @Expose()
  @Type(() => DeptTreeDto)
  children!: DeptTreeDto[];
}
