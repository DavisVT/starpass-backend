import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TiersService } from './tiers.service';
import { BulkCreateTiersDto } from './dto/bulk-create-tiers.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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

  @Post('creator/:address/bulk')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bulk create up to 10 tiers for a creator (atomic)' })
  @ApiResponse({ status: 201, description: 'All tiers created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or exceeds 10-tier limit' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Creator not found' })
  bulkCreate(
    @Param('address') address: string,
    @Body() dto: BulkCreateTiersDto,
    @Request() req: any,
  ) {
    return this.tiersService.bulkCreate(address, dto.tiers, req.user.address);
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
