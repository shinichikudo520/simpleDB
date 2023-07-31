import Check from "./check";
import { LocalBuffer } from "./localBuffer";
import { LocalKV } from "./localKV";
import { SimpleDB, SimpleIndex, SimpleStore } from "./simpleDB";
import { KEY_TYPE, callback, KEY_PROP_NAME, update } from "./type";
import { forEach, forEachA } from "./util";

export class SimpleTable {
  protected readonly db: SimpleDB;
  protected readonly store: SimpleStore;
  private readonly key: KEY_PROP_NAME;
  protected readonly primaryKey: SimpleIndex;
  protected readonly indexs: { [indexName: string]: SimpleIndex };
  /** 内存中存储一份数据, 结构与 indexedDB 完全一致 */
  protected cache: LocalKV | null;
  /** 内存中提供存储 arrayBuffer 类型的数据, 最大限制的使用运行内存, 适用于存储大体量数据 */
  protected buffer: LocalBuffer | null;

  constructor(
    db: SimpleDB,
    store: SimpleStore,
    key: KEY_PROP_NAME,
    primaryKey: SimpleIndex,
    indexs: { [indexName: string]: SimpleIndex },
    cachename: string,
    buffername: string
  ) {
    this.db = db;
    this.store = store;
    this.key = key;
    this.primaryKey = primaryKey;

    for (const indexName in indexs) {
      const index = indexs[indexName];
      if (!(index instanceof SimpleIndex)) {
        delete indexs[indexName];
      }
    }
    this.indexs = indexs;

    if (cachename) {
      this.cache = new LocalKV(cachename);
    }
    if (buffername) {
      this.buffer = new LocalBuffer(buffername);
    }
  }
  /** 解析验证参数 */
  private verify(...args) {
    for (const arg of args) {
      if (arg !== 0 && !Check.notNull(arg)) {
        throw new Error(`invalid data! ${arg}`);
      }
    }
  }

  public getSimpleStore() {
    return this.store;
  }

  public getPrimaryKey() {
    return this.primaryKey;
  }

  public getIndexs() {
    return this.indexs;
  }

  protected getIndex(indexName: string): SimpleIndex {
    this.verify(indexName);
    return this.indexs[indexName];
  }

  private async readwrite<T>(
    store: SimpleStore,
    tx: IDBTransaction,
    key: any,
    callback: callback<T>
  ): Promise<boolean> {
    const data = await store.get(key, tx);
    const result = callback(data);
    if (result) {
      return store.put(key, result, tx).then(
        () => true,
        () => false
      );
    }
    return false;
  }

  async readwriteData<T>(key: string, callback: callback<T>): Promise<boolean> {
    const store = this.store;
    const tx = await this.db.transaction(store);
    return this.readwrite<T>(store, tx, key, callback);
  }

  protected async get<T>(key: KEY_TYPE): Promise<T> {
    this.verify(key);

    return this.getInMemory<T>(key) || (await this.getInDB<T>(key));
  }

  private getInMemory<T>(key: KEY_TYPE): T | null {
    this.verify(key);

    if (!this.cache || typeof key !== "string") return null;
    return this.cache.get(key);
  }

  private async getInDB<T>(key: KEY_TYPE): Promise<T> {
    this.verify(key);

    const tx = await this.db.transaction(this.store, "readonly");
    try {
      return await this.store.get(key, tx);
    } finally {
      tx.abort();
    }
  }

  protected async getByIndexName<T>(
    indexName: string,
    indexVal: string | Array<any>
  ): Promise<T | null> {
    this.verify(indexName, indexVal);

    if (!this.indexs[indexName]) return null;
    return this.indexs[indexName].get(indexVal);
  }

  protected async getLotsArr<T>(keys: Array<string>): Promise<Array<T>> {
    this.verify(keys);

    const datas: Array<T> = new Array<T>();
    if (this.cache) {
      forEach(keys, (_, key) => {
        const data = this.getInMemory<T>(key);
        data && datas.push(data);
      });
    } else {
      const store = this.store;
      const tx = await this.db.transaction(store);
      await forEachA(keys, async (_, key) => {
        const data = await store.get(key, tx);
        data && datas.push(data);
      });
    }

    return datas;
  }

  protected getAllArrBound<T>(
    primaryKeyRange: [any, any, boolean, boolean]
  ): Promise<Array<T>> {
    return this.store.getAllBound(...primaryKeyRange);
  }

