import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTierContentDto {
  @ApiProperty({ description: 'Plaintext content URL or content to encrypt' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Optional encrypted content URL (if already encrypted)' })
  @IsString()
  @IsOptional()
  encryptedContentUrl?: string;
}
