# 与旧 console 对照：应用实例的「集群」到底该怎么取（2026-11-16 第 65 轮）

> 上两轮把「把 OpenPitrix runtime id 当集群名」修掉了。本轮回到**旧 AGPL console 的源码**核对，
> 确认这个修法是不是与旧实现一致，还是我们有意偏离。

## 1. 旧 console 的做法

`src/stores/openpitrix/base.js`：

```js
getPath({ workspace, cluster, namespace }) {
  let path = ''
  if (workspace) path += `/workspaces/${workspace}`
  if (globals.app.isMultiCluster && cluster) path += `/clusters/${cluster}`
  if (namespace) path += `/namespaces/${namespace}`
  return path
}
```

**两条关键事实**：

1. **API 路径里的集群段只在多集群安装时才拼**，且用的是 `cluster`，**不是** `runtime_id`；
2. `runtime_id` 只出现在**显示与链接**里（`detail.cluster || detail.runtime_id`）。

## 2. 我们的做法

| 场景 | 旧 console | 新 UI |
| --- | --- | --- |
| 资源读取的集群段 | 多集群才拼 `clusters/<cluster>` | 集群为 `host` 时省略，否则拼 `clusters/<路由的 cluster>` |
| 「集群」显示 | `cluster \|\| runtime_id`（本部署显示 `default`） | 路由的控制台集群（`host`） |

**结论**：

- **API 路径**：与旧实现语义一致（都不是 runtime id，单集群都省略）。上两轮的修复不是「发明新行为」，
  而是把旧实现里本来正确的规则补回来；
- **显示**：**有意偏离**旧实现。旧 console 的标签也是「集群」，却显示运行时 id，同样会误导读者。
  我们用路由里的真实集群名，信息更准确；代价是看不到 `runtime_id`——本部署它恒为 `default`，无信息量。

## 3. 其余 id 映射复查

| 映射 | 依据 | 结论 |
| --- | --- | --- |
| `cluster.zone` → 命名空间 | 旧 console `getUrl({ namespace: zone })` 同样用 `zone` 当命名空间 | 一致，正确 |
| `cluster.cluster_id` → release 对象 id | 旧 console `getUrl({ cluster_id })` 用它拼 `/applications/<id>` | 一致，正确 |
| `runtime_id` → 集群名 | 旧 console **从不**把它放进 API 路径 | 曾用错，已修 |

## 4. 反思

| # | 规则 | 触发事故 |
| --- | --- | --- |
| 1 | **判断「这是不是 bug」时，先回旧实现核对语义**，再决定修还是保留 | 修完才想起可以查旧 console；查完才知道 API 路径部分本来就是旧实现的正确规则 |
| 2 | **有意偏离要在文档里写明「偏离了什么、为什么」** | 显示层与旧实现不同，若不记录，后来者会当成回退 |
