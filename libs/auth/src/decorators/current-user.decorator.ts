import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPrincipal } from '../types/user-principal.type.js';

/**
 * @CurrentUser 装饰器
 * 在 Controller 方法中注入当前用户主体信息
 *
 * 用法：
 * @Get()
 * findAll(@CurrentUser() user: UserPrincipal) {
 *   console.log(user.userId);
 *   return this.userService.list(user);
 * }
 *
 * @note 返回的是只读的用户快照，不应直接修改
 * @note 如果用户未认证，返回 undefined（这种情况会被 AuthGuard 提前拦截）
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): UserPrincipal | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as UserPrincipal | undefined;
  },
);
