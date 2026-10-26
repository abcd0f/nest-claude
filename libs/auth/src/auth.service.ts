import { randomUUID } from 'node:crypto';
import { PasswordHashService } from '@app/crypto';
import { PrismaService } from '@app/database';
import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { LoginResultDto, TokenDto } from './dto/login-result.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { TokenService } from './services/token.service.js';
import { UserPrincipal } from './types/user-principal.type.js';

/**
 * 认证服务
 * 负责登录、Token 签发、Token 刷新、登出和会话管理
 *
 * 职责：
 * - 用户身份验证
 * - 登录流程编排
 * - Token 签发和刷新
 * - 会话管理
 * - 审计日志记录
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordHashService: PasswordHashService,
    private readonly tokenService: TokenService,
  ) {}

  /**
   * 登录处理
   *
   * 流程：
   * 1. 校验登录 DTO
   * 2. 查询用户并验证密码
   * 3. 检查用户状态（启用、未删除）
   * 4. 创建会话
   * 5. 签发 Access 和 Refresh Token
   * 6. 更新登录信息（IP、时间）
   * 7. 记录登录审计
   *
   * @param dto 登录请求 DTO（用户名、密码）
   * @param clientIp 客户端 IP，可选
   * @returns 登录结果，包含 Token 和用户基础信息
   * @throws BadRequestException 用户名或密码错误
   * @throws UnauthorizedException 用户被停用或已删除
   *
   * @example
   * const result = await authService.login(
   *   { username: 'admin', password: 'password123' },
   *   '192.168.1.1'
   * );
   * // result.token.accessToken 用于后续请求
   */
  async login(dto: LoginDto, clientIp?: string): Promise<LoginResultDto> {
    // 1. 查询用户
    // 注意：sys_user.user_name 当前没有唯一约束，因此只能用 findFirst
    const user = await this.prisma.user.findFirst({
      where: { userName: dto.username },
      select: {
        userId: true,
        userName: true,
        password: true,
        nickName: true,
        status: true,
        delFlag: true,
      },
    });

    // 执行恒定时间的密码验证，防止时序攻击
    // 如果用户不存在，使用 dummy hash
    let passwordValid = false;
    if (user) {
      passwordValid = await this.passwordHashService.verifyPassword(user.password, dto.password);
    } else {
      // Dummy hash：防止通过登录时间差异来枚举用户
      await this.passwordHashService.verifyPassword(
        '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        dto.password,
      );
    }

    // 2. 验证密码
    if (!user || !passwordValid) {
      // 不区分"用户不存在"和"密码错误"，防止用户枚举
      this.logger.warn(`Failed login attempt for username: ${dto.username}`);
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 3. 检查用户状态
    if (user.status !== '0') {
      this.logger.warn(`Login attempt for disabled user: ${user.userId}`);
      throw new BadRequestException('账户已被停用');
    }

    if (user.delFlag !== '0') {
      this.logger.warn(`Login attempt for deleted user: ${user.userId}`);
      throw new BadRequestException('账户已被删除');
    }

    // 4. 创建会话和签发 Token
    const sessionId = randomUUID();
    const jti = randomUUID();
    const userId = user.userId.toString();

    const accessToken = await this.tokenService.signAccessToken(userId, sessionId, jti);
    const refreshToken = await this.tokenService.signRefreshToken(userId, sessionId, jti);

    // 5. 更新用户登录信息
    await this.prisma.user.update({
      where: { userId: user.userId },
      data: {
        loginIp: clientIp || null,
        loginDate: new Date(),
      },
    });

    // 6. 记录登录审计（可选，取决于是否有 audit 模块）
    this.logger.log(`User logged in: ${user.userId} from IP: ${clientIp || 'unknown'}`);

    return {
      token: {
        accessToken,
        expiresIn: this.tokenService.getAccessTokenExpiresInMs() / 1000,
        refreshToken,
        refreshTokenExpiresIn: this.tokenService.getRefreshTokenExpiresInMs() / 1000,
        tokenType: 'Bearer',
      },
      userId,
      username: user.userName,
      realName: user.nickName,
    };
  }

  /**
   * 刷新访问令牌
   *
   * 流程：
   * 1. 验证 Refresh Token 的有效性
   * 2. 查询用户确保其仍然有效
   * 3. 签发新的 Access Token（可选：新的 Refresh Token）
   * 4. 可选：旧 Token 黑名单或记录（防重放）
   *
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息
   * @throws UnauthorizedException 如果 Token 无效或过期
   * @throws BadRequestException 如果用户被停用或删除
   *
   * @example
   * const newToken = await authService.refreshToken(oldRefreshToken);
   */
  async refreshToken(refreshToken: string): Promise<TokenDto> {
    // 1. 验证 Refresh Token
    let payload;
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      this.logger.warn('Failed to verify refresh token');
      throw new UnauthorizedException('刷新令牌无效或已过期');
    }

    // 2. 查询用户
    const userId = BigInt(payload.sub);
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        status: true,
        delFlag: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 3. 检查用户状态
    if (user.status !== '0' || user.delFlag !== '0') {
      throw new BadRequestException('用户已被停用或删除');
    }

    // 4. 签发新的 Access Token（保持原会话 ID）
    const newAccessToken = await this.tokenService.signAccessToken(payload.sub, payload.sid);

    return {
      accessToken: newAccessToken,
      expiresIn: this.tokenService.getAccessTokenExpiresInMs() / 1000,
      tokenType: 'Bearer',
    };
  }

  /**
   * 登出处理
   *
   * 目前简化实现：仅记录日志
   * 完整实现应包括：
   * - Token 黑名单或会话撤销
   * - 跨设备登出
   * - 审计日志
   *
   * @param userId 用户 ID（字符串或 BigInt）
   * @param sessionId 会话 ID
   *
   * @example
   * await authService.logout('123', 'session-456');
   */
  async logout(userId: bigint | string, sessionId: string): Promise<void> {
    this.logger.log(`User logged out: ${userId}, sessionId: ${sessionId}`);
    // TODO: 实现会话撤销或 Token 黑名单
  }

  /**
   * 获取当前用户主体信息
   *
   * 从数据库加载用户的完整信息，包括角色和权限
   * 用于 AuthGuard 中建立请求上下文
   *
   * @param userId 用户 ID（BigInt）
   * @returns 用户主体信息，如果用户不存在返回 null
   *
   * @note 返回的是只读快照，不应用于修改
   * @note 调用方应检查用户状态和有效性
   *
   * @example
   * const principal = await authService.getCurrentUser(BigInt(123));
   * if (principal && isUserValid(principal)) {
   *   // 用户有效，可以继续处理请求
   * }
   */
  async getCurrentUser(userId: bigint): Promise<UserPrincipal | null> {
    const user = await this.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        userName: true,
        nickName: true,
        deptId: true,
        status: true,
        delFlag: true,
        permissionVersion: true,
      },
    });

    if (!user) {
      return null;
    }

    // TODO: 从数据库查询角色和权限
    // 目前返回空值，待权限模块实现
    const roleKeys: string[] = [];
    const permissionCodes = new Set<string>();

    return {
      userId: user.userId,
      username: user.userName,
      realName: user.nickName,
      deptId: user.deptId,
      roleKeys,
      permissionCodes,
      permissionVersion: user.permissionVersion,
      sessionId: '', // TODO: 从 JWT 中获取
      status: user.status as '0' | '1',
      delFlag: user.delFlag as '0' | '1',
      issuedAt: Math.floor(Date.now() / 1000),
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  /**
   * 验证用户凭证
   *
   * 内部使用，用于登录前的用户验证
   * 不返回密码等敏感信息
   *
   * @param username 用户名
   * @param password 密码（明文）
   * @returns 用户信息（如果验证失败返回 null）
   *
   * @note 此方法应在恒定时间内执行，防止时序攻击
   */
  async validateUser(
    username: string,
    password: string,
  ): Promise<{ userId: bigint; username: string } | null> {
    const user = await this.prisma.user.findFirst({
      where: { userName: username },
      select: {
        userId: true,
        userName: true,
        password: true,
        status: true,
        delFlag: true,
      },
    });

    if (!user) {
      return null;
    }

    const isPasswordValid = await this.passwordHashService.verifyPassword(user.password, password);

    if (!isPasswordValid) {
      return null;
    }

    return {
      userId: user.userId,
      username: user.userName,
    };
  }
}
