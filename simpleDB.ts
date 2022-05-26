export function openSimpleDB(
  name: string,
  version: number,
  onUpgrade: (db: IDBDatabase) => void
) {
  return new Promise<SimpleDB>((resolve, reject) => {
    const req = indexedDB.open(name, version);

    req.onupgradeneeded = () => {
      const db = req.result;
      console.log("openRequest.onupgradeneeded", db.name, db.version);
      onUpgrade(db);
    };

    req.onsuccess = () => {
      const db = req.result;
      console.log("openRequest.onsuccess", db.name);
      resolve(new SimpleDB(db));
    };

    req.onerror = () => {
      console.error("openRequest.onerror", req.error);
      reject(req.error);
    };

    req.onblocked = (e) => {
      console.error("openRequest.onblocked", e);
      reject(e);
    };
  });
}

class SimpleDB {
  constructor(private readonly db: IDBDatabase) {}

  store(name: string) {
    return new SimpleStore(name, this.db);
  }

  transaction(
    stores: SimpleStore | SimpleStore[],
    mode: IDBTransactionMode = "readwrite"
  ) {
    if (Array.isArray(stores)) {
      return this.db.transaction(
        stores.map((s) => s.name),
        mode
      );
    } else {
      return this.db.transaction(stores.name, mode);
    }
  }

  delete() {
    return new Promise<boolean>((resolve, reject) => {
      const req = indexedDB.deleteDatabase(this.db.name);

      req.onupgradeneeded = (e) => {
        console.log("Database deleted onupgradeneeded...", this.db.name, e);
        reject(e);
      };

      req.onsuccess = (e) => {
        console.log("Database deleted successfully...", this.db.name, e);
        resolve(true);
      };

      req.onerror = (e) => {
        console.error("Database deleted failed...", this.db.name, e);
        reject(e);
      };

      req.onblocked = (e) => {
        console.error("Database deleted onblocked...", this.db.name, e);
        reject(e);
      };
    });
  }

  close() {
    return this.db.close();
  }
}

abstract class AbstractSimpleStore<T extends IDBObjectStore | IDBIndex> {
  abstract exec<V>(
    tx: IDBTransaction | undefined,
    cb: SimpleStoreCallback<T, V>
  ): Promise<V>;

  get(key: IDBValidKey, tx?: IDBTransaction) {
    return this.exec<any>(tx, (store, resolve, reject) => {
      const req = store.get(key);
      handlRequest(req, resolve, reject);
    });
  }

