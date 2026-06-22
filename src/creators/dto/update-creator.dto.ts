import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCreatorDto {
  @ApiPropertyOptional({ description: 'Updated display name shown to fans', example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Updated creator bio', example: 'A digital artist making illustrations.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'Updated avatar image URL', example: 'https://example.com/avatar.png' })
  @IsString()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Twitter/X profile URL', example: 'https://twitter.com/username' })
  @IsString()
  @IsOptional()
  @IsUrl()
  twitterUrl?: string;

  @ApiPropertyOptional({ description: 'Instagram profile URL', example: 'https://instagram.com/username' })
  @IsString()
  @IsOptional()
  @IsUrl()
  instagramUrl?: string;

  @ApiPropertyOptional({ description: 'Personal or project website URL', example: 'https://mysite.com' })
  @IsString()
  @IsOptional()
  @IsUrl()
  websiteUrl?: string;
}
