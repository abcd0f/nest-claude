import type { PermissionMetadata } from '../types/permission-metadata.type.js';
import { Injectable } from '@nestjs/common';
import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { PERMISSION_KEY } from '../decorators/permission.decorator.js';

/**
 * 权限引用扫描器
 *
 * 菜单优先架构下，`@Permission('...')` 里的编码是纯字符串，没有编译期约束。
 * 本扫描器在运行期遍历所有 Controller，收集实际被引用的权限编码及其出现位置，
 * 供诊断接口与数据库中的权限行做差集比对。
 *
 * 用途：
 * - 找出"代码引用了但数据库没有"的编码 → 这类接口对所有非超管用户 403
 * - 找出"数据库有但代码没引用"的编码 → 判断是纯前端按钮权限还是废弃权限
 *
 * 只在诊断时调用，不在请求链路上执行。
 */
@Injectable()
export class PermissionReferenceScanner {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
  ) {}

  /**
   * 收集代码中声明的权限编码
   *
   * @returns 编码到出现位置的映射，位置格式为 `ControllerName.methodName`
   */
  collect(): Map<string, string[]> {
    const references = new Map<string, string[]>();

    const addReference = (code: string, location: string): void => {
      const locations = references.get(code);

      if (!locations) {
        references.set(code, [location]);
        return;
      }

      if (!locations.includes(location)) {
        locations.push(location);
      }
    };

    const addMetadata = (metadata: PermissionMetadata | undefined, location: string): void => {
      if (!metadata?.value) {
        return;
      }

      for (const code of metadata.value) {
        addReference(code, location);
      }
    };

    for (const wrapper of this.discoveryService.getControllers()) {
      const { instance, metatype } = wrapper;

      if (!instance || !metatype) {
        continue;
      }

      const controllerName = metatype.name;

      // 类级声明（作用于该 Controller 下所有未单独声明的路由）
      addMetadata(Reflect.getMetadata(PERMISSION_KEY, metatype), controllerName);

      // 方法级声明（覆盖类级）
      const prototype = Object.getPrototypeOf(instance);

      for (const methodName of this.metadataScanner.getAllMethodNames(prototype)) {
        addMetadata(
          Reflect.getMetadata(PERMISSION_KEY, prototype[methodName]),
          `${controllerName}.${methodName}`,
        );
      }
    }

    return references;
  }
}
