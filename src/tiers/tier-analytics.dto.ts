import { ApiProperty } from '@nestjs/swagger';

class PurchasesByDayDto {
  @ApiProperty({ example: '2026-06-01' })
  date: string;

  @ApiProperty({ example: 5 })
  count: number;
}

export class TierAnalyticsDto {
  @ApiProperty({ example: 42 })
  totalPurchases: number;

  @ApiProperty({ example: 420.0 })
  totalRevenue: number;

  @ApiProperty({ example: 18 })
  activePasses: number;

  @ApiProperty({ type: [PurchasesByDayDto] })
  purchasesByDay: PurchasesByDayDto[];
}
