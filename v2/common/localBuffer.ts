const LOCAL_BUFFER_ROOT = "__LOCAL_BUFFER_ROOT__";

export class LocalBuffer {
  readonly namespace: string;
  readonly cache: { [key: string]: ArrayBuffer };

  constructor(namespace: string) {
    let root = self[LOCAL_BUFFER_ROOT];
    if (!root) {
      root = {};
      self[LOCAL_BUFFER_ROOT] = root;
    }

    let cache = root[namespace];
    if (!cache) {
      cache = {};
      root[namespace] = cache;
    }

    this.namespace = namespace;
    this.cache = cache;
  }

  set(key: string, value: any) {
    const oldValue = this.cache[key];
    this.cache[key] = value;
    return oldValue;
  }

  get(key: string) {
    return this.cache[key];
  }

  getAllData() {
    return this.cache;
  }

  del(key: string) {
    delete this.cache[key];
  }

  clear() {
    let root = self[LOCAL_BUFFER_ROOT];
    if (root.hasOwnProperty(this.namespace)) {
      delete root[this.namespace];
    }
  }
}
