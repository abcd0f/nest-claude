import { Global, Module } from '@nestjs/common';
import { AuditQueryModule } from './audit/audit.module.js';
import { DeptModule } from './dept/dept.module.js';
import { MenuModule } from './menu/menu.module.js';
import { PermissionManagementModule } from './permission/permission-management.module.js';
import { PostModule } from './post/post.module.js';
import { RoleModule } from './role/role.module.js';
import { UserModule } from './user/user.module.js';

@Global()
@Module({
  imports: [
    MenuModule,
    RoleModule,
    UserModule,
    DeptModule,
    PostModule,
    PermissionManagementModule,
    AuditQueryModule,
  ],
})
export class SystemModule {}
