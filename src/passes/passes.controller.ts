import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PassesService } from './passes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ListPassesDto } from './dto/list-passes.dto';
import { PurchaseBundleDto } from './dto/purchase-bundle.dto';
import { GiftPassDto } from './dto/gift-pass.dto';

@ApiTags('passes')
@Controller({ path: 'passes', version: '1' })
export class PassesController {
  constructor(private passesService: PassesService) {}

  @Get('check/:fanAddress/tier/:tierId')
  @ApiOperation({ summary: 'Check if a fan has a valid pass for a tier' })
  @ApiResponse({ status: 200, description: 'Return verification result ({ valid: boolean })' })
  hasValidPass(
    @Param('fanAddress') fanAddress: string,
    @Param('tierId') tierId: string,
  ) {
    return this.passesService.hasValidPass(fanAddress, tierId).then((valid) => ({ valid }));
  }

  @Get('check/:fanAddress/creator/:creatorAddress')
  @ApiOperation({ summary: 'Check if a fan has any valid pass from a creator' })
  @ApiResponse({ status: 200, description: 'Return verification result ({ valid: boolean })' })
  hasAnyValidPass(
    @Param('fanAddress') fanAddress: string,
    @Param('creatorAddress') creatorAddress: string,
  ) {
    return this.passesService
      .hasAnyValidPass(fanAddress, creatorAddress)
      .then((valid) => ({ valid }));
  }

  @Get('fan/:address')
  @ApiOperation({ summary: 'Get all passes for a fan' })
  @ApiResponse({ status: 200, description: 'Return list of passes for the fan' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  findByFan(
    @Param('address') address: string,
    @Query('activeOnly') activeOnly?: string,
  ) {
    return this.passesService.findByFan(address, activeOnly === 'true');
  }

  @Get('creator/:address/count')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get pass count for a creator' })
  @ApiResponse({ status: 200, description: 'Return pass count summary ({ total: number, active: number })' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  getCreatorPassCount(@Param('address') address: string) {
    return this.passesService.getCreatorPassCount(address);
  }

  @Get(':id/receipt')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a receipt for a pass purchase' })
  @ApiResponse({ status: 200, description: 'Return pass purchase receipt details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the pass owner can view this receipt' })
  @ApiResponse({ status: 404, description: 'Pass not found' })
  getReceipt(@Param('id') id: string, @Request() req: any) {
    return this.passesService.getReceipt(id, req.user.address);
  }

  @Get(':id/metadata')
  @ApiOperation({ summary: 'Get NFT-style metadata for a pass' })
  @ApiResponse({ status: 200, description: 'Return NFT-compatible metadata' })
  @ApiResponse({ status: 404, description: 'Pass not found' })
  getMetadata(@Param('id') id: string) {
    return this.passesService.getMetadata(id);
  }

  @Get()
  @ApiOperation({ summary: 'List all passes with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated list of passes' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  findAll(@Query() query: ListPassesDto) {
    return this.passesService.findAll(query);
  }

  @Post('bundle')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase multiple passes in a single transaction' })
  @ApiResponse({ status: 201, description: 'All passes created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tier IDs or too many tiers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  purchaseBundle(@Body() dto: PurchaseBundleDto, @Request() req: any) {
    return this.passesService.purchaseBundle(dto.tierIds, req.user.address);
  }

  @Post('gift')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Purchase a pass as a gift for another wallet' })
  @ApiResponse({ status: 201, description: 'Gift pass created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid tier, recipient, or self-gift' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  giftPass(@Body() dto: GiftPassDto, @Request() req: any) {
    return this.passesService.giftPass(
      dto.tierId,
      req.user.address,
      dto.recipientAddress,
    );
  }

  @Post(':id/auto-renew')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable or disable auto-renewal for a pass' })
  @ApiResponse({ status: 200, description: 'Auto-renewal toggled successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the pass owner can toggle auto-renewal' })
  @ApiResponse({ status: 404, description: 'Pass not found' })
  async toggleAutoRenew(
    @Param('id') id: string,
    @Body('enable') enable: boolean,
    @Request() req: any,
  ) {
    return this.passesService.toggleAutoRenew(id, req.user.address, enable);
  }

  @Post(':id/change-tier')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change tier of an active pass with pro-rating' })
  @ApiResponse({ status: 200, description: 'Tier changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only the pass owner can change tiers' })
  @ApiResponse({ status: 404, description: 'Pass or tier not found' })
  async changeTier(
    @Param('id') id: string,
    @Body('newTierId') newTierId: string,
    @Request() req: any,
  ) {
    return this.passesService.changeTier(id, newTierId, req.user.address);
  }
}
