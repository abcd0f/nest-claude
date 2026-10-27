import { Permission } from '@app/permission';
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common';
import { DeptService } from './dept.service.js';
import { CreateDeptDto } from './dto/create-dept.dto.js';
import { DeptIdParamDto } from './dto/dept-id-param.dto.js';
import { DeptResponseDto } from './dto/dept-response.dto.js';
import { ListDeptDto } from './dto/list-dept.dto.js';
import { UpdateDeptDto } from './dto/update-dept.dto.js';

/**
 * 部门管理控制器
 */
@Controller('system/dept')
export class DeptController {
  constructor(private readonly deptService: DeptService) {}

  /**
   * 获取部门详情
   * GET /system/dept/:deptId
   */
  @Get(':deptId')
  @Permission('system:dept:view')
  async getDeptById(@Param() params: DeptIdParamDto): Promise<DeptResponseDto> {
    return this.deptService.getDeptById(params.deptId);
  }

  /**
   * 创建部门
   * POST /system/dept
   */
  @Post()
  @Permission('system:dept:add')
  async createDept(@Body() dto: CreateDeptDto): Promise<DeptResponseDto> {
    return this.deptService.createDept(dto);
  }

  /**
   * 更新部门
   * PUT /system/dept/:deptId
   */
  @Put(':deptId')
  @Permission('system:dept:edit')
  async updateDept(
    @Param() params: DeptIdParamDto,
    @Body() dto: UpdateDeptDto,
  ): Promise<DeptResponseDto> {
    return this.deptService.updateDept(params.deptId, dto);
  }

  /**
   * 删除部门
   * DELETE /system/dept/:deptId
   */
  @Delete(':deptId')
  @Permission('system:dept:remove')
  async deleteDept(@Param() params: DeptIdParamDto): Promise<void> {
    return this.deptService.deleteDept(params.deptId);
  }

  /**
   * 获取部门列表
   * GET /system/dept?status=0
   */
  @Get()
  @Permission('system:dept:view')
  async listDepts(@Query() dto: ListDeptDto): Promise<DeptResponseDto[]> {
    return this.deptService.listDepts(dto);
  }
}
