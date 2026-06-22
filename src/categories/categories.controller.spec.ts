import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  const mockCategoriesService = {
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: CategoriesService, useValue: mockCategoriesService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    jest.clearAllMocks();
  });

  it('should return all categories', async () => {
    mockCategoriesService.findAll.mockResolvedValue([{ slug: 'music' }]);

    await expect(controller.findAll()).resolves.toEqual([{ slug: 'music' }]);
    expect(mockCategoriesService.findAll).toHaveBeenCalled();
  });
});