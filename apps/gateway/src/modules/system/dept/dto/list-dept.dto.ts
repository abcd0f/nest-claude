import { ListWithStatusDto } from '@app/common';

/**
 * 部门列表查询 DTO
 *
 * 继承 `ListWithStatusDto`，但**只有 `status`（0 启用 / 1 停用）生效**。
 *
 * `GET /system/dept/list` 返回 `DeptResponseDto[]`（不分页）：部门是树形结构，
 * 分页会截断父节点导致前端无法组树，因此 `page` / `pageSize` 仍可传入但会被忽略，
 * 保留继承只为兼容老调用方，避免多余查询参数触发 400。
 */
export class ListDeptDto extends ListWithStatusDto {}
