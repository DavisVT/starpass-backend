import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  [key: string]: any;

  async onModuleInit() {
    // In tests we use a mocked PrismaService. Production should provide a real
    // Prisma client implementation if needed.
    return;
  }

  async onModuleDestroy() {
    return;
  }
}
