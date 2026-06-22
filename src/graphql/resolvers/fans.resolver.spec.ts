import { Test, TestingModule } from '@nestjs/testing';
import { FansResolver } from './fans.resolver';
import { FansService } from '../../fans/fans.service';

describe('FansResolver', () => {
  let resolver: FansResolver;
  let fansService: FansService;

  const mockFansService = {
    findByAddress: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FansResolver,
        { provide: FansService, useValue: mockFansService },
      ],
    }).compile();

    resolver = module.get<FansResolver>(FansResolver);
    fansService = module.get<FansService>(FansService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('fan', () => {
    it('should return a fan by address', async () => {
      const fan = { id: 'f1', stellarAddress: 'GXYZ', displayName: 'Fan1' };
      mockFansService.findByAddress.mockResolvedValue(fan);

      const result = await resolver.getFan('GXYZ');

      expect(result).toEqual(fan);
      expect(fansService.findByAddress).toHaveBeenCalledWith('GXYZ');
    });
  });
});
