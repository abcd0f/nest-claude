#!/usr/bin/env tsx
/**
 * 超级管理员初始化脚本
 *
 * 用于创建系统的第一个超级管理员账号
 *
 * 用法：
 *   npm run bootstrap:superadmin
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../apps/gateway/src/app.module';
import { PrismaService } from '@app/database';
import { PasswordHashService } from '@app/crypto';
import { RESERVED_ROLES } from '../libs/permission/src/constants/reserved-roles';

interface SuperAdminConfig {
  username: string;
  password: string;
  realName: string;
  email?: string;
  phone?: string;
}

// 默认超级管理员配置
const DEFAULT_SUPERADMIN: SuperAdminConfig = {
  username: 'admin',
  password: 'Admin@123456',
  realName: '超级管理员',
  email: 'admin@example.com',
};

async function bootstrap() {
  console.log('\n=== Bootstrap Superadmin ===\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  try {
    const prisma = app.get(PrismaService);
    const passwordHash = app.get(PasswordHashService);

    // 检查是否已存在超级管理员角色
    console.log('Checking for superadmin role...');
    let superadminRole = await prisma.role.findUnique({
      where: { roleKey: RESERVED_ROLES.SUPER_ADMIN },
    });

    if (!superadminRole) {
      console.log('Creating superadmin role...');
      superadminRole = await prisma.role.create({
        data: {
          roleKey: RESERVED_ROLES.SUPER_ADMIN,
          roleName: '超级管理员',
          dataScope: '1', // 全部数据权限
          status: '0',
          delFlag: '0',
          remark: '系统内置角色，拥有所有权限',
        },
      });
      console.log(`✅ Superadmin role created (ID: ${superadminRole.roleId})`);
    } else {
      console.log(`✅ Superadmin role exists (ID: ${superadminRole.roleId})`);
    }

    // 检查是否已存在超级管理员用户
    console.log('\nChecking for superadmin user...');
    const existingAdmin = await prisma.user.findFirst({
      where: {
        roles: {
          some: {
            roleId: superadminRole.roleId,
          },
        },
        status: '0',
        delFlag: '0',
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (existingAdmin) {
      console.log(`✅ Active superadmin user already exists: ${existingAdmin.username}`);
      console.log('   No need to create a new one.');
      console.log('\n=== Done ===\n');
      return;
    }

    // 检查用户名是否已被占用
    console.log('\nChecking username availability...');
    const usernameExists = await prisma.user.findUnique({
      where: { username: DEFAULT_SUPERADMIN.username },
    });

    if (usernameExists) {
      console.error(`❌ Username "${DEFAULT_SUPERADMIN.username}" is already taken`);
      console.log('   Please delete or rename the existing user and try again.');
      process.exit(1);
    }

    // 创建超级管理员用户
    console.log('\nCreating superadmin user...');
    const hashedPassword = await passwordHash.hash(DEFAULT_SUPERADMIN.password);

    const admin = await prisma.user.create({
      data: {
        username: DEFAULT_SUPERADMIN.username,
        password: hashedPassword,
        realName: DEFAULT_SUPERADMIN.realName,
        email: DEFAULT_SUPERADMIN.email,
        phone: DEFAULT_SUPERADMIN.phone,
        status: '0',
        delFlag: '0',
        permissionVersion: 0,
        roles: {
          create: {
            roleId: superadminRole.roleId,
          },
        },
      },
    });

    console.log(`✅ Superadmin user created successfully!`);
    console.log('\nCredentials:');
    console.log(`   Username: ${DEFAULT_SUPERADMIN.username}`);
    console.log(`   Password: ${DEFAULT_SUPERADMIN.password}`);
    console.log(`   Real Name: ${DEFAULT_SUPERADMIN.realName}`);
    console.log(`   Email: ${DEFAULT_SUPERADMIN.email || 'N/A'}`);
    console.log(`   User ID: ${admin.userId}`);

    console.log('\n⚠️  IMPORTANT:');
    console.log('   Please change the password after first login!');
    console.log('   The default password is for initial setup only.');

    console.log('\n=== Done ===\n');
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// 运行
bootstrap().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
