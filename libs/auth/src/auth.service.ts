import type { AuthConfig } from '@app/config';
import type { AccessTokenPayload } from './services/token.service.js';
import { randomUUID } from 'node:crypto';
import { authConfig } from '@app/config';
import { PasswordHashService } from '@app/crypto';
import { PrismaService } from '@app/database';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginResultDto, TokenDto } from './dto/login-result.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenStore } from './services/refresh-token.store.js';
import { SessionStore } from './services/session.store.js';
import { TokenService } from './services/token.service.js';
import { UserPrincipal } from './types/user-principal.type.js';

/**
 * 登出时可提供的令牌
 *
 * access token 优先（能定位到具体会话），缺失或无效时退回 refresh token。
 * 两者都允许已过期 —— 登出接口必须在 access token 过期后依然可用。
 */
export interface LogoutCredentials {
  accessToken?: string;
  refreshToken?: string;
}

/** 超级管理员角色编码，与 @app/permission 的 RESERVED_ROLES 保持一致 */
const SUPER_ADMIN_ROLE_KEY = 'superadmin';

/** 超级管理员通配权限码，前端据此放行全部按钮 */
const SUPER_ADMIN_PERMISSION_CODE = '*:*:*';

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
    private readonly refreshTokenStore: RefreshTokenStore,
    private readonly sessionStore: SessionStore,
    @Inject(authConfig.KEY) private readonly config: AuthConfig,
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

    // 轮换模式下登记该 jti，后续刷新只认这一个；关闭时为空操作
    await this.refreshTokenStore.issue(sessionId, jti);

    // 登记会话，AuthGuard 据此判断 access token 是否仍然有效
    await this.sessionStore.start(sessionId, userId);

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
      accessToken,
      expiresIn: this.tokenService.getAccessTokenExpiresInMs() / 1000,
      refreshToken,
      refreshTokenExpiresIn: this.tokenService.getRefreshTokenExpiresInMs() / 1000,
    };
  }

  /**
   * 刷新访问令牌
   *
   * 流程：
   * 1. 验证 Refresh Token 的有效性
   * 2. 查询用户确保其仍然有效
   * 3. 签发新的 Access Token
   * 4. `auth.refresh-token-rotation` 为 true 时：比对并原子替换会话记录的 jti，
   *    同时返回新的 Refresh Token；旧令牌被重复使用会撤销整个会话
   *
   * @param refreshToken 刷新令牌
   * @returns 新的 Token 信息；轮换开启时包含新的 `refreshToken`
   * @throws UnauthorizedException 如果 Token 无效、过期或已被轮换
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
    const expiresIn = this.tokenService.getAccessTokenExpiresInMs() / 1000;

    // 5. 轮换关闭：沿用旧行为，只换 Access Token，刷新令牌可重复使用
    if (!this.config.refreshTokenRotation) {
      return { accessToken: newAccessToken, expiresIn };
    }

    // 6. 轮换开启：旧 jti 必须与会话记录一致，换发新的刷新令牌
    if (!payload.jti) {
      throw new UnauthorizedException('刷新令牌缺少 jti 声明');
    }

    const nextJti = randomUUID();
    const nextRefreshToken = await this.tokenService.signRefreshToken(
      payload.sub,
      payload.sid,
      nextJti,
    );
    const outcome = await this.refreshTokenStore.rotate(payload.sid, payload.jti, nextJti);

    if (outcome !== 'rotated') {
      // replayed：旧令牌被重复使用，会话已撤销；missing：已过期或已登出
      this.logger.warn(`刷新令牌不可用（${outcome}），sessionId=${payload.sid}`);
      throw new UnauthorizedException('刷新令牌已失效，请重新登录');
    }

    // 会话续期：会话寿命跟随刷新令牌，避免活跃会话被固定 TTL 掐断
    await this.sessionStore.touch(payload.sid);

    return {
      accessToken: newAccessToken,
      expiresIn,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresIn: this.tokenService.getRefreshTokenExpiresInMs() / 1000,
    };
  }

  /**
   * 登出处理
   *
   * 只影响当前会话，其他设备的登录状态不受影响：
   * 1. 撤销刷新令牌记录 —— 手上的 refresh token 立即失效，无法再换 access token
   * 2. 结束会话 —— AuthGuard 下一次请求就判定会话不存在，access token 立即失效
   *
   * 令牌允许已过期：登出接口在 access token 过期后仍必须可用，因此用
   * `decodeExpired*` 验签但跳过 exp 校验，靠 `sid` 定位会话。
   * 两个令牌都拿不到时视为「已经登出」，不做任何事也不报错。
   *
   * @param credentials 客户端能提供的令牌（access 优先，其次 refresh）
   * @returns 用于审计的用户名；无法识别会话时返回 null
   */
  async logout(credentials: LogoutCredentials): Promise<{ username: string } | null> {
    const payload = await this.resolveSessionForLogout(credentials);

    if (!payload) {
      this.logger.warn('登出请求未携带可识别的令牌，按已登出处理');
      return null;
    }

    await this.refreshTokenStore.revoke(payload.sid);
    const sessionExisted = await this.sessionStore.end(payload.sid);

    this.logger.log(
      `User logged out: ${payload.sub}, sessionId=${payload.sid}, sessionExisted=${sessionExisted}`,
    );

    const username = await this.findUsername(payload.sub);
    return username ? { username } : null;
  }

  /** 依次用 access token、refresh token 识别会话；都不可用返回 null */
  private async resolveSessionForLogout(
    credentials: LogoutCredentials,
  ): Promise<AccessTokenPayload | null> {
    if (credentials.accessToken) {
      const payload = await this.tokenService.decodeExpiredAccessToken(credentials.accessToken);
      if (payload?.sid) return payload;
    }

    if (credentials.refreshToken) {
      const payload = await this.tokenService.decodeExpiredRefreshToken(credentials.refreshToken);
      if (payload?.sid) return payload;
    }

    return null;
  }

  /** 查询用户名用于审计；失败返回 null，不影响登出结果 */
  private async findUsername(userId: string): Promise<string | null> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { userId: BigInt(userId) },
        select: { userName: true },
      });
      return user?.userName ?? null;
    } catch {
      return null;
    }
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

    // 加载有效角色（启用且未删除）
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      select: { role: { select: { roleKey: true, status: true, delFlag: true } } },
    });

    const roleKeys = userRoles
      .filter(({ role }) => role.status === '0' && role.delFlag === '0')
      .map(({ role }) => role.roleKey);

    // 加载权限编码；超级管理员固定为通配符，避免逐条查询
    let permissionCodes: Set<string>;
    if (roleKeys.includes(SUPER_ADMIN_ROLE_KEY)) {
      permissionCodes = new Set([SUPER_ADMIN_PERMISSION_CODE]);
    } else if (roleKeys.length === 0) {
      permissionCodes = new Set();
    } else {
      const rolePermissions = await this.prisma.rolePermission.findMany({
        where: {
          role: {
            roleKey: { in: roleKeys },
            status: '0',
            delFlag: '0',
          },
        },
        select: { permission: { select: { code: true, status: true } } },
      });

      permissionCodes = new Set(
        rolePermissions
          .filter(({ permission }) => permission.status === '0')
          .map(({ permission }) => permission.code),
      );
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    return {
      userId: user.userId,
      username: user.userName,
      nickName: user.nickName,
      deptId: user.deptId,
      roleKeys,
      permissionCodes,
      permissionVersion: user.permissionVersion,
      sessionId: '', // 由 AuthGuard 从 JWT 的 sid 声明回填
      status: user.status as '0' | '1',
      delFlag: user.delFlag as '0' | '1',
      issuedAt: nowSeconds,
      expiresAt: nowSeconds + 3600,
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
