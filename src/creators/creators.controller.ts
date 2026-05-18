import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [creators, total] = await Promise.all([
      this.prisma.creator.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.creator.count(),
    ]);
    return { creators, total, page, limit };
  }

  async findByAddress(address: string) {
    const creator = await this.prisma.creator.findFirst({ where: { address } });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator;
  }

  async register(userId: string, dto: CreateCreatorDto, address: string) {
    return this.prisma.creator.create({ data: { ...dto, address, userId } });
  }

  async update(address: string, dto: UpdateCreatorDto) {
    const creator = await this.prisma.creator.findFirst({ where: { address } });
    if (!creator) throw new NotFoundException('Creator not found');
    return this.prisma.creator.update({ where: { id: creator.id }, data: dto });
  }

  async getEarnings(address: string) {
    const creator = await this.prisma.creator.findFirst({ where: { address } });
    if (!creator) throw new NotFoundException('Creator not found');
    const passes = await this.prisma.pass.findMany({
      where: { tier: { creatorId: creator.id } },
      include: { tier: true },
    });
    const total = passes.reduce((sum, p) => sum + Number(p.tier.price), 0);
    return { address, totalEarnings: total, passCount: passes.length };
  }
}
