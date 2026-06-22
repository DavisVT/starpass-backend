import { Test, TestingModule } from '@nestjs/testing';
import { CreatorsResolver } from './creators.resolver';
import { CreatorsService } from '../../creators/creators.service';

describe('CreatorsResolver', () => {
  let resolver: CreatorsResolver;
  let creatorsService: CreatorsService;

  const mockCreatorsService = {
    findByAddress: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsResolver,
        { provide: CreatorsService, useValue: mockCreatorsService },
      ],
    }).compile();

    resolver = module.get<CreatorsResolver>(CreatorsResolver);
    creatorsService = module.get<CreatorsService>(CreatorsService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('creator', () => {
    it('should return a creator by address', async () => {
      const creator = { id: '1', stellarAddress: 'GABC', displayName: 'Test' };
      mockCreatorsService.findByAddress.mockResolvedValue(creator);

      const result = await resolver.getCreator('GABC');

      expect(result).toEqual(creator);
      expect(creatorsService.findByAddress).toHaveBeenCalledWith('GABC');
    });
  });

  describe('creators', () => {
    it('should return paginated creators with defaults', async () => {
      const result = { data: [], total: 0, page: 1, limit: 20 };
      mockCreatorsService.findAll.mockResolvedValue(result);

      const output = await resolver.getCreators(1, 20);

      expect(output).toEqual(result);
      expect(creatorsService.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('should pass custom page and limit', async () => {
      const result = { data: [], total: 10, page: 2, limit: 5 };
      mockCreatorsService.findAll.mockResolvedValue(result);

      const output = await resolver.getCreators(2, 5);

      expect(output).toEqual(result);
      expect(creatorsService.findAll).toHaveBeenCalledWith(2, 5);
    });
  });
});
