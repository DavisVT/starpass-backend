import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBadRequestResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { IndexerService } from './indexer.service';
import { AdminApiKeyGuard } from '../admin/admin-api-key.guard';
import { ReindexDto, ReindexJobStatusDto, ReplayHistoryDto } from './dto/reindex.dto';

@ApiTags('indexer')
@ApiSecurity('x-admin-api-key')
@UseGuards(AdminApiKeyGuard)
@Controller('indexer')
export class IndexerController {
  constructor(private readonly indexerService: IndexerService) {}

  @Post('reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a reindex job for a specific ledger range (admin only)' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Reindex job started successfully',
    type: Object,
  })
  @ApiBadRequestResponse({ description: 'Invalid ledger range or exceeds 10,000 limit' })
  @ApiForbiddenResponse({ description: 'Invalid or missing admin API key' })
  async startReindex(
    @Body() dto: ReindexDto,
  ): Promise<{ jobId: string; status: string; message: string }> {
    const result = await this.indexerService.startReindex(dto);
    return {
      jobId: result.jobId,
      status: 'pending',
      message: 'Reindex job started successfully',
    };
  }

  @Post('replay-history')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Start a replay-history job for a specific timestamp range (admin only)' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Replay-history job started successfully',
    type: Object,
  })
  @ApiBadRequestResponse({ description: 'Invalid timestamp range or exceeds 30 days limit' })
  @ApiForbiddenResponse({ description: 'Invalid or missing admin API key' })
  async startReplayHistory(
    @Body() dto: ReplayHistoryDto,
  ): Promise<{ jobId: string; status: string; message: string }> {
    const result = await this.indexerService.startReplayHistory(dto);
    return {
      jobId: result.jobId,
      status: 'pending',
      message: 'Replay-history job started successfully',
    };
  }

  @Get('reindex/:jobId')
  @ApiOperation({ summary: 'Get the status of a reindex or replay-history job (admin only)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job status retrieved successfully',
    type: ReindexJobStatusDto,
  })
  @ApiBadRequestResponse({ description: 'Job not found' })
  @ApiForbiddenResponse({ description: 'Invalid or missing admin API key' })
  async getReindexStatus(@Param('jobId') jobId: string): Promise<ReindexJobStatusDto> {
    return this.indexerService.getReindexJobStatus(jobId);
  }
}
