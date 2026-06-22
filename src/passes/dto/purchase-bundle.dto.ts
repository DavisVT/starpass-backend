import { IsArray, IsNumber, ArrayMinSize, ArrayMaxSize, ArrayUnique } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class PurchaseBundleDto {
  @ApiProperty({
    description: 'Array of tier IDs to purchase passes for',
    type: [Number],
    minItems: 1,
    maxItems: 5,
    example: [1, 2, 3],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one tier ID is required' })
  @ArrayMaxSize(5, { message: 'Maximum of 5 tier IDs allowed per bundle' })
  @ArrayUnique({ message: 'Tier IDs must be unique' })
  @IsNumber({}, { each: true })
  @Type(() => Number)
  tierIds: number[];
}
