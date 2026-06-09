// rate_limiter.rs の TokenBucket 移植。
// 単一プロセス・単一スレッドなので Mutex 不要。acquire を直列化して
// interval / token の簿記を一貫させる（並列収集で共有しても 2.1s 間隔を保証）。

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class TokenBucket {
  private readonly maxTokens: number;
  private readonly refillRate: number;
  private readonly minIntervalMs: number;
  private tokens: number;
  private lastRefill: number;
  private lastRequest: number;
  private chain: Promise<void> = Promise.resolve();

  constructor(maxTokens: number, refillRate: number, minIntervalMs: number) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.minIntervalMs = minIntervalMs;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.lastRequest = Date.now() - minIntervalMs;
  }

  /** トークンを 1 つ取得。最小間隔を待ち、トークン枯渇時は例外。 */
  async acquire(): Promise<void> {
    const prev = this.chain;
    let release: () => void = () => {};
    this.chain = new Promise<void>((r) => {
      release = r;
    });
    await prev;
    try {
      const sinceLast = Date.now() - this.lastRequest;
      if (sinceLast < this.minIntervalMs) {
        await sleep(this.minIntervalMs - sinceLast);
      }
      this.lastRequest = Date.now();

      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      if (elapsed > 0) {
        this.tokens = Math.min(this.tokens + elapsed * this.refillRate, this.maxTokens);
        this.lastRefill = now;
      }

      if (this.tokens >= 1) {
        this.tokens -= 1;
      } else {
        throw new Error('Rate limit exceeded: no tokens available');
      }
    } finally {
      release();
    }
  }
}

/** AniList: 30 req/min, ≥2,100ms 間隔。プロセス全体で共有する。 */
export const anilistLimiter = new TokenBucket(30, 0.5, 2100);
