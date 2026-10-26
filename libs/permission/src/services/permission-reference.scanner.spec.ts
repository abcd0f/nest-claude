import { Controller, Get, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Permission } from '../decorators/permission.decorator.js';
import { PermissionReferenceScanner } from './permission-reference.scanner.js';

@Controller('demo')
class DemoController {
  @Get()
  @Permission('system:user:view')
  list() {
    return [];
  }

  @Get('detail')
  @Permission(['system:user:view', 'system:user:edit'])
  detail() {
    return {};
  }
}

@Controller('plain')
class PlainController {
  @Get()
  hello() {
    return 'ok';
  }
}

@Module({
  imports: [DiscoveryModule],
  controllers: [DemoController, PlainController],
  providers: [PermissionReferenceScanner],
})
class ScannerTestModule {}

describe('permissionReferenceScanner', () => {
  let scanner: PermissionReferenceScanner;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ScannerTestModule],
    }).compile();

    await moduleRef.init();
    scanner = moduleRef.get(PermissionReferenceScanner);
  });

  it('should collect permission codes from @Permission declarations', () => {
    const references = scanner.collect();

    expect([...references.keys()].sort()).toEqual(['system:user:edit', 'system:user:view']);
  });

  it('should record every declaring method as a location', () => {
    const references = scanner.collect();

    expect(references.get('system:user:view')).toEqual([
      'DemoController.list',
      'DemoController.detail',
    ]);
    expect(references.get('system:user:edit')).toEqual(['DemoController.detail']);
  });

  it('should ignore controllers without permission declarations', () => {
    const references = scanner.collect();
    const locations = [...references.values()].flat();

    expect(locations.some((location) => location.startsWith('PlainController'))).toBe(false);
  });
});
