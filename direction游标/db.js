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
            var store = db.createObjectStore("students");
            //删除objectStore
            // db.deleteObjectStore('storeName');

            // 创建索引
            // 在indexedDB中有两种索引，一种是自增长的int值，一种是keyPath：自己指定索引列
            store.createIndex("id", "id", { unique: false });
            store.createIndex("id_time", ["id", "time"], { unique: true });
        }
    };
}
window.onload = function() {
    openDB("dbname1");
};

function saveData(storeName, key, data) {
    //创建事务
    var transaction = db.transaction([storeName], "readwrite");
    //访问事务中的objectStore
    var store = transaction.objectStore(storeName);
    //data为对象
    var addRequest = store.put(data, key);
    addRequest.onsuccess = function(event) {
        console.log("save data done...", store);
    };

    addRequest.onerror = function(event) {
        console.log("数据写入失败", store);
    };
}

function getList(storeName) {
    return new Promise((resolve) => {
        //创建事务
        var transaction = db.transaction([storeName], "readwrite");
        //访问事务中的objectStore
        var store = transaction.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = function(event) {
            resolve(req.result);
        };

        req.onerror = function(event) {
            resolve(null);
        };
    });
}

function getEarliest(storeName, query) {
    return new Promise((resolve) => {
        //创建事务
        var transaction = db.transaction([storeName], "readwrite");
        //访问事务中的objectStore
        var store = transaction.objectStore(storeName);
        const index = store.index("id_time");
        // next：游标中的数据按主键值升序排列，主键值相等(相同值)的数据都被读取

        // nextunique：游标中的数据按主键值升序排列，主键值相等(相同值)只读取第一条数据

        // prev：游标中的数据按主键值降序排列，主键值相等(相同值)的数据都被读取

        // prevunique：游标中的数据按主键值降序排列，主键值相等(相同值)只读取第一条数据
        const req = index.openKeyCursor(query, "nextunique"); // 键按降序排列, 所以最后一条是最早的数据
        req.onsuccess = function(event) {
            const cursor = req.result;
            const result = cursor ? cursor.primaryKey : null;
            resolve(result);
        };

        req.onerror = function(event) {
            resolve(null);
        };
    });
}

function getEarliest1(storeName, query) {
    return new Promise((resolve) => {
        //创建事务
        var transaction = db.transaction([storeName], "readwrite");
        //访问事务中的objectStore
        var store = transaction.objectStore(storeName);
        const index = store.index("id_time");
        // next：游标中的数据按主键值升序排列，主键值相等(相同值)的数据都被读取

        // nextunique：游标中的数据按主键值升序排列，主键值相等(相同值)只读取第一条数据

        // prev：游标中的数据按主键值降序排列，主键值相等(相同值)的数据都被读取

        // prevunique：游标中的数据按主键值降序排列，主键值相等(相同值)只读取第一条数据
        const req = index.openKeyCursor(query, "prevunique"); // 键按降序排列, 所以最后一条是最早的数据
        let result;
        req.onsuccess = function(event) {
            const cursor = req.result;
            if (cursor) {
                result = cursor.primaryKey;
                cursor.continue();
            } else {
                resolve(result);
            }
        };

        req.onerror = function(event) {
            resolve(null);
        };
    });
}

function getLastest(storeName, query) {
    return new Promise((resolve) => {
        //创建事务
        var transaction = db.transaction([storeName], "readwrite");
        //访问事务中的objectStore
        var store = transaction.objectStore(storeName);
        const index = store.index("id_time");
        // next：游标中的数据按主键值升序排列，主键值相等(相同值)的数据都被读取

        // nextunique：游标中的数据按主键值升序排列，主键值相等(相同值)只读取第一条数据

        // prev：游标中的数据按主键值降序排列，主键值相等(相同值)的数据都被读取

        // prevunique：游标中的数据按主键值降序排列，主键值相等(相同值)只读取第一条数据
        const req = index.openKeyCursor(query, "prevunique"); // 键按降序排列, 所以第一条是最晚的数据
        req.onsuccess = function(event) {
            const cursor = req.result;
            const result = cursor ? cursor.primaryKey : null;
            resolve(result);
        };

        req.onerror = function(event) {
            resolve(null);
        };
    });
}

function getLastest1(storeName, query) {
    return new Promise((resolve) => {
        //创建事务
        var transaction = db.transaction([storeName], "readwrite");
        //访问事务中的objectStore
        var store = transaction.objectStore(storeName);
        const index = store.index("id_time");
        // next：游标中的数据按主键值升序排列，主键值相等(相同值)的数据都被读取

        // nextunique：游标中的数据按主键值升序排列，主键值相等(相同值)只读取第一条数据

        // prev：游标中的数据按主键值降序排列，主键值相等(相同值)的数据都被读取

        // prevunique：游标中的数据按主键值降序排列，主键值相等(相同值)只读取第一条数据
        const req = index.openKeyCursor(query, "nextunique"); // 键按升序排列, 所以最后一条是最晚的数据
        let result;
        req.onsuccess = function(event) {
            const cursor = req.result;
            if (cursor) {
                result = cursor.primaryKey;
                cursor.continue();
            } else {
                resolve(result);
            }
        };

        req.onerror = function(event) {
            resolve(null);
        };
    });
}
document.getElementById("add").onclick = function() {
    getList("students").then(async(list) => {
        console.log("数据...", list);
        const earliestD = await getEarliest("students");
        console.log("最早的数据", earliestD);
        const lastestD = await getLastest("students");
        console.log("最后的数据", lastestD);
        const id = 1;
        const time = new Date().getTime();
        console.log("time...", time);
        saveData("students", [id, time], { id, time });
    });
};