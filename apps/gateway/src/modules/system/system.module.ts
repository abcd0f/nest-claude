import { Global, Module } from '@nestjs/common';
import { ExampleModule } from './example/example.module.js';
import { MenuModule } from './menu/menu.module.js';
import { RoleModule } from './role/role.module.js';

@Global()
@Module({
  imports: [ExampleModule, MenuModule, RoleModule],
})
export class SystemModule {}
