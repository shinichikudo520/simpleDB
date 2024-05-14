export class LocalKV<T> {
  private readonly rootspace: string;
  private readonly namespace: string;
  private cache: { [key: string]: T };

  constructor(rootspace: string, namespace: string) {
    let root = self[rootspace];
    if (!root) {
      root = {};
      self[rootspace] = root;
    }

    let cache = root[namespace];
    if (!cache) {
      cache = {};
      root[namespace] = cache;
    }

    this.rootspace = rootspace;
    this.namespace = namespace;
    this.cache = cache;
  }

  set(key: string, value: T) {
    if (!key || !value) {
      throw new Error(`Illegal data! key: ${key}, value: ${value}`);
    }

    const oldValue = this.cache[key];
    this.cache[key] = value;
    return oldValue;
  }

  get(key: string): T {
    return this.cache[key];
  }

  keys(): Array<string> {
    const keys: Array<string> = [];
    for (const k in this.cache) {
      keys.push(k);
    }
    return keys;
  }

  values(): Array<T> {
    const values: Array<T> = [];
    for (const k in this.cache) {
      const v = this.cache[k];
      values.push(v);
    }
    return values;
  }

  getAllData(): { [key: string]: T } {
    return this.cache;
  }

  del(key: string) {
    delete this.cache[key];
  }

  clear() {
    const root = self[this.rootspace];
    if (root.hasOwnProperty(this.namespace)) {
      this.cache = {};
      root[this.namespace] = this.cache;
    }
  }

  destory() {
    let root = self[this.rootspace];
    if (root.hasOwnProperty(this.namespace)) {
      delete root[this.namespace];
    }
  }
}
