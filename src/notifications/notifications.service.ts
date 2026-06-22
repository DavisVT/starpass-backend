import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async createNotification(fanId: string, title: string, body: string, data?: any) {
    return this.prisma.notification.create({
      data: { fanId, title, body, data },
    });
  }

  async bulkCreateForFans(fanIds: string[], title: string, body: string, data?: any) {
    const ops = fanIds.map((fanId) => ({ fanId, title, body, data }));
    return this.prisma.notification.createMany({ data: ops });
  }
}
