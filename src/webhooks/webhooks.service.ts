import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(private prisma: PrismaService) {}

  async register(creatorId: string, url: string, secret: string) {
    const creator = await this.prisma.creator.findUnique({
      where: { id: creatorId },
    });
    if (!creator) {
      throw new NotFoundException('Creator not found');
    }

    return this.prisma.webhookConfig.create({
      data: {
        creatorId,
        url,
        secret,
      },
    });
  }

  async remove(creatorId: string, webhookId: string) {
    const webhook = await this.prisma.webhookConfig.findFirst({
      where: { id: webhookId, creatorId },
    });
    if (!webhook) {
      throw new NotFoundException('Webhook not found');
    }

    return this.prisma.webhookConfig.delete({
      where: { id: webhookId },
    });
  }

  async deliverPassPurchaseWebhook(creatorId: string, passData: any) {
    try {
      const webhooks = await this.prisma.webhookConfig.findMany({
        where: { creatorId, active: true },
      });

      if (webhooks.length === 0) {
        return;
      }

      const payload = JSON.stringify(passData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      );

      for (const webhook of webhooks) {
        try {
          const signature = crypto
            .createHmac('sha256', webhook.secret)
            .update(payload)
            .digest('hex');

          this.logger.log(`Delivering webhook to ${webhook.url} for creator ${creatorId}`);

          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Signature': signature,
            },
            body: payload,
          });

          if (!response.ok) {
            this.logger.warn(
              `Failed to deliver webhook to ${webhook.url}. Status: ${response.status} ${response.statusText}`
            );
          } else {
            this.logger.log(`Successfully delivered webhook to ${webhook.url}`);
          }
        } catch (error) {
          this.logger.error(
            `Error delivering webhook to ${webhook.url}: ${error.message}`
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `Error in deliverPassPurchaseWebhook: ${error.message}`
      );
    }
  }
}
