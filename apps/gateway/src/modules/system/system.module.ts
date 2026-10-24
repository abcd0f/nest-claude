import { Global, Module } from '@nestjs/common';
import { ExampleModule } from './example/example.module.js';
import { MenuModule } from './menu/menu.module.js';
import { RoleModule } from './role/role.module.js';
import { UserModule } from './user/user.module.js';
import { DeptModule } from './dept/dept.module.js';
import { PostModule } from './post/post.module.js';

@Global()
@Module({
  imports: [ExampleModule, MenuModule, RoleModule, UserModule, DeptModule, PostModule],
})
export class SystemModule {}
