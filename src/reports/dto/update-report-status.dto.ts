import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReportStatusDto {
  @ApiProperty({ enum: ['PENDING', 'OPEN', 'RESOLVED', 'DISMISSED'] })
  @IsIn(['PENDING', 'OPEN', 'RESOLVED', 'DISMISSED'])
  status: string;
}
