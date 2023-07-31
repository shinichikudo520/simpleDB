import Check from "../common/check";
import { SimpleDB } from "../common/simpleDB";
import { SimpleTable } from "../common/simpleTable";
import TestDB from "./initDB.v2";
import { TEST } from "./type";

export default class TestTable extends SimpleTable {
  constructor(db: SimpleDB, private readonly testDB: TestDB) {
    const store = db.store("test");
    const primaryKey = store.getIndex("uuid");
    const indexs = {
      title: store.getIndex("title"),
      source_version: store.getIndex("source_version", ["source", "version"]),
    };
    const cachename = "testMemory";
    const buffername = "testBuffer";

    super(db, store, primaryKey, "uuid", indexs, cachename, buffername);
  }
  private verifyKey(key: string) {
    Check.mustString(key);
  }
  async setData(data: TEST) {
    return this.add<TEST>(data[this.key], data);
  }
  async delData(key: string) {
    this.verifyKey(key);

    return this.del<TEST>(key);
  }
  async getData(key: string) {
    this.verifyKey(key);

    return this.get<TEST>(key);
  }
  async getAllArrData() {
    return this.getAllArr<TEST>();
  }
}
