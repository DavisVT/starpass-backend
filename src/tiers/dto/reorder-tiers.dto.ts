import { IsArray, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class ReorderTiersDto {
  @ApiProperty({
    type: [Number],
    description: 'Tier IDs in desired display order (index 0 = sortOrder 0)',
    example: [3, 1, 2],
  })
  @IsArray()
  @IsInt({ each: true })
  @Type(() => Number)
  tierIds: number[];
}
