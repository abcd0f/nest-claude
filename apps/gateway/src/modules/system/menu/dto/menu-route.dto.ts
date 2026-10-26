import { Expose, Type } from 'class-transformer';

/**
 * 前端路由 meta 元信息
 *
 * 对应 vben `RouteMeta`（`packages/@core/base/typings/src/vue-router.d.ts`），
 * 字段名必须与前端完全一致 —— 前端拿到响应后不做任何字段映射，直接交给 vue-router。
 *
 * 注意：这里**不返回** `authority`。后端路由模式下菜单已按角色过滤完毕，
 * 再返回 `authority` 只会让前端重复判断，且角色键与菜单权限是两套概念。
 */
export class MenuRouteMetaDto {
  /**
   * 菜单标题
   *
   * 取 `sys_menu.menu_name`，前端侧边栏、面包屑、标签页都显示这个值。
   * @example "用户管理"
   */
  @Expose()
  title!: string;

  /**
   * 菜单图标
   *
   * 取 `sys_menu.icon`，未配置时不返回该字段。
   * @example "users"
   */
  @Expose()
  icon?: string;

  /**
   * 排序值
   *
   * 取 `sys_menu.order_num`，前端按升序排列同级菜单。
   * @example 3
   */
  @Expose()
  order?: number;

  /**
   * 是否在侧边栏隐藏
   *
   * `sys_menu.visible = '1'`（隐藏）时为 `true`。
   * 隐藏只影响侧边栏展示，路由本身仍会注册，可直接通过地址访问。
   * @example false
   */
  @Expose()
  hideInMenu?: boolean;

  /**
   * 是否开启 KeepAlive 缓存
   *
   * `sys_menu.is_cache = '0'`（缓存）时为 `true`。
   * 仅对 C 类型（菜单）返回，目录与按钮不返回该字段。
   * @example true
   */
  @Expose()
  keepAlive?: boolean;

  /**
   * 内嵌 iframe 地址
   *
   * 仅外链菜单（`sys_menu.is_frame = '0'` 且 path 为 http/https 地址）返回，
   * 值为 `sys_menu.path` 原文。前端 `IFrameView` 直接读这个字段。
   * @example "https://www.vben.pro"
   */
  @Expose()
  iframeSrc?: string;

  /**
   * 路由查询参数
   *
   * 由 `sys_menu.query` 的 JSON 字符串解析而来（如 `{"id":"1"}`）。
   * 解析失败时不返回该字段，不影响路由生成。
   * @example {"id":"1"}
   */
  @Expose()
  query?: Record<string, string>;
}

/**
 * 前端路由记录（vben 后端路由模式）
 *
 * 对应前端 `RouteRecordStringComponent`：`component` 是**字符串**而非组件对象，
 * 前端用它在 `layoutMap` / `pageMap` 里查真实组件：
 * - `BasicLayout` → 基础布局（目录 M 使用）
 * - `IFrameView`  → iframe 容器（外链菜单使用）
 * - `system/user/index` → `apps/web-ele/src/views/system/user/index.vue`
 *
 * 注意：`name` 必须全局唯一。前端 `generateMenus` 用 `name` 反查真实路由路径
 * （`router.getRoutes()` 的 name→path 映射），重名会导致菜单点击跳错页面。
 */
export class MenuRouteDto {
  /**
   * 路由名称
   *
   * 由绝对路径推导的 PascalCase 名称，如 `/system/user` → `SystemUser`；
   * 冲突时追加菜单 ID 保证唯一。
   * @example "SystemUser"
   */
  @Expose()
  name!: string;

  /**
   * 路由路径
   *
   * 顶级节点为绝对路径（`/system`），子节点为相对路径（`user`）。
   * 若库中存的是以 `/` 开头的路径，则原样保留（vue-router 允许绝对子路由）。
   * @example "/system"
   */
  @Expose()
  path!: string;

  /**
   * 组件标识
   *
   * 目录 → `BasicLayout`；外链 → `IFrameView`；菜单 → `sys_menu.component`。
   * @example "system/user/index"
   */
  @Expose()
  component!: string;

  /**
   * 重定向地址
   *
   * 有子节点的节点才返回，指向第一个子节点的绝对路径，
   * 避免用户点到目录时落在空白页。
   * @example "/system/user"
   */
  @Expose()
  redirect?: string;

  /**
   * 路由元信息
   */
  @Expose()
  @Type(() => MenuRouteMetaDto)
  meta!: MenuRouteMetaDto;

  /**
   * 子路由
   *
   * 叶子节点不返回该字段（前端 `children` 为空数组/undefined 均可）。
   */
  @Expose()
  @Type(() => MenuRouteDto)
  children?: MenuRouteDto[];
}
