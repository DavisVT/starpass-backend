import { Test, TestingModule } from '@nestjs/testing';
import { PassesResolver } from './passes.resolver';
import { PassesService } from '../../passes/passes.service';

describe('PassesResolver', () => {
  let resolver: PassesResolver;
  let passesService: PassesService;

  const mockPassesService = {
    findById: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PassesResolver,
        { provide: PassesService, useValue: mockPassesService },
      ],
    }).compile();

    resolver = module.get<PassesResolver>(PassesResolver);
    passesService = module.get<PassesService>(PassesService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });

  describe('pass', () => {
    it('should return a pass by id', async () => {
      const pass = { id: 'p1', onChainId: 100, active: true };
      mockPassesService.findById.mockResolvedValue(pass);

      const result = await resolver.getPass('p1');

      expect(result).toEqual(pass);
      expect(passesService.findById).toHaveBeenCalledWith('p1');
    });
  });
});
