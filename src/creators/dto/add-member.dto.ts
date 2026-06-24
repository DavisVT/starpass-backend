import { IsIn, IsString, IsNotEmpty } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddMemberDto {
  @ApiProperty({ description: "Stellar address of the member to add" })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ enum: ["OWNER", "EDITOR"], default: "EDITOR" })
  @IsIn(["OWNER", "EDITOR"])
  role: "OWNER" | "EDITOR" = "EDITOR";
}