  protected getAllArrBoundByIndexName<T>(
    indexName: string,
    indexRange: [any, any, boolean, boolean]
  ): Promise<Array<T>> | null {
    this.verify(indexName);

    if (!this.indexs[indexName]) return null;
    return this.indexs[indexName].getAllBound(...indexRange);
  }
  protected getAllArrUBByIndexName<T>(
    indexName: string,
    range: [any, boolean]
  ): Promise<Array<T>> | null {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getAllUB(...range);
  }

  protected getAllArrLBByIndexName<T>(
    indexName: string,
    range: [any, boolean]
  ): Promise<Array<T>> | null {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getAllLB(...range);
  }

  protected getAllArrByIndexName<T>(
    indexName: string,
    indexVal: string | number
  ): Promise<Array<T>> | null {
    this.verify(indexName, indexVal);

    const datas = this.getAllInMemory<T>();
    if (datas) {
      const arr: Array<T> = [];
      forEach(datas, (_, data) => {
        if (data[indexName] === indexVal) {
          arr.push(data);
        }
      });
      return Promise.resolve(arr);
    } else {
      if (!this.indexs[indexName]) return null;
      return this.indexs[indexName].getAll(indexVal);
    }
  }

  public async getAllPrimaryKeys<T>(
    arr?: [any, any, boolean, boolean]
  ): Promise<IDBValidKey[]> {
    let datas = this.getAllInMemory<T>();
    if (datas) {
      const keys = Object.keys(datas);
      if (!arr) return keys;

      const [lower, upper, lowerOpen, upperOpen] = arr;
      if (lowerOpen && upperOpen) {
        return keys.filter((k) => k > lower && k < upper);
      } else if (lowerOpen) {
        return keys.filter((k) => k > lower && k <= upper);
      } else if (upperOpen) {
        return keys.filter((k) => k >= lower && k < upper);
      } else {
        return keys.filter((k) => k >= lower && k <= upper);
      }
    } else {
      return await this.getAllKeys(arr);
    }
  }

  protected async update<T>(
    key: string,
    updateProperty: update<T>,
    force = false
  ): Promise<T | null> {
    this.verify(key);

    let newData: T | null = null;
    const res = await this.readwriteData<T>(key, (data: T) => {
      if (!data && !force) return null;
      let ticket;
      if (data) {
        ticket = (data as any).ticket;
        if (!ticket || ticket >= 0) {
          ticket = -1;
        } else {
          ticket -= 1;
        }
      } else {
        ticket = -1;
      }
      newData = updateProperty(data);
      (newData as any).ticket = ticket;
      return newData;
    });

    if (res) {
      this.updateInMemory(key, newData);
    }
    return newData;
  }

  protected async updateInLocal<T>(
    key: string,
    updateProperty: update<T>
  ): Promise<T | null> {
    this.verify(key);

    let data: T = await this.get<T>(key);
    if (!data) return null;

    data = updateProperty(data);
    return this.updateInDB<T>(key, data).then(
      () => {
        this.updateInMemory<T>(key, data);
        return data;
      },
      () => null
    );
  }

  private updateInMemory<T>(key: string, data: T): void {
    this.verify(key, data);

    if (this.cache) {
      this.cache.set(key, data);
    }
  }

  private updateInDB<T>(key: string, data: T): Promise<any> {
    this.verify(key, data);

    return this.store.put(key, data);
  }

  protected async addLots<T>(
    datas: Array<T>,
    onsuccess?: (data: T) => void,
    onerror?: (data: { key: string; msg: string }) => void,
    tx?: IDBTransaction
  ): Promise<void> {
    this.verify(datas);

    const store = this.store;
    tx = tx || (await this.db.transaction(store));
    await forEachA(datas, async (_, data) => {
      await store.put(data[this.key], data, tx).then(
        () => {
          this.addInMemory<T>(data[this.key], data);
          onsuccess && onsuccess(data);
        },
        (error) => {
          onerror && onerror({ key: data[this.key], msg: error });
        }
      );
    });
  }

  protected async delLots<T>(
    keys: Array<string | number | Array<any>>,
    onsuccess?: (key: string | number | Array<any>) => void,
    onerror?: (data: {
      key: string | number | Array<any>;
      msg: string;
    }) => void,
    tx?: IDBTransaction
  ) {
    this.verify(keys);

    const store = this.store;
    tx = tx || (await this.db.transaction(store));
    await forEachA(keys, async (_, key) => {
      await store.delete(key, tx).then(
        () => {
          this.delInMemory<T>(key);
          onsuccess && onsuccess(key);
        },
        (error) => {
          onerror && onerror({ key, msg: error });
        }
      );
    });
  }

