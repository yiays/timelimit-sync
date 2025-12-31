import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export class LocalKVNamespace {
  private storage: Map<string, any> = new Map();
  private filePath: string;

  constructor(filePath: string = join(process.cwd(), 'local-kv.json')) {
    this.filePath = filePath;
    this.loadFromFile();
  }

  private loadFromFile() {
    try {
      const data = readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.storage = new Map(Object.entries(parsed));
    } catch (e) {
      // File doesn't exist or invalid, start empty
    }
  }

  private saveToFile() {
    const data = Object.fromEntries(this.storage);
    writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  async get(key: string): Promise<string | null> {
    return this.storage.get(key) || null;
  }

  async put(key: string, value: string): Promise<void> {
    this.storage.set(key, value);
    this.saveToFile();
  }

  async delete(key: string): Promise<void> {
    this.storage.delete(key);
    this.saveToFile();
  }

  async list(options?: { prefix?: string }): Promise<{ keys: { name: string }[] }> {
    const keys = Array.from(this.storage.keys())
      .filter(key => !options?.prefix || key.startsWith(options.prefix))
      .map(name => ({ name }));
    return { keys };
  }
}