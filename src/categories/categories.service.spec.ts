import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from './categories.service';
import { PrismaService } from '../common/prisma.service';

describe('CategoriesService', () => {
  let service: CategoriesService;

  const mockPrismaService = {
    category: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategoriesService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<CategoriesService>(CategoriesService);
    jest.clearAllMocks();
  });

  it('should list categories ordered by name', async () => {
    mockPrismaService.category.findMany.mockResolvedValue([]);

    await service.findAll();

    expect(mockPrismaService.category.findMany).toHaveBeenCalledWith({ orderBy: { name: 'asc' } });
  });
});