import { SimpleDB, openSimpleDB } from "../common/simpleDB";
import { forEach } from "../common/util";
import { VERSION, clearTables, createTables, getTabels } from "./config";

export default class TestDB {
  private db: SimpleDB;
  private version: number;
  public tables: ReturnType<typeof getTabels>;

  constructor(private readonly name: string) {}

  public open() {
    return new Promise((resolve) => {
      const that = this;
      if (that.db && that.version === VERSION) {
        that.tables = getTabels(that.db, that);
        return resolve(true);
      }

      // 连接 DB 之前先关闭上一次的连接
      that.close(this.name);
      let isUpdate = false;
      openSimpleDB(that.name, VERSION, async (db: IDBDatabase) => {
        clearTables(db);
        const sdb = new SimpleDB(db);
        that.tables = getTabels(sdb, that);
        createTables(that.tables);
        isUpdate = true;
      }).then(
        async (db: SimpleDB) => {
          that.db = db;
          that.version = VERSION;
          if (isUpdate) {
          } else {
            that.tables = getTabels(db, that);
          }
          resolve(true);
        },
        (e) => {
          console.error("init DB failed...", e);
          resolve(false);
        }
      );
    });
  }

  public close(name: string, callback = () => {}) {
    if (this.db && name === this.name) {
      this.db.close();
      callback();
    } else {
      console.warn("close db....");
    }
  }

  public clearData() {
    const tables = this.tables;
    forEach(tables, (_, table: (typeof tables)[keyof typeof tables]) => {
      table.clearInMemory();
      table.clearInCache();
    });
  }

  public transaction(table) {
    return this.db.transaction(table);
  }
}

// --------------------- TEST
const DB = new TestDB("test");
DB.tables.test.setData({
  uuid: "1",
  title: "aaa",
  source: "bbbb",
  version: "cccc",
});
// 注意事项: 数据记得深拷贝