  /**
   * 匹配符合的数据（数组）
   * @param query 键（主键/索引）的值或者范围，如果是 IDBObjectStore 调用则是指定主键的值或者范围，如果是 IDBIndex 调用则是指定索引的值或者范围
   * @param count 指定个数
   * @param tx 事务
   * @returns 符合的数据（数组）
   */
  getAll(
    query?: IDBValidKey | IDBKeyRange | null,
    count?: number,
    tx?: IDBTransaction
  ) {
    return this.exec<any[]>(tx, (store, resolve, reject) => {
      const req = store.getAll(query, count);
      handlRequest(req, resolve, reject);
    });
  }
  /**
   * 匹配指定范围的数据(数组)
   * @param lower 获取范围的下限
   * @param upper 获取范围的上限
   * @param lowerOpen 是否不包括下限, 下限开区间
   * @param upperOpen 是否不包括上限, 上限开区间
   * @returns 符合的数据(数组)
   */
  getAllBound(lower: any, upper: any, lowerOpen: boolean, upperOpen: boolean) {
    return this.getAll(IDBKeyRange.bound(lower, upper, lowerOpen, upperOpen));
  }
  /**
   * 匹配指定下限的数据(数组)
   * @param lower 获取范围的下限
   * @param lowerOpen 是否不包括下限, 下限开区间
   * @returns 符合的数据(数组)
   */
  getAllLB(lower: any, lowerOpen: boolean) {
    return this.getAll(IDBKeyRange.lowerBound(lower, lowerOpen));
  }
  /**
   * 匹配指定上限的数据(数组)
   * @param upper 获取范围的上限
   * @param upperOpen 是否不包括上限, 上限开区间
   * @returns 符合的数据(数组)
   */
  getAllUB(upper: any, upperOpen: boolean) {
    return this.getAll(IDBKeyRange.upperBound(upper, upperOpen));
  }
  /**
   * 获取指定范围的主键（数组）
   * @param query 键（主键/索引）的值或者范围，如果是 IDBObjectStore 调用则是指定主键的值或者范围，如果是 IDBIndex 调用则是指定索引的值或者范围
   * @param count 指定个数
   * @param tx 事务
   * @returns 主键（数组）
   */
  getAllKeys(
    query?: IDBValidKey | IDBKeyRange,
    count?: number,
    tx?: IDBTransaction
  ) {
    return this.exec<IDBValidKey[]>(tx, (store, resolve, reject) => {
      const req = store.getAllKeys(query, count);
      handlRequest(req, resolve, reject);
    });
  }
  /**
   * 获取指定范围的主键值
   * @param query 键（主键/索引）的值或者范围，如果是 IDBObjectStore 调用则是指定主键的值或者范围，如果是 IDBIndex 调用则是指定索引的值或者范围
   * @param tx 事务
   * @returns 主键值 如果匹配到多个，只会返回第一个
   */
  getKey(query: IDBValidKey | IDBKeyRange, tx?: IDBTransaction) {
    return this.exec<IDBValidKey | undefined>(tx, (store, resolve, reject) => {
      const req = store.getKey(query);
      handlRequest(req, resolve, reject);
    });
  }

  /**
   * 遍历所有数据
   * @param cb 针对每一条数据的回调处理函数
   *        @param key 键的值，如果是 IDBObjectStore 调用则是主键的值，如果是 IDBIndex 调用则是索引的值
   *        @param value 获取的数据
   *        @param update 更新的回调，输入处理后的数据（value）对该条数据进行更新
   * @param query 键（主键/索引）的值或者范围，如果是 IDBObjectStore 调用则是指定主键的值或者范围，如果是 IDBIndex 调用则是指定索引的值或者范围
   * @param direction 游标方向，默认 'next'
   * @param tx 事务
   * @returns 无
   */
  itorAll(
    cb: (
      key: IDBValidKey,
      value: any,
      update: (value: any) => Promise<IDBValidKey>
    ) => any,
    query?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection,
    tx?: IDBTransaction
  ) {
    return this.exec<void>(tx, (store, resolve, reject) => {
      const req = store.openCursor(query, direction);
      req.onerror = () => {
        reject(req.error);
      };

      req.onsuccess = async () => {
        const cursor = req.result;
        if (cursor) {
          try {
            let ret = cb(cursor.key, cursor.value, (value) => {
              return new Promise<IDBValidKey>((resolve, reject) => {
                const req1 = cursor.update(value);
                handlRequest(req1, resolve, reject);
              });
            });
            if (ret instanceof Promise) {
              ret = await ret;
            }
            if (ret !== false) {
              cursor.continue();
            }
          } catch (ex) {
            reject(ex);
          }
        } else {
          resolve();
        }
      };
    });
  }
  /**
   * 遍历所有 键（主键/索引）
   * @param cb 针对每一条数据的回调处理函数
   *        @param primaryKey 主键的值
   *        @param key 键的值，如果是 IDBObjectStore 调用则是主键的值，如果是 IDBIndex 调用则是索引的值
   *        @param update 更新的回调，输入处理后的数据（value）对该条数据进行更新
   * @param query 键（主键/索引）的值或者范围，如果是 IDBObjectStore 调用则是指定主键的值或者范围，如果是 IDBIndex 调用则是指定索引的值或者范围
   * @param direction 游标方向，默认 'next'
   * @param tx 事务
   * @returns 无
   */
  itorAllKeys(
    cb: (
      primaryKey: IDBValidKey,
      key: IDBValidKey,
      update: (value: any) => Promise<IDBValidKey>
    ) => any,
    query?: IDBValidKey | IDBKeyRange,
    direction?: IDBCursorDirection,
    tx?: IDBTransaction
  ) {
    return this.exec<void>(tx, (store, resolve, reject) => {
      const req = store.openKeyCursor(query, direction);

      req.onerror = () => {
        reject(req.error);
      };

      req.onsuccess = async () => {
        const cursor = req.result;
        if (cursor) {
          try {
            let ret = cb(cursor.primaryKey, cursor.key, (value) => {
              return new Promise<IDBValidKey>((resolve, reject) => {
                const req1 = cursor.update(value);
                handlRequest(req1, resolve, reject);
              });
            });
            if (ret instanceof Promise) {
              ret = await ret;
            }
            if (ret !== false) {
              cursor.continue();
            }
          } catch (ex) {
            reject(ex);
          }
        } else {
          resolve();
        }
      };
    });
  }

