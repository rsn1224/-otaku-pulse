// Rust AppError 相当。FE には { kind, message } で返す（src/types AppError）。

export class AppError extends Error {
  readonly kind: string;
  constructor(kind: string, message: string) {
    super(message);
    this.kind = kind;
    this.name = 'AppError';
  }
}

export const invalidInput = (msg: string): AppError => new AppError('invalid_input', msg);
export const notImplemented = (msg: string): AppError => new AppError('not_implemented', msg);
