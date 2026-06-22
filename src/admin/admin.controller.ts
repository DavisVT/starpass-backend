import { Controller, Get, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminApiKeyGuard } from './admin-api-key.guard';
import { FeatureCreatorDto } from './dto/feature-creator.dto';

@ApiTags('admin')
@ApiSecurity('x-admin-api-key')
@UseGuards(AdminApiKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide stats (admin only)' })
  @ApiResponse({ status: 200, description: 'Platform stats' })
  @ApiResponse({ status: 403, description: 'Invalid or missing admin API key' })
  getStats() {
    return this.adminService.getStats();
  }

  @Post('creators/:id/feature')
  @ApiOperation({ summary: 'Feature a creator (admin only)' })
  @ApiResponse({ status: 200, description: 'Creator featured' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  feature(@Param('id') id: string, @Body() dto: FeatureCreatorDto) {
    return this.adminService.featureCreator(id, dto.order);
  }

  @Delete('creators/:id/feature')
  @ApiOperation({ summary: 'Unfeature a creator (admin only)' })
  @ApiResponse({ status: 200, description: 'Creator unfeatured' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  unfeature(@Param('id') id: string) {
    return this.adminService.unfeatureCreator(id);
  }

  @Post('creators/:id/verify')
  @ApiOperation({ summary: 'Verify a creator (admin only)' })
  @ApiResponse({ status: 200, description: 'Creator verified' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  verify(@Param('id') id: string) {
    return this.adminService.verifyCreator(id);
  }

  @Delete('creators/:id/verify')
  @ApiOperation({ summary: 'Unverify a creator (admin only)' })
  @ApiResponse({ status: 200, description: 'Creator unverified' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  unverify(@Param('id') id: string) {
    return this.adminService.unverifyCreator(id);
  }
}