  count(query?: IDBValidKey | IDBKeyRange, tx?: IDBTransaction) {
    return this.exec<number>(tx, (store, resolve, reject) => {
      const req = store.count(query);
      handlRequest(req, resolve, reject);
    });
  }
}

class SimpleStore extends AbstractSimpleStore<IDBObjectStore> {
  constructor(readonly name: string, private readonly db: IDBDatabase) {
    super();
  }

  exec<T>(
    tx: IDBTransaction | undefined,
    cb: SimpleStoreCallback<IDBObjectStore, T>
  ) {
    return new Promise<T>((resolve, reject) => {
      try {
        tx = tx || this.db.transaction(this.name, "readwrite");
        const store = tx.objectStore(this.name);
        cb(store, resolve, reject);
      } catch (ex) {
        reject(ex);
      }
    });
  }

  getIndex(index: string, keys?: string[]) {
    return new SimpleIndex(this.name, index, this.db, keys);
  }

  put(key: IDBValidKey, value: any, tx?: IDBTransaction) {
    return this.exec<any>(tx, (store, resolve, reject) => {
      const req = store.put(value, key);
      handlRequest(req, resolve, reject);
    });
  }

  delete(key: IDBValidKey | IDBKeyRange, tx?: IDBTransaction) {
    return this.exec<any>(tx, (store, resolve, reject) => {
      const req = store.delete(key);
      handlRequest(req, resolve, reject);
    });
  }

  clear(tx?: IDBTransaction) {
    return this.exec<boolean>(tx, (store, resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => {
        resolve(true);
      };

      req.onerror = () => {
        reject(new Error("Failed to clear data!"));
      };
    });
  }
}

class SimpleIndex extends AbstractSimpleStore<IDBIndex> {
  constructor(
    readonly name: string,
    readonly index: string,
    private readonly db: IDBDatabase,
    readonly keys?: string[]
  ) {
    super();
  }

  exec<T>(
    tx: IDBTransaction | undefined,
    cb: SimpleStoreCallback<IDBIndex, T>
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        tx = tx || this.db.transaction(this.name, "readwrite");
        const store = tx.objectStore(this.name);
        const index = store.index(this.index);
        cb(index, resolve, reject);
      } catch (ex) {
        reject(ex);
      }
    });
  }
}

type SimpleStoreCallback<T, V> = (
  store: T,
  resolve: (value: V) => void,
  reject: (reason?: any) => void
) => void;

function handlRequest<T>(
  req: IDBRequest<T>,
  resolve: (value: T) => void,
  reject: (reason?: any) => void
) {
  req.onsuccess = () => {
    resolve(req.result);
  };

  req.onerror = () => {
    reject(req.error);
  };
}
