import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateCreatorDto } from './dto/create-creator.dto';
import { UpdateCreatorDto } from './dto/update-creator.dto';

@Injectable()
export class CreatorsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Find a paginated list of creators.
   * 
   * @param page The page number to retrieve.
   * @param limit The maximum number of creators per page.
   * @returns An object containing the list of creators, total count, page, and limit.
   */
  async findAll(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [creators, total] = await Promise.all([
      this.prisma.creator.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.creator.count(),
    ]);
    return { data: creators, total, page, limit };
  }

  /**
   * Find a creator by their Stellar address.
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @returns The creator record.
   * @throws {NotFoundException} If the creator is not found.
   */
  async findByAddress(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    return creator;
  }

  /**
   * Register a new creator.
   * 
   * @param userId The ID of the user registering as a creator.
   * @param dto The data transfer object containing creator details.
   * @param stellarAddress The Stellar public key of the creator.
   * @returns The newly created creator record.
   */
  async register(userId: string, dto: CreateCreatorDto, stellarAddress: string) {
    return this.prisma.creator.create({
      data: {
        stellarAddress,
        displayName: dto.displayName,
        bio: dto.bio,
        avatarUrl: dto.avatarUrl,
        registeredAt: new Date(),
        user: { connect: { id: userId } },
      },
    });
  }

  /**
   * Update an existing creator's profile.
   * 
   * @param stellarAddress The Stellar public key of the creator to update.
   * @param dto The data transfer object containing updated creator details.
   * @returns The updated creator record.
   * @throws {NotFoundException} If the creator is not found.
   */
  async update(stellarAddress: string, dto: UpdateCreatorDto) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    return this.prisma.creator.update({ where: { id: creator.id }, data: dto });
  }

  /**
   * Calculate the total earnings and pass count for a creator.
   * 
   * @param stellarAddress The Stellar public key of the creator.
   * @returns An object containing the creator's stellar address, total earnings, and pass count.
   * @throws {NotFoundException} If the creator is not found.
   */
  async getEarnings(stellarAddress: string) {
    const creator = await this.prisma.creator.findUnique({ where: { stellarAddress } });
    if (!creator) throw new NotFoundException('Creator not found');
    const passes = await this.prisma.pass.findMany({
      where: { creatorId: creator.id },
      include: { tier: true },
    });
    const total = passes.reduce((sum, p) => sum + Number(p.tier.priceUsdc), 0);
    return { stellarAddress, totalEarnings: total, passCount: passes.length };
  }
}
