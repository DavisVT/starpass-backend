import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { FansService } from './fans.service';

@ApiTags('fans')
@Controller('fans')
export class FansController {
  constructor(private fansService: FansService) {}

  @Get(':address')
  @ApiOperation({ summary: 'Get fan profile by Stellar address' })
  @ApiResponse({ status: 200, description: 'Return fan profile' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  findOne(@Param('address') address: string) {
    return this.fansService.findByAddress(address);
  }

  @Get(':address/subscriptions')
  @ApiOperation({ summary: 'Get active subscriptions for a fan' })
  @ApiResponse({ status: 200, description: 'Return list of active subscriptions' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  getSubscriptions(@Param('address') address: string) {
    return this.fansService.getSubscriptions(address);
  }

  @Get(':address/activity')
  @ApiOperation({ summary: 'Get activity feed for a fan in reverse chronological order' })
  @ApiQuery({ name: 'type', required: false, enum: ['pass_purchased', 'pass_expired'], description: 'Filter by event type' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Return activity events' })
  @ApiResponse({ status: 404, description: 'Fan not found' })
  getActivity(
    @Param('address') address: string,
    @Query('type') type?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.fansService.getActivity(address, type, +page, +limit);
  }
}
