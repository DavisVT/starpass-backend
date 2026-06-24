import { IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty({ description: "Stellar public key (G...)" })
  @IsString()
  @IsNotEmpty()
  stellarAddress: string;

  @ApiProperty({ description: "Challenge message that was signed" })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiProperty({
    description: "Base64-encoded signature of the challenge message",
  })
  @IsString()
  @IsNotEmpty()
  signature: string;
}
