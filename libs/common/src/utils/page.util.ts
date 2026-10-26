import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants/pagination.js';
import { PageMetaDto } from '../dto/base.dto.js';

/**
 * 分页查询参数
 */
export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

/**
 * 分页计算结果
 */
export interface PaginationCalc {
  skip: number;
  take: number;
  page: number;
  pageSize: number;
}

/**
 * 计算分页参数
 * @param input 分页输入（可能为空）
 * @returns 分页计算结果
 */
export function paginate(input?: PaginationInput): PaginationCalc {
  const page = Math.max(input?.page ?? DEFAULT_PAGE, 1);
  const pageSize = Math.min(Math.max(input?.pageSize ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);

  return {
    skip: (page - 1) * pageSize,
    take: pageSize,
    page,
    pageSize,
  };
}

/**
 * 构建分页元数据
 * @param page 页码
 * @param pageSize 页大小
 * @param total 总数
 * @returns 分页元数据
 */
export function makePageMeta(page: number, pageSize: number, total: number): PageMetaDto {
  return {
    page,
    pageSize,
    total,
    totalPage: Math.ceil(total / pageSize),
  };
}
