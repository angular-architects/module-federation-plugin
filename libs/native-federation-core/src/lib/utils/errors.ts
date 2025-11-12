export class AbortedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortedError';
    Object.setPrototypeOf(this, AbortedError.prototype);
  }
}
