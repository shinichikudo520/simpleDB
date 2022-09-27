import { openSimpleDB, SimpleDB, SimpleIndex, SimpleStore } from "./simpleDB.v2";

let DB: SimpleDB;
const version = 2;

function initDB() {
  return new Promise((resolve) => {
    // 切换 DB 时, 先关闭上一个 DB 的连接, 不能一直连接耗费资源, 且一直处于连接状态无法删除
    if (DB) {
      DB.close();
      DB = null as any;
    }

    openSimpleDB("testDB", version, (db: IDBDatabase) => {
      clearStore(db); // 清除 store
      createStore(db);
    }).then(
      (db: SimpleDB) => {
        DB = db;
        resolve(true);
      },
      (e) => {
        console.error(e);
        resolve(false);
      }
    );
  });
}

function clearStore(db: IDBDatabase) {
  const names = new Array<string>();
  for (let i = 0; i < db.objectStoreNames.length; i++) {
    const store = db.objectStoreNames.item(i);
    if (typeof store === "string") {
      names.push(store);
    }
  }
  names.forEach((name) => db.deleteObjectStore(name));
}
function initIndexDB(data: (SimpleStore | SimpleIndex | any)[]) {
  const storeIdx: { [name: string]: IDBObjectStore } = {};

  for (const d of data) {
    if (d instanceof SimpleStore) {
      const store = d.init();
      storeIdx[d.name] = store;
    }
  }

  for (const d of data) {
    if (d instanceof SimpleIndex) {
      if (d.name in storeIdx) {
        d.init(storeIdx[d.name]);
      } else {
        console.warn(
          "unable to init index",
          d.index,
          "with out init store",
          d.name
        );
      }
    }
  }
}
/** indexedDB 表结构对照
const cfgs = [
  { storeName: "aaa", singleKey: "aaaKey" },
  { storeName: "bbb", indexKeys: ["bbbKey1", "bbbKey2", "bbbKey3"] },
  {
    storeName: "ccc",
    indexKeys: [
      "cccKey",
      { indexName: "uuid_time", keyPath: ["uuid", "time"] },
      "uuid",
    ],
  },
];
 */
function mainDB(db: SimpleDB) {
  const aaa = db.store("aaa");
  const bbb = db.store("bbb");
  const ccc = db.store("ccc");

  return {
    db,
    version,
    aaa,
    aaa_key: aaa.getIndex("aaaKey"),
    bbb,
    bbb_key1: bbb.getIndex("bbbKey1"),
    bbb_key2: bbb.getIndex("bbbKey2"),
    bbb_key3: bbb.getIndex("bbbKey3"),
    ccc,
    ccc_key: ccc.getIndex("cccKey"),
    ccc_uuid_time: ccc.getIndex("uuid_time", ["uuid", "time"], true),
    ccc_uuid: ccc.getIndex("uuid", "uuid", true),
  };
}
function createStore(db: IDBDatabase) {
  const sdb = new SimpleDB(db);
  initIndexDB(Object.values(mainDB(sdb)));
}
