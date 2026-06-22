import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, IsDefined, IsNumber } from 'class-validator';

export class ReindexDto {
  @ApiProperty({ description: 'Starting ledger sequence number', example: 100000 })
  @IsInt()
  @Min(1)
  @IsDefined()
  fromLedger: number;

  @ApiProperty({ description: 'Ending ledger sequence number', example: 105000 })
  @IsInt()
  @Min(1)
  @IsDefined()
  toLedger: number;
}

export class ReplayHistoryDto {
  @ApiProperty({ description: 'Starting timestamp (Unix time in seconds)', example: 1710000000 })
  @IsNumber()
  @Min(1)
  @IsDefined()
  fromTimestamp: number;

  @ApiProperty({ description: 'Ending timestamp (Unix time in seconds)', example: 1720000000 })
  @IsNumber()
  @Min(1)
  @IsDefined()
  toTimestamp: number;
}

export class ReindexJobStatusDto {
  @ApiProperty({ description: 'Job ID for tracking the reindex operation' })
  jobId: string;

  @ApiProperty({ description: 'Current status of the job', enum: ['pending', 'running', 'completed', 'failed'] })
  status: 'pending' | 'running' | 'completed' | 'failed';

  @ApiProperty({ description: 'Starting ledger of the range', required: false })
  fromLedger?: number;

  @ApiProperty({ description: 'Ending ledger of the range', required: false })
  toLedger?: number;

  @ApiProperty({ description: 'Starting timestamp (Unix time in seconds)', required: false })
  fromTimestamp?: number;

  @ApiProperty({ description: 'Ending timestamp (Unix time in seconds)', required: false })
  toTimestamp?: number;

  @ApiProperty({ description: 'Number of events processed', required: false })
  eventsProcessed?: number;

  @ApiProperty({ description: 'Error message if failed', required: false })
  error?: string;

  @ApiProperty({ description: 'Timestamp when job was created', required: false })
  createdAt?: Date;

  @ApiProperty({ description: 'Timestamp when job completed or failed', required: false })
  completedAt?: Date;
}
