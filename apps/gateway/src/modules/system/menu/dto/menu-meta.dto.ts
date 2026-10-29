import { Expose } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** 可编辑的 Vben 路由扩展配置，输入校验和响应序列化共用。 */
export class MenuMetaDto {
  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  activeIcon?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  activePath?: string;

  @Expose()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  badge?: string;

  @Expose()
  @IsOptional()
  @IsIn(['dot', 'normal'])
  badgeType?: 'dot' | 'normal';

  @Expose()
  @IsOptional()
  @IsIn(['default', 'destructive', 'primary', 'success', 'warning'])
  badgeVariants?: 'default' | 'destructive' | 'primary' | 'success' | 'warning';

  @Expose()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2000)
  iframeSrc?: string;

  @Expose()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true, require_tld: false })
  @MaxLength(2000)
  link?: string;

  @Expose()
  @IsOptional()
  @IsBoolean()
  affixTab?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  hideChildrenInMenu?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  hideInBreadcrumb?: boolean;

  @Expose()
  @IsOptional()
  @IsBoolean()
  hideInTab?: boolean;
}
