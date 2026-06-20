import { Test, TestingModule } from '@nestjs/testing';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterWebhookDto } from '../webhooks/dto/register-webhook.dto';

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let webhooksService: WebhooksService;

  const mockCreatorsService = {};
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
    webhooksService = module.get<WebhooksService>(WebhooksService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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
