// 単純なカウンティングセマフォ（Ollama 同時呼び出し制限用）。

export class Semaphore {
  private available: number;
  private readonly waiters: Array<() => void> = [];

  constructor(permits: number) {
    this.available = permits;
  }

  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available -= 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    const next = this.waiters.shift();
    if (next !== undefined) {
      next(); // permit を待機者へ直接受け渡す
    } else {
      this.available += 1;
    }
  }
}
