import { IsString, IsNotEmpty, IsISO8601, IsUrl } from "class-validator";

export class CreateContentScheduleDto {
  @IsString()
  @IsNotEmpty()
  tierId: string;

  @IsUrl()
  @IsNotEmpty()
  contentUrl: string;

  @IsISO8601()
  @IsNotEmpty()
  availableAt: string;
}
