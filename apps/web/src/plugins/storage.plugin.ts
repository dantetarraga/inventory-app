function attempt<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export class StoragePlugin {
  constructor(
    private readonly prefix = 'stockpro-',
    private readonly backend: () => Storage = () => window.localStorage,
  ) {}

  getString(key: string): string | null {
    return attempt(() => this.backend().getItem(this.prefix + key), null);
  }

  setString(key: string, value: string) {
    attempt(() => this.backend().setItem(this.prefix + key, value), undefined);
  }

  get<T>(key: string, fallback: T): T {
    const raw = this.getString(key);
    return raw === null ? fallback : attempt(() => JSON.parse(raw) as T, fallback);
  }

  set(key: string, value: unknown) {
    this.setString(key, JSON.stringify(value));
  }

  remove(key: string) {
    attempt(() => this.backend().removeItem(this.prefix + key), undefined);
  }
}

export const storage = new StoragePlugin();
