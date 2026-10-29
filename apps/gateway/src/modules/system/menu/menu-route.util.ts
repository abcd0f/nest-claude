import type { MenuModel } from '@app/database/generated/prisma/models/Menu.js';

type RouteSource = Pick<MenuModel, 'menuId' | 'parentId' | 'path' | 'routeName' | 'isFrame' | 'menuType'>;

/** 统一解析历史相对路径和新配置的绝对路径，供路由与唯一性校验使用。 */
export function resolveMenuRouteInfo(menus: RouteSource[]) {
  const byId = new Map(menus.map((menu) => [menu.menuId, menu]));
  const result = new Map<bigint, { path: string; name: string }>();
  const used = new Set(menus.map((menu) => menu.routeName).filter((name): name is string => !!name));
  const visiting = new Set<bigint>();

  function resolve(menu: RouteSource): { path: string; name: string } {
    const cached = result.get(menu.menuId);
    if (cached) return cached;
    if (visiting.has(menu.menuId)) throw new Error('菜单存在父子循环');
    visiting.add(menu.menuId);
    const parent = byId.get(menu.parentId);
    const parentPath = parent ? resolve(parent).path : '';
    const raw = menu.path?.trim() ?? '';
    const path = menu.menuType === 'L'
      ? `/link/${menu.menuId}`
      : menu.isFrame === '0' && /^https?:\/\//i.test(raw)
        ? `/iframe/${menu.menuId}`
        : raw.startsWith('/') ? raw : `${parentPath}/${raw || `menu-${menu.menuId}`}`;
    const base = path.split('/').filter(Boolean).map((segment) => segment.replace(/[^a-z0-9]+(.)?/gi, (_, char: string) => char ? char.toUpperCase() : '')).map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1)).join('') || `Menu${menu.menuId}`;
    let name = menu.routeName || base;
    if (!menu.routeName) {
      while (used.has(name)) name = `${name}${menu.menuId}`;
      used.add(name);
    }
    const info = { path, name };
    result.set(menu.menuId, info);
    visiting.delete(menu.menuId);
    return info;
  }

  menus.forEach(resolve);
  return result;
}
