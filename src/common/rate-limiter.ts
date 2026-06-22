export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private requestTimestamps: number[] = [];

  constructor(maxRequests: number = 3, windowMs: number = 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    // Remove timestamps older than the window
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.windowMs
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      // Wait until the oldest request is out of the window
      const oldestRequest = this.requestTimestamps[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      // After waiting, clear old timestamps again
      const newNow = Date.now();
      this.requestTimestamps = this.requestTimestamps.filter(
        (ts) => newNow - ts < this.windowMs
      );
    }

    this.requestTimestamps.push(Date.now());
  }
}
