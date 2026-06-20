import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PassesService } from './passes.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ListPassesDto } from './dto/list-passes.dto';

@ApiTags('passes')
@Controller('passes')
export class PassesController {
  constructor(private passesService: PassesService) {}

  @Get('check/:fanAddress/tier/:tierId')
  @ApiOperation({ summary: 'Check if a fan has a valid pass for a tier' })
  hasValidPass(
    @Param('fanAddress') fanAddress: string,
    @Param('tierId') tierId: string,
  ) {
    return this.passesService.hasValidPass(fanAddress, tierId).then((valid) => ({ valid }));
  }

  @Get('check/:fanAddress/creator/:creatorAddress')
  @ApiOperation({ summary: 'Check if a fan has any valid pass from a creator' })
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
  getCreatorPassCount(@Param('address') address: string) {
    return this.passesService.getCreatorPassCount(address);
  }

  @Get()
  @ApiOperation({ summary: 'List all passes with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Return paginated list of passes' })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  findAll(@Query() query: ListPassesDto) {
    return this.passesService.findAll(query);
  }
}

