#!/usr/bin/env tsx
/**
 * 权限同步命令
 *
 * 用法：
 *   npm run permission:sync           # 同步权限
 *   npm run permission:check          # 检查权限
 *   npm run permission:cleanup        # 清理孤儿权限
 *   npm run permission:fix            # 修复无效绑定
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/gateway/src/app.module';
import { PermissionSyncService } from '../libs/permission/src/services/permission-sync.service';
import { PERMISSION_SEEDS } from '../libs/permission/src/seeds/permissions.seed';

async function bootstrap() {
  // 创建 NestJS 应用上下文（不启动 HTTP 服务器）
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const syncService = app.get(PermissionSyncService);
    const command = process.argv[2] || 'sync';

    console.log(`\n=== Permission ${command.toUpperCase()} ===\n`);

    switch (command) {
      case 'sync':
        await syncPermissions(syncService);
        break;

      case 'check':
        await checkPermissions(syncService);
        break;

      case 'cleanup':
        await cleanupPermissions(syncService);
        break;

      case 'fix':
        await fixPermissions(syncService);
        break;

      default:
        console.error(`Unknown command: ${command}`);
        console.log('Available commands: sync, check, cleanup, fix');
        process.exit(1);
    }

    console.log('\n=== Done ===\n');
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

/**
 * 同步权限
 */
async function syncPermissions(service: PermissionSyncService) {
  console.log(`Syncing ${PERMISSION_SEEDS.length} permissions...\n`);

  const result = await service.syncPermissions(PERMISSION_SEEDS);

  console.log('Sync Results:');
  console.log(`  ✅ Created:  ${result.created}`);
  console.log(`  🔄 Updated:  ${result.updated}`);
  console.log(`  ⏭️  Skipped:  ${result.skipped}`);
  console.log(`  ⚠️  Orphans:  ${result.orphans.length}`);

  if (result.orphans.length > 0) {
    console.log('\nOrphan Permissions (exist in DB but not in seeds):');
    result.orphans.forEach((orphan) => {
      console.log(`  - ${orphan.code}: ${orphan.name}`);
    });
    console.log('\nRun "npm run permission:cleanup" to remove orphan permissions');
  }

  if (result.details.some((d) => d.action === 'created' || d.action === 'updated')) {
    console.log('\nDetails:');
    result.details
      .filter((d) => d.action === 'created' || d.action === 'updated')
      .forEach((detail) => {
        const icon = detail.action === 'created' ? '✅' : '🔄';
        console.log(`  ${icon} ${detail.message}`);
      });
  }
}

/**
 * 检查权限
 */
async function checkPermissions(service: PermissionSyncService) {
  console.log('Checking permissions...\n');

  const result = await service.checkPermissions();

  console.log('Permission Statistics:');
  console.log(`  Total:     ${result.total}`);
  console.log(`  Enabled:   ${result.enabled}`);
  console.log(`  Disabled:  ${result.disabled}`);

  console.log('\nPermission Health:');
  console.log(`  Unbound (no menu):      ${result.unbound.length}`);
  console.log(`  Orphans (no role):      ${result.orphans.length}`);
  console.log(`  Duplicates:             ${result.duplicates.length}`);
  console.log(`  Invalid Menu Bindings:  ${result.invalidMenuBindings.length}`);

  if (result.unbound.length > 0) {
    console.log('\nUnbound Permissions (not linked to any menu):');
    result.unbound.slice(0, 10).forEach((p) => {
      console.log(`  - ${p.code}: ${p.name}`);
    });
    if (result.unbound.length > 10) {
      console.log(`  ... and ${result.unbound.length - 10} more`);
    }
  }

  if (result.orphans.length > 0) {
    console.log('\nOrphan Permissions (not assigned to any role):');
    result.orphans.slice(0, 10).forEach((p) => {
      console.log(`  - ${p.code}: ${p.name} ${p.menuId ? `(menu: ${p.menuId})` : ''}`);
    });
    if (result.orphans.length > 10) {
      console.log(`  ... and ${result.orphans.length - 10} more`);
    }
    console.log('\nRun "npm run permission:cleanup" to remove orphan permissions');
  }

  if (result.duplicates.length > 0) {
    console.log('\n⚠️  Duplicate Permission Codes (should not exist):');
    result.duplicates.forEach((d) => {
      console.log(`  - ${d.code}: ${d.count} occurrences`);
    });
  }

  if (result.invalidMenuBindings.length > 0) {
    console.log('\n⚠️  Invalid Menu Bindings:');
    result.invalidMenuBindings.forEach((p) => {
      console.log(`  - ${p.code}: ${p.name} (menu ${p.menuId} not found)`);
    });
    console.log('\nRun "npm run permission:fix" to fix invalid bindings');
  }
}

/**
 * 清理孤儿权限
 */
async function cleanupPermissions(service: PermissionSyncService) {
  console.log('Cleaning up orphan permissions...\n');

  // 先检查有多少孤儿权限
  const checkResult = await service.checkPermissions();

  if (checkResult.orphans.length === 0) {
    console.log('No orphan permissions found. Nothing to clean up.');
    return;
  }

  console.log(`Found ${checkResult.orphans.length} orphan permissions:`);
  checkResult.orphans.forEach((p) => {
    console.log(`  - ${p.code}: ${p.name}`);
  });

  console.log('\nCleaning up...');
  const count = await service.cleanupOrphanPermissions();

  console.log(`✅ Successfully cleaned up ${count} orphan permissions`);
}

/**
 * 修复无效绑定
 */
async function fixPermissions(service: PermissionSyncService) {
  console.log('Fixing invalid menu bindings...\n');

  // 先检查有多少无效绑定
  const checkResult = await service.checkPermissions();

  if (checkResult.invalidMenuBindings.length === 0) {
    console.log('No invalid menu bindings found. Nothing to fix.');
    return;
  }

  console.log(`Found ${checkResult.invalidMenuBindings.length} invalid menu bindings:`);
  checkResult.invalidMenuBindings.forEach((p) => {
    console.log(`  - ${p.code}: ${p.name} (menu ${p.menuId})`);
  });

  console.log('\nFixing...');
  const count = await service.fixInvalidMenuBindings();

  console.log(`✅ Successfully fixed ${count} invalid menu bindings`);
}

// 运行
bootstrap().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
