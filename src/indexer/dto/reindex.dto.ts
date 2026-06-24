import { ApiProperty } from "@nestjs/swagger";
import {
  IsInt,
  Min,
  IsDefined,
  IsNumber,
  IsString,
  IsIn,
  IsOptional,
  IsDateString,
  IsNotEmpty,
} from "class-validator";

export class ReindexDto {
  @ApiProperty({
    description: "Starting ledger sequence number",
    example: 100000,
  })
  @IsInt()
  @Min(1)
  @IsDefined()
  fromLedger: number;

  @ApiProperty({
    description: "Ending ledger sequence number",
    example: 105000,
  })
  @IsInt()
  @Min(1)
  @IsDefined()
  toLedger: number;
}

export class ReplayHistoryDto {
  @ApiProperty({
    description: "Starting timestamp (Unix time in seconds)",
    example: 1710000000,
  })
  @IsNumber()
  @Min(1)
  @IsDefined()
  fromTimestamp: number;

  @ApiProperty({
    description: "Ending timestamp (Unix time in seconds)",
    example: 1720000000,
  })
  @IsNumber()
  @Min(1)
  @IsDefined()
  toTimestamp: number;
}

export class ReindexJobStatusDto {
  @ApiProperty({ description: "Job ID for tracking the reindex operation" })
  @IsString()
  @IsNotEmpty()
  jobId: string;

  @ApiProperty({
    description: "Current status of the job",
    enum: ["pending", "running", "completed", "failed"],
  })
  @IsIn(["pending", "running", "completed", "failed"])
  status: "pending" | "running" | "completed" | "failed";

  @ApiProperty({ description: "Starting ledger of the range", required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  fromLedger?: number;

  @ApiProperty({ description: "Ending ledger of the range", required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  toLedger?: number;

  @ApiProperty({
    description: "Starting timestamp (Unix time in seconds)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  fromTimestamp?: number;

  @ApiProperty({
    description: "Ending timestamp (Unix time in seconds)",
    required: false,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  toTimestamp?: number;

  @ApiProperty({ description: "Number of events processed", required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  eventsProcessed?: number;

  @ApiProperty({ description: "Error message if failed", required: false })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  error?: string;

  @ApiProperty({
    description: "Timestamp when job was created",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  createdAt?: Date;

  @ApiProperty({
    description: "Timestamp when job completed or failed",
    required: false,
  })
  @IsOptional()
  @IsDateString()
  completedAt?: Date;
}
