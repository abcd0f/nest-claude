import { BigIntId } from '@app/common';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 更新用户 DTO
 *
 * 所有字段均可选，只更新传入的字段；未传字段保持原值。
 * 登录账号 `userName` 与密码不在本 DTO 中，密码变更走「重置密码」接口。
 */
export class UpdateUserDto {
  /**
   * 用户昵称
   *
   * 最长 100 字符。
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nickName?: string;

  /**
   * 用户邮箱
   *
   * 需符合邮箱格式；不做唯一性校验。
   */
  @IsOptional()
  @IsEmail()
  email?: string;

  /**
   * 手机号
   *
   * 按中国大陆号码格式校验；不做唯一性校验。
   */
  @IsOptional()
  @IsPhoneNumber('CN')
  phoneNumber?: string;

  /**
   * 性别：0 男、1 女、2 未知
   */
  @IsOptional()
  @IsIn(['0', '1', '2'])
  sex?: string;

  /**
   * 用户状态：0 启用、1 停用
   *
   * 停用后无法登录，且不参与权限解析。
   */
  @IsOptional()
  @IsIn(['0', '1'])
  status?: string;

  /**
   * 所属部门 ID
   *
   * 十进制字符串。传值即覆盖，无专门的「清空部门」语义。
   */
  @IsOptional()
  @BigIntId()
  deptId?: bigint;

  /**
   * 角色 ID 列表
   *
   * 全量替换语义：**传了**就覆盖原有角色，传空数组等于清空全部角色；
   * **不传**则保持原有角色不变。任一 ID 不存在时整体失败并返回 400。
   */
  @IsOptional()
  @IsArray()
  @BigIntId({ each: true })
  roleIds?: bigint[];

  /**
   * 职位 ID 列表
   *
   * 全量替换语义：**传了**就覆盖原有职位，传空数组等于清空全部职位；
   * **不传**则保持原有职位不变。任一 ID 不存在时整体失败并返回 400。
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
