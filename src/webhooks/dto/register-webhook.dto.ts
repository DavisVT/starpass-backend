import { IsString, IsNotEmpty, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterWebhookDto {
  @ApiProperty({ description: 'Webhook destination URL' })
  @IsUrl()
  @IsNotEmpty()
  url: string;

  @ApiProperty({ description: 'HMAC secret key used to sign the webhook payload' })
  @IsString()
  @IsNotEmpty()
  secret: string;
}
