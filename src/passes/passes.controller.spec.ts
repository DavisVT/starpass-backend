import { Test, TestingModule } from '@nestjs/testing';
import { PassesController } from './passes.controller';
import { PassesService } from './passes.service';
import { ListPassesDto } from './dto/list-passes.dto';
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
        fan: 'GABC...',
        tier_id: 'tier-uuid',
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
});
