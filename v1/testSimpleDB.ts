import { openSimpleDB } from "./simpleDB.v1";
import { sleep } from "../sleep";

export default async function testSimpleDB() {
  console.log("test...", "testSimpleDB...");

  const version = 5;
  // 连接DB
  let sdb = await openSimpleDB("test", version, (db) => {
    console.log("upgrading...");

    try {
      db.deleteObjectStore("bbb");
    } catch (error) {}

    const store = db.createObjectStore("aaa");
    store.createIndex("by_id", "id", { unique: true });
    store.createIndex("by_name", "name");
  });

  console.log("IDBDatabase...", sdb);

  try {
    if (true) {
      // 关闭DB连接
      const closeReq = sdb.close();
      console.log("close db...", closeReq);

      // 删除DB
      const delReq = await sdb.delete();
      console.log("delete db...", delReq);
    }

    // 重连DB
    sdb = await openSimpleDB("test", version + 1, (db) => {
      console.log("upgrading...");

      try {
        db.deleteObjectStore("aaa");
      } catch (error) {}
      const store = db.createObjectStore("asdf");
      store.createIndex("by_id", "id", { unique: true });
      store.createIndex("by_name", "name");
      // 生成复合索引
      store.createIndex("id_name", ["id", "name"]);
    });
    console.log("IDBDatabase1...", sdb);
  } catch (error) {
    // 已经成功连接DB的情况下
    // 直接迭代 DB 的版本，会失败， DB 处于 pending 状态 , 除非先关闭 DB 的连接
    // 重连 DB , 版本不发生变化时，能成功连接
    console.error("连接 DB 时 , 直接迭代 DB 版本失败...", error);
  }

  const asdf = sdb.store("asdf");
  const idxId = asdf.getIndex("by_id");
  const idxName = asdf.getIndex("by_name");
  // 复合索引
  const idxs = asdf.getIndex("id_name");

  await asdf.put("1234", { id: "12341234", name: "asdf", date: new Date() });
  await asdf.put("1234", { id: "12345555", name: "asdf", date: new Date() });
  console.log(idxs.get(["12345555", "asdf"]));
  try {
    await asdf.put("4321", { id: "12341234", name: "asdf", date: new Date() });
  } catch (error) {
    // 约束了索引 id 是 unique 唯一索引，添加两个 id 一致的数据进入，则违反了约束，无法成功添加
    console.error(
      "Repeatedly add data that has agreed on a unique index...",
      error
    );
  }
  await sleep(100);
  await asdf.put("1324", "acbd");

  // 同一事务，处理多项操作
  const tx = sdb.transaction(asdf);
  await asdf.put("5678", "qqwer", tx);
  await asdf.put("8765", "sdfwerf", tx);

  // Promise.all 的性能优于 await 每一步操作完成
  console.time("promise.all");
  const tasks:any[] = [];
  for (let i = 0; i < 100; i++) {
    tasks.push(asdf.put("8765", "aasdfasdf", tx));
  }
  await Promise.all(tasks);
  console.timeEnd("promise.all");

  console.time("await everyone...");
  for (let i = 0; i < 100; i++) {
    await asdf.put("8765", "aasdfasdf", tx);
  }
  console.timeEnd("await everyone...");

  // 休眠 1s 后，事务被提交，无法继续完成数据的处理
  await sleep(1);
  try {
    await asdf.put("9988", "sadfwefwe", tx);
  } catch (error) {
    console.error("休眠 1s 后，transaction 被提交了，会报错...", error);
  }

  for (let i = 0; i < 10; i++) {
    const tx1 = sdb.transaction(asdf);
    console.log(await asdf.get("8765", tx1));
    await asdf.delete("8765", tx1);
    tx1.abort(); // 放弃本次连接的事务的所有修改，若当前的事务处于回滚或完成状态时，则会抛出一个错误事件
  }

  console.log(await asdf.get("8765"));
  await asdf.delete("8765");
  console.log(await asdf.get("8765"));

  const tx2 = sdb.transaction(asdf);
  console.log(await asdf.get("5678", tx2));
  await asdf.delete("5678", tx2);
  tx2.commit(); // 提交事务
  try {
    tx2.abort(); // 放弃本次连接的事务的所有修改，若当前的事务处于回滚或完成状态时，则会抛出一个错误事件
    console.log("transaction abort...");
  } catch (error) {
    console.error("transaction abort failed...", error);
  }
  console.log(await asdf.get("5678"));

  /*---------------------------------- */
  await asdf.put("55555555.1", {
    id: "55555555",
    name: "asdf",
    date: new Date(),
  });
  await asdf.put("66666666.1", {
    id: "66666666",
    name: "asdf",
    date: new Date(),
  });

  console.log("asdf itorAll");
  await asdf.itorAll(console.log);
  console.log("asdf itorAll update");
  await asdf.itorAll((key, value, update: Function) => {
    console.log(key, value);
    if (key === "55555555.1") {
      console.log("itorAll update...");
      update({ id: "55555555", name: "itorAll update..." });
    }
  });
  console.log(await asdf.get("55555555.1"));
  console.log("itorAll update end...");

  console.log("asdf itorAllKeys");
  await asdf.itorAllKeys(console.log);
  console.log("asdf itorAllKeys update");
  await asdf.itorAllKeys((primaryKey, key, update: Function) => {
    console.log(primaryKey, key);
    if (primaryKey === "55555555.1") {
      console.log("itorAllKeys update...");
      update({ id: "55555555", name: "itorAllKeys update..." });
    }
  });
  console.log(await asdf.get("55555555.1"));
  console.log("itorAllKeys update end...");

  /*---------------------------------- */
  console.log("idxId itorAll");
  await idxId.itorAll(console.log, "55555555"); // 指定了索引的值
  console.log("idxId itorAllKeys");
  await idxId.itorAllKeys(
    console.log,
    IDBKeyRange.bound("55555555", "66666666", false, true)
  ); // 指定了索引的范围

  /*---------------------------------- */
  console.log("idxName itorAll");
  await idxName.itorAll(console.log);
  console.log("idxName itorAllKeys");
  await idxName.itorAllKeys(console.log);

  /*---------------------------------- */
  console.log("asdf getAll");
  console.log(await asdf.getAll());
  console.log(await asdf.getAll(IDBKeyRange.bound("1234", "4321"), 3));
  console.log("asdf getAllKeys");
  console.log(await asdf.getAllKeys());
  console.log(await asdf.getAllKeys(IDBKeyRange.bound("1234", "4321"), 3));
  console.log("asdf getKey");
  console.log(await asdf.getKey(IDBKeyRange.bound("1234", "4321")));

  /*---------------------------------- */
  console.log("idxId getAll");
  console.log(await idxId.getAll());
  console.log(
    await idxId.getAll(
      IDBKeyRange.bound("55555555", "66666666", false, true),
      3
    )
  );
  console.log("idxId getAllKeys");
  console.log(await idxId.getAllKeys());
  console.log(
    await idxId.getAllKeys(
      IDBKeyRange.bound("55555555", "66666666", false, false),
      3
    )
  );
  console.log("idxId getKey");
  console.log(
    await idxId.getKey(IDBKeyRange.bound("55555555", "66666666", false, false))
  );

  /*---------------------------------- */
  console.log("asdf count");
  console.log(await asdf.count());
  console.log(await asdf.count(IDBKeyRange.bound("1234", "4321")));

  /*---------------------------------- */
  console.log("idxId count");
  console.log(await idxId.count());
  console.log(
    await idxId.count(IDBKeyRange.bound("55555555", "66666666", false, true))
  );

  /*---------------------------------- */
  console.log("asdf clear");
  console.log(await asdf.clear());
}
