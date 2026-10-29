import type { PrismaService } from '@app/database';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { instanceToPlain, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMenuDto } from './dto/create-menu.dto.js';
import { MenuRouteDto } from './dto/menu-route.dto.js';
import { MenuService } from './menu.service.js';

function menu(menuId: bigint, overrides: Record<string, unknown> = {}) {
  return {
    menuId,
parentId: 0n,
menuName: '菜单',
menuType: 'C',
orderNum: 1,
    path: `menu-${menuId}`,
component: 'system/menu/index',
routeName: null,
    meta: {},
isFrame: '1',
isCache: '0',
visible: '0',
status: '0',
    perms: null,
icon: null,
query: null,
remark: null,
createTime: new Date(),
    ...overrides,
  };
}

const prisma = {
  menu: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
  permission: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  userRole: { findMany: vi.fn() },
  roleMenu: { findMany: vi.fn() },
  $transaction: vi.fn(),
};
const service = new MenuService(prisma as unknown as PrismaService);
const input = {
  parentId: 0n,
menuName: '测试菜单',
menuType: 'C',
orderNum: 1,
  routeName: 'TestMenu',
path: '/test-menu',
component: 'system/menu/index',
};

describe('menu management', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    prisma.$transaction.mockImplementation((callback) => callback(prisma));
    prisma.menu.findMany.mockResolvedValue([]);
    prisma.menu.count.mockResolvedValue(0);
    prisma.menu.findUnique.mockResolvedValue(menu(1n));
    prisma.menu.create.mockImplementation(({ data }) => Promise.resolve(menu(10n, data)));
    prisma.menu.update.mockImplementation(({ data }) => Promise.resolve(menu(1n, data)));
    prisma.permission.findUnique.mockResolvedValue(null);
    prisma.permission.findFirst.mockResolvedValue(null);
  });

  it('creates embedded pages without a Vue component and preserves their metadata', async () => {
    const meta = { iframeSrc: 'https://example.com', activeIcon: 'lucide:house', affixTab: true, badgeType: 'dot' };
    const result = await service.createMenu({ ...input, menuType: 'E', component: undefined, meta } as CreateMenuDto);
    expect(result.meta).toMatchObject(meta);
    expect(result.routeName).toBe('TestMenu');
  });

  it.each([
    { menuType: 'E', meta: { iframeSrc: 'javascript:alert(1)' } },
    { menuType: 'L', meta: { link: 'not-a-url' } },
    { menuType: 'F', path: undefined, component: undefined },
  ])('rejects invalid type-specific fields: %j', async (values) => {
    await expect(service.createMenu({ ...input, ...values } as CreateMenuDto)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.menu.create).not.toHaveBeenCalled();
  });

  it.each([
    { values: { routeName: 'UserList' }, message: '菜单名称已存在' },
    { values: { routeName: 'System' }, message: '菜单名称已存在' },
    { values: { path: '/system/user' }, message: '路由地址 /system/user 已存在' },
    { values: { parentId: 1n, path: 'user' }, message: '路由地址 /system/user 已存在' },
  ])('rejects duplicate menu creation with a public conflict message: $message', async ({ values, message }) => {
    prisma.menu.findMany.mockResolvedValue([
      menu(1n, { menuType: 'M', path: 'system' }),
      menu(2n, { parentId: 1n, path: 'user', routeName: 'UserList' }),
    ]);
    await expect(service.createMenu({ ...input, ...values })).rejects.toMatchObject({
      status: 409,
      response: { statusCode: 409, message },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.menu.create).not.toHaveBeenCalled();
  });

  it('rejects selecting self or a button as parent', async () => {
    await expect(service.updateMenu({ ...input, menuId: 1n, parentId: 1n })).rejects.toBeInstanceOf(BadRequestException);
    prisma.menu.findUnique.mockResolvedValue(menu(2n, { menuType: 'F' }));
    await expect(service.createMenu({ ...input, parentId: 2n })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects converting a parent with children to a button', async () => {
    prisma.menu.count.mockResolvedValue(1);
    await expect(service.updateMenu({
      ...input,
menuId: 1n,
menuType: 'F',
path: undefined,
      component: undefined,
perms: 'system:test:add',
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('synchronizes catalog permissions like the example', async () => {
    await service.createMenu({ ...input, menuType: 'M', perms: 'system:test:list' });
    expect(prisma.permission.create).toHaveBeenCalledWith({ data: expect.objectContaining({ code: 'system:test:list' }) });
  });

  it('rejects moving a catalog when a descendant path would collide', async () => {
    prisma.menu.findMany.mockResolvedValue([
      menu(1n, { menuType: 'M', path: '/old' }),
      menu(2n, { parentId: 1n, path: 'detail' }),
      menu(3n, { path: '/new/detail' }),
    ]);
    await expect(service.updateMenu({ ...input, menuId: 1n, menuType: 'M', path: '/new' })).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.menu.update).not.toHaveBeenCalled();
  });

  it('rejects a nonexistent active menu path', async () => {
    await expect(service.createMenu({ ...input, meta: { activePath: '/missing' } })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('includes ancestors for a role granted only an embedded child', async () => {
    prisma.menu.findMany.mockResolvedValue([
      menu(1n, { menuType: 'M', path: '/system' }),
      menu(2n, { parentId: 1n, menuType: 'E', path: 'docs', meta: { iframeSrc: 'https://example.com' } }),
      menu(3n, { path: '/ungranted' }),
    ]);
    prisma.userRole.findMany.mockResolvedValue([{ roleId: 2n }]);
    prisma.roleMenu.findMany.mockResolvedValue([{ menuId: 2n }]);
    const routes = await service.getUserMenuRoutes(2n, ['common']);
    expect(routes).toHaveLength(1);
    expect(routes[0]?.children?.[0]).toMatchObject({ component: 'IFrameView', path: 'docs' });
  });

  it('drops an enabled child when its parent is disabled', async () => {
    prisma.menu.findMany.mockResolvedValue([menu(2n, { parentId: 1n })]);
    expect(await service.getUserMenuRoutes(1n, ['superadmin'])).toEqual([]);
  });

  it('serializes advanced settings, iframe routes and external links without exposing buttons', async () => {
    prisma.menu.findMany.mockResolvedValue([
      menu(1n, { menuType: 'M', path: 'system' }),
      menu(2n, { parentId: 1n, path: 'user' }),
      menu(3n, { menuType: 'E', path: '/docs', routeName: 'Docs', meta: { iframeSrc: 'https://example.com', affixTab: true, badgeType: 'dot', hideInTab: true, activePath: '/system/user' } }),
      menu(4n, { menuType: 'L', path: null, meta: { link: 'https://example.org' } }),
      menu(5n, { isFrame: '0', path: 'https://legacy.example.com' }),
    ]);
    const routes = await service.getUserMenuRoutes(1n, ['superadmin']);
    const serialized = instanceToPlain(plainToInstance(MenuRouteDto, routes, { excludeExtraneousValues: true }));
    expect(serialized[0].path).toBe('/system');
    expect(serialized[0].children[0].name).toBe('SystemUser');
    expect(serialized[2].meta.link).toBe('https://example.org');
    expect(serialized[1]).toMatchObject({ component: 'IFrameView', name: 'Docs', meta: { affixTab: true, hideInTab: true, badgeType: 'dot', activePath: '/system/user' } });
    expect(serialized[3]).toMatchObject({ path: '/iframe/5', component: 'IFrameView', meta: { iframeSrc: 'https://legacy.example.com' } });
    expect(prisma.menu.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: '0', menuType: { in: ['M', 'C', 'E', 'L'] } } }));
  });

  it('validates nested metadata and accepts E/L types in the HTTP DTO', async () => {
    const dto = plainToInstance(CreateMenuDto, { ...input, parentId: '0', menuType: 'E', meta: { affixTab: 'yes', badgeType: 'invalid' } });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    expect(errors.some((error) => error.property === 'meta' && error.children?.length)).toBe(true);
    const validDto = plainToInstance(CreateMenuDto, { ...input, parentId: '0', menuType: 'E', meta: { affixTab: true, iframeSrc: 'https://example.com' } });
    expect(await validate(validDto, { whitelist: true, forbidNonWhitelisted: true })).toEqual([]);
  });
});
