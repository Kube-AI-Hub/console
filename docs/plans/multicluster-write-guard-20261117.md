# 成员集群的写操作：一个数据安全缺陷（2026-11-17）

> 在 A100 的成员集群 `xc` 上做写入验证时发现：**从 `xc` 的页面创建的配置字典，落到了 `host` 集群。**
> 本轮把它从「静默写错集群」改成「明确拒绝」，并清理了误建的对象。

## 1. 现象（实测）

在 `/kube-frontend/public/clusters/xc/projects/spaces/configmaps` 点「创建」，填名称提交：

- 弹窗关闭，看起来成功；
- 随后详情读取请求是 `GET /api/v1/namespaces/spaces/configmaps/<name>` → **404**；
- 在两个集群上分别列举：

```
xc   tc-mc present: []
host tc-mc present: ['tc-mc-fba5a823', 'tc-mc-53f40ceb']
```

**两个对象都建在了主集群**，而读者当时看的是成员集群。

## 2. 根因

`packages/api-client/src/configmaps.ts` 的注释里已经写着实测结论：

> `POST /kapis/.../configmaps` → 405，`POST /api/v1/.../configmaps` → 201

即**写只能走 core 组**，而 core 组没有成员集群形态（`/api/v1/clusters/xc/...` → 404）。
于是写路径里的 `cluster` 参数被静默丢弃，请求永远打向 host。

## 3. 修复：能写的照写，不能写的明确拒绝

新增 `coreWritePath(cluster, rest)`：

- `host` → `/api/v1/<rest>`；
- 成员集群 → **抛错**，消息说明「该资源暂不支持在成员集群上从控制台写入：ks-apiserver 的 core 组没有成员集群形态，写入会落到主集群」。

`resources.ts` 的 `writePath` 再区分一次：

- 分组资源（`/apis/<group>/...`，如 ingresses、jobs、cronjobs）→ `clusterScoped`，**成员集群可写**；
- core 资源（`/api/v1`）→ `coreWritePath`，成员集群拒绝。

`ResourceForm` 本来就会把提交抛出的错误显示在表单上，所以读者看到的是原因，不是静默失败。

## 4. 清理

两个误建对象已删除（`DELETE /api/v1/namespaces/spaces/configmaps/<name>` → 200），复核：
`remaining: []`。

顺带确认：**kapis 代理不支持 DELETE**（405），删除只能走 core 组——这也是「成员集群写不了 core 资源」的另一面。

## 5. 验证

| 项 | 结果 |
| --- | --- |
| 修复后再走同一创建流程 | `new on host: []`（修复前会新增对象） |
| 守卫消息是否随包发布 | 构建产物 `app-shared-E-DU1dlb.js` 内含该消息 |
| api-client 测试 | 36 文件 / 379 passed |
| console-next tsc | 0 |

**UI 侧的取证到此为止**：配置字典与保密字典的创建都是两步表单，脚本走到第二步时找不到提交句柄
（`configmaps:create-submit` / `secrets:create-submit` 在未填数据时并不渲染），所以没有截到错误提示的画面。

## 5b. 改用单测固化这条规则（本轮补上）

与其继续和对话框的步骤较劲，把规则写成测试更可靠——而且它能防止回归：

`packages/api-client/test/member-cluster-paths.test.ts`（5 条）：

| 断言 | 内容 |
| --- | --- |
| 段位置 | `clusterScoped` 把 `clusters/<id>` 放在 group 之前；`host`/空值保持原路径 |
| core 读 | 成员集群的 core 读改走 kapis 代理 |
| **core 写** | `host` 返回 `/api/v1/...`；成员集群**抛错** |
| 分组写 | `/apis/<group>` 的写在成员集群上仍走 `clusterScoped`（受支持） |
| **不发请求** | `configMapsApi.create(..., 'xc')` 直接拒绝，且**一条请求都没发出** |

**负向验证**：把守卫的 `if` 改成 `if (false)` 后，5 条里**恰好 2 条失败**（core 写 + 不发请求），
恢复后全绿。这证明测试真的在盯着这条规则，而不是碰巧通过。

## 6. 反思

| # | 规则 |
| --- | --- |
| 1 | **写操作必须先确认它落在哪个集群**：读对了不代表写对了 |
| 2 | **不能实现的操作用「拒绝 + 说明」，绝不用「打到默认集群」** |
| 3 | 写验证要同时列举**两个集群**，只看当前页面的列表会被自己的乐观刷新骗过 |
