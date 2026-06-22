import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsString, MinLength } from 'class-validator';

export class UpdateCreatorCategoriesDto {
  @ApiProperty({ description: 'Category slugs to assign to the creator', example: ['music', 'art'] })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  @MinLength(1, { each: true })
  categories: string[];
}