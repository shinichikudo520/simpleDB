import Check from "../common/check";
import { SimpleDB } from "../common/simpleDB";
import { SimpleTable } from "../common/simpleTable";
import TestDB from "./initDB.v2";

export default class TestTable1 extends SimpleTable {
  constructor(db: SimpleDB, private readonly testDB: TestDB) {
    /** 表格主键自增长 */
    const store = db.store("test1", { keyPath: "id", autoIncrement: true });
    const primaryKey = store.getIndex("id");

    super(db, store, primaryKey, undefined, undefined, undefined, undefined);
  }
  private verifyKey(key: string) {
    Check.mustString(key);
  }
  async setData(data: any) {
    return this.add<any>(data[this.key], data);
  }
  async delData(key: string) {
    this.verifyKey(key);

    return this.del<any>(key);
  }
  async getData(key: string) {
    this.verifyKey(key);

    return this.get<any>(key);
  }
  async getAllArrData() {
    return this.getAllArr<any>();
  }
}
