import { ApiProperty } from '@nestjs/swagger';

export class CreatorAnalyticsDto {
  @ApiProperty({ type: [{ date: '2026-06-01', count: 120 }] })
  subscriberGrowth: Array<{ date: string; count: number }>;

  @ApiProperty({ description: 'Churn rate as a percentage' })
  churnRate: number;

  @ApiProperty({ description: 'Average duration of passes in days' })
  avgPassDuration: number;

  @ApiProperty({ description: 'Retention rate as a percentage' })
  retentionRate: number;
}
