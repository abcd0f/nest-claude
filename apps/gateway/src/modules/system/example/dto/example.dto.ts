import { PageQueryDto } from '@app/common';
import { PartialType } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Length, MaxLength, Min } from 'class-validator';

/**
 * 创建必填参数
 */
export class CreateUserDto {}

/**
 * 修改参数
 */
export class UpdateUserDto extends PartialType(CreateUserDto) {}

/** 查询参数 */
export class QueryUserDto extends PageQueryDto {}
