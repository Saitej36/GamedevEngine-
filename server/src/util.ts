import { randomUUID } from 'node:crypto';

export const newId = (prefix: string) => `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
export const nowIso = () => new Date().toISOString();

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const log = {
  info: (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), '[info]', ...a),
  warn: (...a: unknown[]) => console.warn(new Date().toISOString().slice(11, 19), '[warn]', ...a),
  error: (...a: unknown[]) => console.error(new Date().toISOString().slice(11, 19), '[error]', ...a),
};

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
