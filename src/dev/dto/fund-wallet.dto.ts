import { IsNotEmpty, IsString, Matches } from "class-validator";

export class FundWalletDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: "address must be a valid Stellar public key",
  })
  address: string;
}
