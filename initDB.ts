import { openSimpleDB, SimpleDB } from "./simpleDB";

let DB: SimpleDB;
const version = 1;
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
function initDB() {
  return new Promise((resolve) => {
    // 切换 DB 时, 先关闭上一个 DB 的连接, 不能一直连接耗费资源, 且一直处于连接状态无法删除
    if (DB) {
      DB.close();
      DB = null as any;
    }

    openSimpleDB("testDB", version, (db: IDBDatabase) => {
      clearStore(db); // 清除 store
      createStore(db, cfgs);
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

function createStore(db: IDBDatabase, cfgs: Array<any>) {
  cfgs.forEach((info) => {
    const { storeName, singleKey, indexKeys } = info;
    const store = db.createObjectStore(storeName);

    // 如果没有指定主键, 那最后创建的索引就是主键
    if (singleKey) {
      store.createIndex(singleKey, singleKey);
    }
    if (indexKeys && indexKeys.length) {
      indexKeys.forEach((index) => {
        if (typeof index === "string") {
          store.createIndex(index, index, { unique: false });
        } else if (typeof index === "object") {
          store.createIndex(index.indexName, index.keyPath, {
            unique: index.unique || false,
          });
        }
      });
    }
  });
}
