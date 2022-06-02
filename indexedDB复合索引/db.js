//indexDB是浏览器本地数据库,用于存储大量数据,存储格式为json
var db;
// 打开创建数据库:
function openDB(name, version = 1) {
    if (!window.indexedDB) {
        alert("您的浏览器不支持indexDB");
        return;
    }
    var indexDBRequest = window.indexedDB.open(name, version);
    indexDBRequest.onerror = function(e) {
        console.log("Open Error!");
    };
    indexDBRequest.onsuccess = function(e) {
        db = indexDBRequest.result; //这里才是 indexedDB对象
        console.log("创建/打开数据库成功。db:%o", db);
    };

    indexDBRequest.onupgradeneeded = function(e) {
        console.log("DB version change to " + version);
        db = indexDBRequest.result;
        // 有了数据库后我们自然希望创建一个表用来存储数据，但indexedDB中没有表的概念，而是叫 objectStore ，一个数据库中可以包含多个objectStore，objectStore是一个灵活的数据结构，可以存放多种类型数据。也就是说一个objectStore相当于一张表，里面存储的每条数据和一个键相关联。
        if (!db.objectStoreNames.contains("students")) {
            var store = db.createObjectStore("students", { keyPath: "id" });
            //删除objectStore
            // db.deleteObjectStore('storeName');

            // 创建索引
            // 在indexedDB中有两种索引，一种是自增长的int值，一种是keyPath：自己指定索引列
            store.createIndex("nameIndex", "name", { unique: true });
            store.createIndex("ageIndex", "age", { unique: false });

            // 1. 创建复合索引
            store.createIndex("id_age", ["id", "age"], { unique: false });
            console.log("第一次创建数据库或者更新数据库。db:%o", db);
        }
    };
}
window.onload = function() {
    openDB("dbname1");
};

function saveData(storeName, data) {
    //创建事务
    var transaction = db.transaction([storeName], "readwrite");
    //访问事务中的objectStore
    var store = transaction.objectStore(storeName);
    //data为对象
    var addRequest = store.add(data);
    addRequest.onsuccess = function(event) {
        console.log("save data done...", store);
    };

    addRequest.onerror = function(event) {
        console.log("数据写入失败", store);
    };
}
document.getElementById("add").onclick = function() {
    saveData("students", { id: "3", name: "张三3", age: 18 });
    saveData("students", { id: "1", name: "张三1", age: 27 });
    saveData("students", { id: "4", name: "张三4", age: 35 });
};
/** 通过 id 获取 age 的值
 * 通过构建聚合索引，根据其中一个索引值匹配另一个索引值（不会对indexedDB数据进行深拷贝，只获取索引的值） */
function getIndexByKey(indexName, indexRangeArr) {
    return new Promise((resolve) => {
        //创建事务
        var transaction = db.transaction(["students"], "readwrite");
        //访问事务中的objectStore
        var store = transaction.objectStore("students");
        const index = store.index(indexName);
        const indexRange = IDBKeyRange.bound(...indexRangeArr);
        const req = index.openKeyCursor(indexRange);
        req.onsuccess = function(ev) {
            const cursor = ev.target.result;
            if (!cursor) {
                resolve(null);
            } else {
                resolve({
                    key: cursor.primaryKey,
                    index: cursor.key,
                });
            }
        };
    });
}
document.getElementById("search").onclick = async function() {
    const id = document.getElementById("idInput").value;
    if (id) {
        const res = await getIndexByKey("id_age", [
            [id], // id_age 复合索引
            [id + "_"], // id_age 复合索引,id + '_'一定大于 id
            false, // 包含上下限
            false, // 包含上下限
        ]);
        console.log(
            "search resulte...",
            res,
            "年齡是...",
            res ? res.index[1] : res
        );
    } else {
        console.log("请选输入ID...");
    }
};