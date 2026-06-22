import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class MetricsAuthMiddleware implements NestMiddleware {
  private readonly allowedIps: string[];
  private readonly basicAuthUser: string;
  private readonly basicAuthPass: string;

  constructor() {
    this.allowedIps = (process.env.METRICS_ALLOWED_IPS || '').split(',').map((ip) => ip.trim()).filter(Boolean);
    this.basicAuthUser = process.env.METRICS_BASIC_AUTH_USER || '';
    this.basicAuthPass = process.env.METRICS_BASIC_AUTH_PASS || '';
  }

  use(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.connection.remoteAddress || '';

    if (this.allowedIps.length > 0 && this.allowedIps.includes(ip)) {
      return next();
    }

    if (this.basicAuthUser && this.basicAuthPass) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Basic ')) {
        const encoded = authHeader.slice(6);
        const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
        const [user, pass] = decoded.split(':');
        if (user === this.basicAuthUser && pass === this.basicAuthPass) {
          return next();
        }
      }
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Metrics"');
    return res.status(401).send('Unauthorized');
  }
}