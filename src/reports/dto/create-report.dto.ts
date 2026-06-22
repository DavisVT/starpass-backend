import { IsString, IsNotEmpty, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiProperty({ enum: ['PASS', 'CREATOR', 'TIER'] })
  @IsIn(['PASS', 'CREATOR', 'TIER'])
  targetType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  targetId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;
}
