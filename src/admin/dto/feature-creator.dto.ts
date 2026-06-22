import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FeatureCreatorDto {
  @ApiProperty({ description: 'Display order (lower = higher priority)' })
  @IsInt()
  @Min(0)
  order: number;
}