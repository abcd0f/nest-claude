import { BigIntId } from '@app/common';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * 创建用户 DTO
 */
export class CreateUserDto {
  /**
   * 登录账号
   *
   * 全局唯一，重复时返回 400。最长 64 字符。
   * @example "admin"
   */
  @IsString()
  @MaxLength(64)
  userName!: string;

  /**
   * 用户昵称
   *
   * 展示用名称，最长 100 字符。
   * @example "系统管理员"
   */
  @IsString()
  @MaxLength(100)
  nickName!: string;

  /**
   * 用户邮箱
   *
   * 可选，需符合邮箱格式；不做唯一性校验。
   * @example "admin@example.com"
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * 手机号
   *
   * 可选，按中国大陆号码格式校验；不做唯一性校验。
   * @example "13800138000"
   */
  @IsOptional()
  @IsPhoneNumber('CN')
  phoneNumber?: string;

  /**
   * 性别：0 男、1 女、2 未知
   *
   * 缺省 2（未知），取值约定沿用 RuoYi。
   * @example "0"
   */
  @IsOptional()
  @IsIn(['0', '1', '2'])
  sex?: string;

  /**
   * 登录密码
   *
   * 6~255 字符。**当前实现直接落库、未做哈希**（见 `UserService.createUser`），
   * 安全修复前不要依赖此字段的存储形态。
   */
  @IsString()
  @MinLength(6)
  @MaxLength(255)
  password!: string;

  /**
   * 用户状态：0 启用、1 停用
   *
   * 缺省启用。停用后无法登录，且不参与权限解析。
   * @example "0"
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  /**
   * 所属部门 ID
   *
   * 十进制字符串，可选；不传表示未分配部门。
   * @example "100"
   */
  @IsOptional()
  @BigIntId()
  deptId?: bigint;

  /**
   * 角色 ID 列表
   *
   * 十进制字符串数组，可选；创建时一次性写入 `sys_user_role`。
   * 任一 ID 不存在时整体失败并返回 400。
   * @example ["1","2"]
   */
  @IsOptional()
  @IsArray()
  @BigIntId({ each: true })
  roleIds?: bigint[];

  /**
   * 职位 ID 列表
   *
   * 十进制字符串数组，可选；创建时一次性写入 `sys_user_post`。
   * 任一 ID 不存在时整体失败并返回 400。
   * @example ["1"]
   */
  @IsOptional()
  @IsArray()
  @BigIntId({ each: true })
  postIds?: bigint[];

  /**
   * 备注
   *
   * 最长 500 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
