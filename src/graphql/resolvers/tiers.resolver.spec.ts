import { Test, TestingModule } from '@nestjs/testing';
import { TiersResolver } from './tiers.resolver';
import { TiersService } from '../../tiers/tiers.service';

describe('TiersResolver', () => {
  let resolver: TiersResolver;
  let tiersService: TiersService;

  const mockTiersService = {
    findOne: jest.fn(),
    findAll: jest.fn(),
    findByCreatorAddressPaginated: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiersResolver,
        { provide: TiersService, useValue: mockTiersService },
      ],
    }).compile();

    resolver = module.get<TiersResolver>(TiersResolver);
    tiersService = module.get<TiersService>(TiersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('tier', () => {
    it('should return a tier by creator address and onChainId', async () => {
      const tier = { id: '1', onChainId: 1, name: 'Gold', creatorId: 'c1' };
      mockTiersService.findOne.mockResolvedValue(tier);

      const result = await resolver.getTier('GABC', 1);

      expect(result).toEqual(tier);
      expect(tiersService.findOne).toHaveBeenCalledWith('GABC', 1);
    });
  });

  describe('tiers', () => {
    it('should return paginated tiers with defaults', async () => {
      const result = { data: [], total: 0, page: 1, limit: 20 };
      mockTiersService.findAll.mockResolvedValue(result);

      const output = await resolver.getTiers(undefined, 1, 20);

      expect(output).toEqual(result);
      expect(tiersService.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('should filter by creator address', async () => {
      const result = { data: [], total: 0, page: 1, limit: 20 };
      mockTiersService.findByCreatorAddressPaginated.mockResolvedValue(result);

      const output = await resolver.getTiers('GABC', 1, 20);

      expect(output).toEqual(result);
      expect(tiersService.findByCreatorAddressPaginated).toHaveBeenCalledWith('GABC', 1, 20);
    });
  });
});
