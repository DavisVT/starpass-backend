import { IsString, IsNotEmpty, IsISO8601 } from 'class-validator';

export class CreateContentScheduleDto {
  @IsString()
  @IsNotEmpty()
  tierId: string;

  @IsString()
  @IsNotEmpty()
  contentUrl: string;

  @IsISO8601()
  @IsNotEmpty()
  availableAt: string;
}
