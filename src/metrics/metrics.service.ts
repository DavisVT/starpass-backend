import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  activePassesTotal: Gauge<string>;
  totalRevenue: Counter<string>;

  constructor() {
    this.registry = new Registry();

    this.activePassesTotal = new Gauge({
      name: 'active_passes_total',
      help: 'Total number of active passes',
      labelNames: ['creator_address'],
      registers: [this.registry],
    });

    this.totalRevenue = new Counter({
      name: 'total_revenue',
      help: 'Total revenue in USDC',
      labelNames: ['creator_address'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // no-op
  }

  getRegistry(): Registry {
    return this.registry;
  }

  incActivePasses(creatorAddress: string) {
    this.activePassesTotal.labels(creatorAddress).inc(1);
  }

  decActivePasses(creatorAddress: string) {
    this.activePassesTotal.labels(creatorAddress).dec(1);
  }

  setActivePasses(creatorAddress: string, value: number) {
    this.activePassesTotal.labels(creatorAddress).set(value);
  }

  incRevenue(creatorAddress: string, amount: number) {
    this.totalRevenue.labels(creatorAddress).inc(amount);
  }
}