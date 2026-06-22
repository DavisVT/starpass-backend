import { Test, TestingModule } from '@nestjs/testing';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('CreatorsService scheduling', () => {
  let service: CreatorsService;
  const mockPrisma: any = {
    creator: { findUnique: jest.fn() },
    tier: { findUnique: jest.fn() },
    contentSchedule: { create: jest.fn(), findMany: jest.fn(), updateMany: jest.fn() },
    pass: { findMany: jest.fn() },
  };

  const mockNotifications = { bulkCreateForFans: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationsService, useValue: mockNotifications },
      ],
    }).compile();

    service = module.get(CreatorsService);
    jest.clearAllMocks();
  });

  it('creates a schedule', async () => {
    const ownerUserId = 'user-123';
    const creator = { id: 'creator-1', userId: ownerUserId };
    const tier = { id: 'tier-1', creatorId: creator.id };

    mockPrisma.creator.findUnique.mockResolvedValue(creator);
    mockPrisma.tier.findUnique.mockResolvedValue(tier);
    mockPrisma.contentSchedule.create.mockResolvedValue({ id: 'sched-1' });

    const dto = { tierId: tier.id, contentUrl: 'https://cdn/content.mp4', availableAt: new Date().toISOString() };
    const res = await service.createContentSchedule(ownerUserId, dto);

    expect(mockPrisma.contentSchedule.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ tierId: tier.id }) }));
    expect(res).toEqual({ id: 'sched-1' });
  });

  it('activates due content and notifies fans', async () => {
    const now = new Date();
    const schedule = { id: 'sched-1', tierId: 'tier-1', contentUrl: 'https://x', availableAt: now };

    mockPrisma.contentSchedule.findMany.mockResolvedValue([schedule]);
    mockPrisma.contentSchedule.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.pass.findMany.mockResolvedValue([{ fanId: 'fan-1' }, { fanId: 'fan-2' }]);
    mockNotifications.bulkCreateForFans.mockResolvedValue(undefined);

    const activated = await service.activateDueContent();

    expect(mockPrisma.contentSchedule.findMany).toHaveBeenCalled();
    expect(mockPrisma.contentSchedule.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: schedule.id, active: false } }));
    expect(mockPrisma.pass.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tierId: schedule.tierId }) }));
    expect(mockNotifications.bulkCreateForFans).toHaveBeenCalledWith(['fan-1', 'fan-2'], expect.any(String), expect.any(String), expect.objectContaining({ contentUrl: schedule.contentUrl }));
    expect(activated).toEqual([schedule.id]);
  });
});
