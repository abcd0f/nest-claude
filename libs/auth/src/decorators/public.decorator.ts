import { SetMetadata } from '@nestjs/common';

/**
 * @Public 装饰器
 * 标记路由为公开端点，不需要认证
 *
 * 仅用于极少数端点：
 * - 登录接口
 * - 刷新 Token 接口
 * - 健康检查接口
 * - 必要的密钥协商接口
 *
 * @example
 * @Post('/login')
 * @Public()
 * login(@Body() dto: LoginDto) {
 *   return this.authService.login(dto);
 * }
 */
export const IS_PUBLIC_KEY = Symbol('isPublic');

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
