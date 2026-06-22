import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(q: string) {
    if (q.length < 2) throw new BadRequestException('Query must be at least 2 characters');

    const [creators, tiers] = await Promise.all([
      this.prisma.creator.findMany({
        where: {
          OR: [
            { displayName: { contains: q, mode: 'insensitive' } },
            { bio: { contains: q, mode: 'insensitive' } },
          ],
        },
        orderBy: { verified: 'desc' },
        take: 10,
      }),
      this.prisma.tier.findMany({
        where: {
          active: true,
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),
    ]);

    return { creators, tiers };
  }
}
