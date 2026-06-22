import { Controller, Get, Param, ParseIntPipe, Query, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { TiersService } from './tiers.service';

@ApiTags('tiers')
@Controller('tiers')
export class TiersController {
  constructor(private tiersService: TiersService) {}

  @Get()
  @ApiOperation({ summary: 'List tiers with pagination, optionally filtered by creatorId' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page (default: 20, max: 100)' })
  @ApiQuery({ name: 'creatorId', required: false, type: String, description: 'Filter by creator Stellar address' })
  @ApiResponse({ status: 200, description: 'Paginated list of tiers' })
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('creatorId') creatorId?: string,
  ) {
    if (+limit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }
    return this.tiersService.findAll(+page, +limit, creatorId);
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
}
