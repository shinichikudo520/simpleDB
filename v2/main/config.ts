import { SimpleDB, SimpleIndex, SimpleStore } from "../common/simpleDB";
import { forEach } from "../common/util";
import TestDB from "./initDB.v2";
import TestTable from "./test.table";
import TestTable1 from "./test1.table";

export const VERSION = 1;

export function getTabels(db: SimpleDB, testDB: TestDB) {
  return {
    test: new TestTable(db, testDB),
    test1: new TestTable1(db, testDB),
  };
}

function getStoreAndIndex(
  tables: ReturnType<typeof getTabels>
): Array<SimpleStore | SimpleIndex> {
  const result: Array<SimpleStore | SimpleIndex> = [];

  forEach(tables, (_, table: (typeof tables)[keyof typeof tables]) => {
    const simpleStore = table.getSimpleStore();
    result.push(simpleStore);

    const primaryKey = table.getPrimaryKey();
    if (primaryKey) {
      result.push(primaryKey);
    }

    const indexs: { [indexName: string]: SimpleIndex } = table.getIndexs();
    result.push(...Object.values(indexs));
  });

  return result;
}

export function createTables(tables: ReturnType<typeof getTabels>) {
  const storeIdx: { [name: string]: IDBObjectStore } = {};

  forEach(tables, (_, d) => {
    if (d instanceof SimpleStore) {
      const store = d.init();
      storeIdx[d.name] = store;
    }
  });

  forEach(tables, (_, d) => {
    if (d instanceof SimpleIndex) {
      if (d.name in storeIdx) {
        d.init(storeIdx[d.name]);
      } else {
        console.warn(
          "unale to init index",
          d.index,
          "with out init store",
          d.name
        );
      }
    }
  });
}

export function clearTables(db: IDBDatabase) {
  const names = new Array<string>();
  for (let i = 0; i < db.objectStoreNames.length; i++) {
    const name = db.objectStoreNames.item(i);
    if (name) {
      names.push(name);
    }
  }
  names.forEach((name) => db.deleteObjectStore(name));
}
