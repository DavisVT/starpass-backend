import { Injectable, ExecutionContext, CallHandler } from '@nestjs/common';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { CACHE_TTL_METADATA } from '@nestjs/cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class XCacheInterceptor extends CacheInterceptor {
  protected trackBy(context: ExecutionContext): string {
    const req = context.switchToHttp().getRequest();
    const routePath = req.route?.path || req.url;
    if (req.method === 'GET' && routePath.includes('/creators/') && req.params?.address) {
      return `creator:${req.params.address}`;
    }
    if (req.method === 'GET' && routePath.endsWith('/tiers') && !req.params?.id) {
      return 'tiers:list';
    }
    return `${req.method}:${req.url}`;
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();

    if (req.method !== 'GET') {
      return next.handle();
    }

    const key = this.trackBy(context);
    if (!key) {
      return next.handle();
    }

    try {
      const cached = await this.cacheManager.get(key);
      if (cached !== undefined && cached !== null) {
        res.setHeader('X-Cache', 'HIT');
        return of(cached);
      }
    } catch {}

    res.setHeader('X-Cache', 'MISS');
    return next.handle().pipe(
      tap(async (data) => {
        try {
          const ttlMeta = this.reflector.get(CACHE_TTL_METADATA, context.getHandler())
            ?? this.reflector.get(CACHE_TTL_METADATA, context.getClass())
            ?? null;
          const ttl = typeof ttlMeta === 'function' ? await ttlMeta(context) : ttlMeta;
          const args: any[] = [key, data];
          if (ttl != null) args.push(ttl);
          await this.cacheManager.set(...args);
        } catch {}
      }),
    );
  }
}