  protected async add<T>(key: KEY_TYPE, data: T): Promise<boolean> {
    this.verify(key, data);

    return this.addInDB<T>(key, data).then(
      () => {
        this.addInMemory<T>(key, data);
        return true;
      },
      () => false
    );
  }

  private addInMemory<T>(key: KEY_TYPE, data: T): void {
    this.verify(key, data);

    if (this.cache && typeof key === "string") {
      this.cache.set(key, data);
    }
  }

  private addInDB<T>(key: KEY_TYPE, data: T): Promise<any> {
    this.verify(key, data);

    return this.store.put(key, data);
  }

  protected del<T>(key: KEY_TYPE): Promise<boolean> {
    this.verify(key);

    return this.delInDB<T>(key).then(
      () => {
        this.delInMemory<T>(key);
        return true;
      },
      () => false
    );
  }

  private delInMemory<T>(key: KEY_TYPE): void {
    this.verify(key);

    if (this.cache && typeof key === "string") {
      this.cache.del(key);
    }
  }

  private delInDB<T>(key: KEY_TYPE): Promise<any> {
    this.verify(key);

    return this.store.delete(key);
  }

  protected async getAllKV<T>(): Promise<{ [key: string]: T }> {
    let datas = this.getAllInMemory<T>() as any;
    if (!datas) {
      datas = {};
      const arr = (await this.getAllInDB<T>()) || [];
      forEach(arr, (_, data) => {
        datas[data[this.key]] = data;
      });
    }
    return datas || {};
  }

  protected async getAllArr<T>(): Promise<Array<T>> {
    const datas = this.getAllInMemory<T>();
    if (datas) {
      return Object.values(datas);
    } else {
      return await this.getAllInDB<T>();
    }
  }

  private getAllInMemory<T>(): { [key: string]: T } | null {
    if (!this.cache) return null;
    return this.cache.getAllData();
  }

  private getAllInDB<T>(): Promise<Array<T>> {
    return this.store.getAll();
  }

  private getAllKeys(
    arr?: [any, any, boolean, boolean]
  ): Promise<IDBValidKey[]> {
    const range = arr ? IDBKeyRange.bound(...arr) : undefined;
    return this.store.getAllKeys(range);
  }

  protected getKeyOnly(
    indexName: string,
    indexVal: any
  ): Promise<IDBValidKey | undefined> | null {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getKeyOnly(indexVal);
  }

  protected getKeyLB(
    indexName: string,
    indexRange: [any, boolean] = [] as any
  ) {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getKeyLB(...indexRange);
  }

  protected getKeyUB(
    indexName: string,
    indexRange: [any, boolean] = [] as any
  ) {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getKeyUB(...indexRange);
  }

  protected getKeyBound(
    indexName: string,
    indexRange: [any, any, boolean, boolean] = [] as any
  ) {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getKeyBound(...indexRange);
  }

  protected itorAllKeys(
    indexName: string,
    indexRange: [any, any, boolean, boolean] | undefined,
    callback: (
      primaryKey: IDBValidKey,
      index: IDBValidKey | Array<IDBValidKey>
    ) => boolean,
    direction?: IDBCursorDirection
  ): Promise<any> {
    if (indexName === this.primaryKey.index) {
      return this.primaryKey.itorAllKeys(
        callback,
        indexRange && IDBKeyRange.bound(...indexRange),
        direction
      );
    } else if (this.indexs[indexName]) {
      return this.indexs[indexName].itorAllKeys(
        callback,
        indexRange && IDBKeyRange.bound(...indexRange),
        direction
      );
    } else {
      return Promise.resolve();
    }
  }

  public clearInMemory() {
    if (this.cache) {
      this.cache.clear();
      this.cache = null;
    }
  }

  protected getInCache<T>(key: string): ArrayBuffer | null {
    this.verify(key);

    if (!this.buffer || typeof key !== "string") return null;
    return this.buffer.get(key);
  }

  protected getAllInCache<T>(): { [key: string]: ArrayBuffer } | null {
    if (!this.buffer) return null;
    return this.buffer.getAllData();
  }

  protected setInCache<T>(key: string, data: ArrayBuffer): void {
    this.verify(key, data);

    if (this.buffer) {
      this.buffer.set(key, data);
    }
  }

  protected delInCache<T>(key: string): void {
    this.verify(key);

    if (this.buffer && typeof key === "string") {
      this.buffer.del(key);
    }
  }

  public clearInCache() {
    if (this.buffer) {
      this.buffer.clear();
      this.buffer = null;
    }
  }
}
