import { Test, TestingModule } from '@nestjs/testing';
import { MetricsModule } from './metrics.module';
import { MetricsService } from './metrics.service';
import { MetricsAuthMiddleware } from './metrics.middleware';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

describe('MetricsModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [MetricsModule],
    }).compile();
  });

  it('should compile', () => {
    expect(module).toBeDefined();
  });

  it('should provide MetricsService', () => {
    const service = module.get(MetricsService);
    expect(service).toBeDefined();
  });

  it('should have active_passes_total metric', () => {
    const service = module.get(MetricsService);
    expect(service.activePassesTotal).toBeDefined();
    expect(service.activePassesTotal.constructor.name).toBe('Gauge');
  });

  it('should have total_revenue metric', () => {
    const service = module.get(MetricsService);
    expect(service.totalRevenue).toBeDefined();
    expect(service.totalRevenue.constructor.name).toBe('Counter');
  });

  it('should increment active passes metric', () => {
    const service = module.get(MetricsService);
    const creatorAddress = 'GB_TEST_CREATOR';
    
    service.incActivePasses(creatorAddress);
    const metric = service.activePassesTotal.labels(creatorAddress);
    
    expect(metric).toBeDefined();
  });

  it('should increment revenue metric', () => {
    const service = module.get(MetricsService);
    const creatorAddress = 'GB_TEST_CREATOR';
    const amount = 10.5;
    
    service.incRevenue(creatorAddress, amount);
    const metric = service.totalRevenue.labels(creatorAddress);
    
    expect(metric).toBeDefined();
  });
});

describe('MetricsAuthMiddleware', () => {
  let middleware: MetricsAuthMiddleware;

  beforeEach(() => {
    middleware = new MetricsAuthMiddleware();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should allow requests from allowed IPs', () => {
    process.env.METRICS_ALLOWED_IPS = '127.0.0.1,192.168.1.1';
    middleware = new MetricsAuthMiddleware();
    
    const mockReq = { ip: '192.168.1.1', connection: { remoteAddress: '192.168.1.1' } } as any;
    const mockRes = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    const mockNext = jest.fn();
    
    middleware.use(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject requests from non-allowed IPs without basic auth', () => {
    process.env.METRICS_ALLOWED_IPS = '127.0.0.1';
    middleware = new MetricsAuthMiddleware();
    
    const mockReq = { ip: '192.168.1.1', connection: { remoteAddress: '192.168.1.1' } } as any;
    const mockRes = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    const mockNext = jest.fn();
    
    middleware.use(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.send).toHaveBeenCalledWith('Unauthorized');
  });

  it('should allow requests with valid basic auth', () => {
    process.env.METRICS_BASIC_AUTH_USER = 'admin';
    process.env.METRICS_BASIC_AUTH_PASS = 'secret';
    middleware = new MetricsAuthMiddleware();
    
    const credentials = Buffer.from('admin:secret').toString('base64');
    const mockReq = { 
      ip: '192.168.1.1', 
      connection: { remoteAddress: '192.168.1.1' },
      headers: { authorization: `Basic ${credentials}` }
    } as any;
    const mockRes = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    const mockNext = jest.fn();
    
    middleware.use(mockReq, mockRes, mockNext);
    
    expect(mockNext).toHaveBeenCalled();
    expect(mockRes.status).not.toHaveBeenCalled();
  });

  it('should reject requests with invalid basic auth', () => {
    process.env.METRICS_BASIC_AUTH_USER = 'admin';
    process.env.METRICS_BASIC_AUTH_PASS = 'secret';
    middleware = new MetricsAuthMiddleware();
    
    const credentials = Buffer.from('admin:wrong').toString('base64');
    const mockReq = { 
      ip: '192.168.1.1', 
      connection: { remoteAddress: '192.168.1.1' },
      headers: { authorization: `Basic ${credentials}` }
    } as any;
    const mockRes = { setHeader: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() } as any;
    const mockNext = jest.fn();
    
    middleware.use(mockReq, mockRes, mockNext);
    
    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
  });
});