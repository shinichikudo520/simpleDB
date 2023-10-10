### 表现形式

    indexedDB put api, 进入了 onsuccess 回调, 立即获取数据, 获取结果为 undefined

### 背景

### 原因: 超出浏览器的缓存限制

- 如果来源已超过其配额，则尝试写入 IndexedDB 将失败。系统会调用事务的 onabort() 处理程序，同时传递一个事件。该事件将在错误属性中包括 DOMException。检查错误 name 将返回 QuotaExceededError。

```
const transaction = idb.transaction(['aaa'], 'readwrite');
transaction.onabort = function(event) {
  const error = event.target.error; // DOMException
  if (error.name == 'QuotaExceededError') {
    // 此处为回退代码, 会抛出 QuotaExceededError 的错误
  }
};
```

- 可用以下代码确认是否超出限制

```
if (navigator.storage && navigator.storage.estimate) {
  const quota = await navigator.storage.estimate();
  // quota.usage -> 已用字节数。
  // quota.quota -> 最大可用字节数。
  const percentageUsed = (quota.usage / quota.quota) * 100;
  console.log(`您已使用可用存储的 ${percentageUsed}%。`);
  const remaining = quota.quota - quota.usage;
  console.log(`您最多可以再写入 ${remaining} 个字节。`);
}
```

### 解决方案

- 逐出如何运作？ 这意味着，indexdb 会自动清除缓存

  Web 存储分为两个存储桶：“最大努力”和“永久”。最大努力意味着浏览器可以在不中断用户的情况下清除存储，但对于长期或关键数据的持久性较差。当存储较少时，不会自动清除永久存储。用户需要手动清除此存储（通过浏览器设置）

- 存储空间配额太小
  存储空间配额小, 是因为之前装过 32 位的 chrome, 在某个配置文件里写入了这个限制, 后面即使升级到 64 位的 chrome, 这个限制也读的老的配置导致，这个配置, 并没有在清理缓存的功能管理下, 所以清理缓存也解决不了, 需要到用户的 AppData/Local/Google/, 删除 Chrome 文件夹, 彻底把旧的配置干掉, 重新初始化, 就没有问题了
