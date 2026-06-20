import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterWebhookDto } from '../webhooks/dto/register-webhook.dto';

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let creatorsService: CreatorsService;
  let webhooksService: WebhooksService;

  const mockCreatorsService = {
    findAll: jest.fn(),
  };
  const mockWebhooksService = {
    register: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatorsController],
      providers: [
        {
          provide: CreatorsService,
          useValue: mockCreatorsService,
        },
        {
          provide: WebhooksService,
          useValue: mockWebhooksService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CreatorsController>(CreatorsController);
    creatorsService = module.get<CreatorsService>(CreatorsService);
    webhooksService = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 10 };

    it('should use default page=1 and limit=10', async () => {
      mockCreatorsService.findAll.mockResolvedValue(mockResult);
      await controller.findAll(1, 10);
      expect(creatorsService.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('should pass custom page and limit', async () => {
      mockCreatorsService.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });
      await controller.findAll(2, 5);
      expect(creatorsService.findAll).toHaveBeenCalledWith(2, 5);
    });

    it('should throw BadRequestException when limit exceeds 50', () => {
      expect(() => controller.findAll(1, 51)).toThrow(BadRequestException);
    });
  });

  describe('registerWebhook', () => {
    it('should call WebhooksService.register', async () => {
      const creatorId = 'creator-123';
      const dto: RegisterWebhookDto = {
        url: 'https://example.com/webhook',
        secret: 'mysecret',
      };

      await controller.registerWebhook(creatorId, dto);

      expect(webhooksService.register).toHaveBeenCalledWith(
        creatorId,
        dto.url,
        dto.secret
      );
    });
  });

  describe('removeWebhook', () => {
    it('should call WebhooksService.remove', async () => {
      const creatorId = 'creator-123';
      const webhookId = 'webhook-123';

      await controller.removeWebhook(creatorId, webhookId);

      expect(webhooksService.remove).toHaveBeenCalledWith(creatorId, webhookId);
    });
  });
});
