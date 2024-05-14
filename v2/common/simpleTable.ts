import Check from "./check";
import { LocalBuffer } from "./localBuffer";
import { LocalKV } from "./localKV";
import { SimpleDB, SimpleIndex, SimpleStore } from "./simpleDB";
import { KEY_TYPE, callback, KEY_PROP_NAME, update } from "./type";
import { forEach, forEachA } from "./util";

export class SimpleTable<T> {
  protected readonly db: SimpleDB;
  protected readonly store: SimpleStore;
  protected readonly key: KEY_PROP_NAME;
  protected readonly primaryKey: SimpleIndex;
  protected readonly indexs: { [indexName: string]: SimpleIndex };
  /** 内存中存储一份数据, 结构与 indexedDB 完全一致 */
  protected cache: LocalKV<T> | null;
  /** 内存中提供存储 arrayBuffer 类型的数据, 最大限制的使用运行内存, 适用于存储大体量数据 */
  protected buffer: LocalBuffer | null;

  constructor(
    db: SimpleDB,
    store: SimpleStore,
    primaryKey: SimpleIndex,
    key: KEY_PROP_NAME = "" as any,
    indexs: { [indexName: string]: SimpleIndex } = {},
    cachename?: string,
    buffername?: string
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
      this.cache = new LocalKV<T>("__LOCAL_KV_ROOT__", cachename);
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

  private async readwrite(
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

  async readwriteData(key: string, callback: callback<T>): Promise<boolean> {
    const store = this.store;
    const tx = await this.db.transaction(store);
    return this.readwrite(store, tx, key, callback);
  }

  protected async get(key: KEY_TYPE): Promise<T> {
    this.verify(key);

    return this.getInMemory(key) || (await this.getInDB(key));
  }

  private getInMemory(key: KEY_TYPE): T | null {
    this.verify(key);

    if (!this.cache || typeof key !== "string") return null;
    return this.cache.get(key);
  }

  private async getInDB(key: KEY_TYPE): Promise<T> {
    this.verify(key);

    const tx = await this.db.transaction(this.store, "readonly");
    try {
      return await this.store.get(key, tx);
    } finally {
      tx.abort();
    }
  }

  protected async getByIndexName(
    indexName: string,
    indexVal: string | Array<any>
  ): Promise<T | null> {
    this.verify(indexName, indexVal);

    if (!this.indexs[indexName]) return null;
    return this.indexs[indexName].get(indexVal);
  }

  protected async getLotsArr(keys: Array<string>): Promise<Array<T>> {
    this.verify(keys);

    const datas = new Array();
    if (this.cache) {
      forEach(keys, (_, key) => {
        const data = this.getInMemory(key);
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

  protected getAllArrBound(
    primaryKeyRange: [any, any, boolean, boolean]
  ): Promise<Array<T>> {
    return this.store.getAllBound(...primaryKeyRange);
  }

  protected getAllArrBoundByIndexName(
    indexName: string,
    indexRange: [any, any, boolean, boolean]
  ): Promise<Array<T>> | null {
    this.verify(indexName);

    if (!this.indexs[indexName]) return null;
    return this.indexs[indexName].getAllBound(...indexRange);
  }
  protected getAllArrUBByIndexName(
    indexName: string,
    range: [any, boolean]
  ): Promise<Array<T>> | null {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getAllUB(...range);
  }

  protected getAllArrLBByIndexName(
    indexName: string,
    range: [any, boolean]
  ): Promise<Array<T>> | null {
    if (!this.indexs[indexName]) return null;

    return this.indexs[indexName].getAllLB(...range);
  }

  protected getAllArrByIndexName(
    indexName: string,
    indexVal: string | number
  ): Promise<Array<T>> | null {
    this.verify(indexName, indexVal);

    const datas = this.getAllInMemory();
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

  public async getAllPrimaryKeys(
    arr?: [any, any, boolean, boolean]
  ): Promise<IDBValidKey[]> {
    let datas = this.getAllInMemory();
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

  protected async update(
    key: string,
    updateProperty: update<T>,
    force = false
  ): Promise<T | null> {
    this.verify(key);

    let newData: T | null = null;
    const res = await this.readwriteData(key, (data: T) => {
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
      this.updateInMemory(key, newData as T);
    }
    return newData;
  }

  protected async updateInLocal(
    key: string,
    updateProperty: update<T>
  ): Promise<T | null> {
    this.verify(key);

    let data: T = await this.get(key);
    if (!data) return null;

    data = updateProperty(data);
    return this.updateInDB(key, data).then(
      () => {
        this.updateInMemory(key, data);
        return data;
      },
      () => null
    );
  }

  private updateInMemory(key: string, data: T): void {
    this.verify(key, data);

    if (this.cache) {
      this.cache.set(key, data);
    }
  }

  private updateInDB(key: string, data: T): Promise<any> {
    this.verify(key, data);

    return this.store.put(key, data);
  }

  protected async addLots(
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
          this.addInMemory(data[this.key], data);
          onsuccess && onsuccess(data);
        },
        (error) => {
          onerror && onerror({ key: data[this.key], msg: error });
        }
      );
    });
  }

  protected async delLots(
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
          this.delInMemory(key);
          onsuccess && onsuccess(key);
        },
        (error) => {
          onerror && onerror({ key, msg: error });
        }
      );
    });
  }

  protected async add(key: KEY_TYPE, data: T): Promise<boolean> {
    this.verify(key, data);

    return this.addInDB(key, data).then(
      () => {
        this.addInMemory(key, data);
        return true;
      },
      () => false
    );
  }

  private addInMemory(key: KEY_TYPE, data: T): void {
    this.verify(key, data);

    if (this.cache && typeof key === "string") {
      this.cache.set(key, data);
    }
  }

  private addInDB(key: KEY_TYPE, data: T): Promise<any> {
    this.verify(key, data);

    return this.store.put(key, data);
  }

  protected del(key: KEY_TYPE): Promise<boolean> {
    this.verify(key);

    return this.delInDB(key).then(
      () => {
        this.delInMemory(key);
        return true;
      },
      () => false
    );
  }

  private delInMemory(key: KEY_TYPE): void {
    this.verify(key);

    if (this.cache && typeof key === "string") {
      this.cache.del(key);
    }
  }

  private delInDB(key: KEY_TYPE): Promise<any> {
    this.verify(key);

    return this.store.delete(key);
  }

  protected async getAllKV(): Promise<{ [key: string]: T }> {
    let datas = this.getAllInMemory() as any;
    if (!datas) {
      datas = {};
      const arr = (await this.getAllInDB()) || [];
      forEach(arr, (_, data) => {
        datas[data[this.key]] = data;
      });
    }
    return datas || {};
  }

  protected async getAllArr(): Promise<Array<T>> {
    const datas = this.getAllInMemory();
    if (datas) {
      return Object.values(datas);
    } else {
      return await this.getAllInDB();
    }
  }

  private getAllInMemory(): { [key: string]: T } | null {
    if (!this.cache) return null;
    return this.cache.getAllData();
  }

  private getAllInDB(): Promise<Array<T>> {
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

  protected getInCache(key: string): ArrayBuffer | null {
    this.verify(key);

    if (!this.buffer || typeof key !== "string") return null;
    return this.buffer.get(key);
  }

  protected getAllInCache(): { [key: string]: ArrayBuffer } | null {
    if (!this.buffer) return null;
    return this.buffer.getAllData();
  }

  protected setInCache(key: string, data: ArrayBuffer): void {
    this.verify(key, data);

    if (this.buffer) {
      this.buffer.set(key, data);
    }
  }

  protected delInCache(key: string): void {
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
