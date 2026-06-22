import { Test, TestingModule } from '@nestjs/testing';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { ListPassesDto } from './dto/list-passes.dto';
import { PurchaseBundleDto } from './dto/purchase-bundle.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('PassesController', () => {
  let controller: PassesController;
  let service: PassesService;

  const mockPassesService = {
    findAll: jest.fn().mockImplementation((query) => Promise.resolve({
      data: [],
      total: 0,
      page: query.page || 1,
      limit: query.limit || 20,
    })),
    hasValidPass: jest.fn(),
    hasAnyValidPass: jest.fn(),
    findByFan: jest.fn(),
    getCreatorPassCount: jest.fn(),
    getReceipt: jest.fn(),
    getMetadata: jest.fn(),
    purchaseBundle: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PassesController],
      providers: [
        {
          provide: PassesService,
          useValue: mockPassesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PassesController>(PassesController);
    service = module.get<PassesService>(PassesService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call PassesService.findAll with queries', async () => {
      const dto: ListPassesDto = {
        fan: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
        tier_id: '550e8400-e29b-41d4-a716-446655440000',
        active: true,
        expired: false,
        page: 2,
        limit: 10,
      };

      const result = await controller.findAll(dto);

      expect(service.findAll).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      });
    });
  });

  describe('getReceipt', () => {
    it('should call PassesService.getReceipt with the pass id and authenticated address', async () => {
      const receipt = { pass: { id: 'pass-uuid' }, txHash: 'hash' };
      mockPassesService.getReceipt.mockResolvedValue(receipt);

      const result = await controller.getReceipt('pass-uuid', {
        user: { address: 'GB_FAN' },
      });

      expect(service.getReceipt).toHaveBeenCalledWith('pass-uuid', 'GB_FAN');
      expect(result).toEqual(receipt);
    });
  });

  describe('getMetadata', () => {
    it('should call PassesService.getMetadata with the pass id', async () => {
      const metadata = {
        name: 'Creator Name - Tier Name Pass',
        description: 'A StarPass for Tier Name tier from Creator Name',
        image: 'https://example.com/avatar.png',
        attributes: [
          { trait_type: 'Tier Name', value: 'Tier Name' },
          { trait_type: 'Creator', value: 'Creator Name' },
          { trait_type: 'Purchased At', value: '2026-01-01T00:00:00.000Z' },
          { trait_type: 'Expires At', value: '2026-12-31T23:59:59.000Z' },
          { trait_type: 'Status', value: 'active' },
        ],
      };
      mockPassesService.getMetadata.mockResolvedValue(metadata);

      const result = await controller.getMetadata('pass-uuid');

      expect(service.getMetadata).toHaveBeenCalledWith('pass-uuid');
      expect(result).toEqual(metadata);
    });
  });

  describe('purchaseBundle', () => {
    it('should call PassesService.purchaseBundle with tier IDs and fan address', async () => {
      const dto: PurchaseBundleDto = { tierIds: [1, 2, 3] };
      const mockPasses = [
        { id: 'pass-1', tierId: 'tier-1' },
        { id: 'pass-2', tierId: 'tier-2' },
        { id: 'pass-3', tierId: 'tier-3' },
      ];
      mockPassesService.purchaseBundle.mockResolvedValue(mockPasses);

      const result = await controller.purchaseBundle(dto, {
        user: { address: 'GB_FAN' },
      });

      expect(service.purchaseBundle).toHaveBeenCalledWith([1, 2, 3], 'GB_FAN');
      expect(result).toEqual(mockPasses);
    });

    it('should handle single tier bundle', async () => {
      const dto: PurchaseBundleDto = { tierIds: [1] };
      const mockPasses = [{ id: 'pass-1', tierId: 'tier-1' }];
      mockPassesService.purchaseBundle.mockResolvedValue(mockPasses);

      const result = await controller.purchaseBundle(dto, {
        user: { address: 'GB_FAN' },
      });

      expect(service.purchaseBundle).toHaveBeenCalledWith([1], 'GB_FAN');
      expect(result).toEqual(mockPasses);
    });

    it('should handle maximum 5 tier bundle', async () => {
      const dto: PurchaseBundleDto = { tierIds: [1, 2, 3, 4, 5] };
      const mockPasses = [
        { id: 'pass-1', tierId: 'tier-1' },
        { id: 'pass-2', tierId: 'tier-2' },
        { id: 'pass-3', tierId: 'tier-3' },
        { id: 'pass-4', tierId: 'tier-4' },
        { id: 'pass-5', tierId: 'tier-5' },
      ];
      mockPassesService.purchaseBundle.mockResolvedValue(mockPasses);

      const result = await controller.purchaseBundle(dto, {
        user: { address: 'GB_FAN' },
      });

      expect(service.purchaseBundle).toHaveBeenCalledWith([1, 2, 3, 4, 5], 'GB_FAN');
      expect(result).toHaveLength(5);
    });
  });
});
