import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class BlockFanDto {
  @ApiProperty({ description: 'Stellar address of the fan to block' })
  @IsString()
  @IsNotEmpty()
  fanAddress: string;

  @ApiPropertyOptional({ description: 'Optional reason for blocking' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}
