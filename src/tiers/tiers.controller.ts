import { Controller, Get, Post, Param, ParseIntPipe, UseGuards, Request, UseInterceptors, Query, BadRequestException, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { TiersService } from './tiers.service';
import { TierAnalyticsDto } from './tier-analytics.dto';
import { CreateTierContentDto } from './dto/create-tier-content.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { XCacheInterceptor } from '../common/cache/cache.interceptor';

@ApiTags('tiers')
@Controller({ path: 'tiers', version: '1' })
export class TiersController {
  constructor(private tiersService: TiersService) {}

  @Get(':id/prices')
  @ApiOperation({ summary: 'List all prices for a tier' })
  @ApiResponse({ status: 200, description: 'Return list of tier prices' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  getPrices(@Param('id') id: string) {
    return this.tiersService.getTierPrices(id);
  }

  @Get(':id/analytics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get tier purchase analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['7d', '30d', '90d'] })
  @ApiResponse({ status: 200, type: TierAnalyticsDto, description: 'Return tier analytics' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  getAnalytics(@Param('id') id: string, @Query('period') period = '30d', @Request() req: any) {
    return this.tiersService.getAnalytics(id, req.user?.sub, period);
  }

  @Get()
  @UseInterceptors(XCacheInterceptor)
  @CacheTTL(120)
  @ApiOperation({ summary: 'List tiers with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'creatorId', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Return paginated list of tiers' })
  @ApiResponse({ status: 400, description: 'Invalid pagination parameters' })
  findAll(
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('creatorId') creatorId?: string,
  ) {
    const pageNumber = Number(page);
    const limitNumber = Number(limit);

    if (!Number.isInteger(pageNumber) || pageNumber < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }

    if (!Number.isInteger(limitNumber) || limitNumber < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    if (limitNumber > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    return this.tiersService.findAll(pageNumber, limitNumber, creatorId);
  }

  @Get('creator/:address')
  @ApiOperation({ summary: 'Get all active tiers for a creator' })
  @ApiResponse({ status: 200, description: 'Return active tiers for the creator' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  findByCreator(@Param('address') address: string) {
    return this.tiersService.findByCreator(address);
  }

  @Get('creator/:address/:onChainId')
  @ApiOperation({ summary: 'Get a specific tier by on-chain ID' })
  @ApiResponse({ status: 200, description: 'Return tier profile' })
  @ApiResponse({ status: 404, description: 'Creator or tier not found' })
  findOne(
    @Param('address') address: string,
    @Param('onChainId', ParseIntPipe) onChainId: number,
  ) {
    return this.tiersService.findOne(address, onChainId);
  }

  @Post(':id/content/unlock')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlock content for a pass holder — returns a signed temporary URL token' })
  @ApiResponse({ status: 201, description: 'Content unlock token issued' })
  @ApiResponse({ status: 403, description: 'No valid pass for this tier' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  unlock(@Param('id') id: string, @Request() req: any) {
    return this.tiersService.unlockContent(id, req.user.address);
  }

  @Get(':id/content/verify')
  @ApiOperation({ summary: 'Verify a content unlock token' })
  @ApiQuery({ name: 'token', required: true })
  @ApiResponse({ status: 200, description: 'Token validity result' })
  verify(@Param('id') id: string, @Query('token') token: string) {
    return this.tiersService.verifyContentToken(id, token);
  }

  @Post(':id/content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create encrypted content for a tier' })
  @ApiResponse({ status: 201, description: 'Content created' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  createContent(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: CreateTierContentDto,
  ) {
    return this.tiersService.createTierContent(id, req.user.address, dto);
  }

  @Get(':id/content/key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get fan-encrypted content key for a tier' })
  @ApiResponse({ status: 200, description: 'Encrypted key returned' })
  @ApiResponse({ status: 403, description: 'No valid pass' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  getContentKey(@Param('id') id: string, @Request() req: any) {
    return this.tiersService.getFanEncryptedContentKey(id, req.user.address);
  }

  @Post(':id/content/rotate-key')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Rotate tier content key' })
  @ApiResponse({ status: 200, description: 'Key rotated' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Tier not found' })
  rotateKey(@Param('id') id: string, @Request() req: any) {
    return this.tiersService.rotateTierContentKey(id, req.user.address);
  }
}
