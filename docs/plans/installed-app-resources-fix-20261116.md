# 应用实例详情「资源」页签：一个真实缺陷的定位与修复（2026-11-16 第 63 轮）

## 1. 缺陷

应用实例详情的**资源**页签永远显示「加载失败 · 资源不存在」，即使该实例明明有资源。

实测（临时安装的 mysql 实例）：

```
404 /kapis/resources.kubesphere.io/v1alpha3/clusters/default/namespaces/default/deployments?labelSelector=…
404 …/clusters/default/namespaces/default/statefulsets?…
404 …/clusters/default/namespaces/default/services?…
```

**`clusters/default/`** —— 把 OpenPitrix 的 **runtime id**（本部署为 `default`）当成了 KubeSphere 集群名。
正确的集群是 `host`。

## 2. 根因

`toInstalledRelease()` 把 `cluster.runtime_id` 映射成 `InstalledRelease.cluster`，页面又把它直接传给
`resources({ cluster })`，于是请求路径变成 `/clusters/<runtime_id>/…`。

## 3. 修复

集群名应当来自**路由**（`/clusters/$cluster/...`），不是 release 对象：

| 位置 | 改动 |
| --- | --- |
| `routes/…/applications/$releaseId.tsx` | 把路由参数 `cluster` 传进页面 |
| `InstalledAppDetailPage` | 新增可选 `cluster` 属性，`resources()` 用 `routeCluster || 'host'` |
| `packages/api-client` 的 `toInstalledRelease` | 保留 `runtime_id`（信息展示仍需要），加注释说明它**不是**集群名 |

修复后同一实例的资源页签：**3 行**（1 个 statefulset、2 个 service）+「显示列」按钮。

## 4. 因此新增的用例覆盖

`installed-app-resources` 这个列显隐键**没有**进入 `CONFIGMAPS-LIST-11`：验证它需要一个已安装实例，
而本部署**无法删除应用实例**——`DELETE` 返回 200 后对象仍在 `creating`/`created` 状态数分钟不消失。

**不能上线的用例**：会留下对象的用例违反「用例必须清理自己创建的对象」。已在用例里写明原因。

## 5. 遗留对象（如实登记）

定位过程中在 `system-workspace/default` 创建了两个临时实例，删除请求被接受但对象未消失：

| 名称 | release id | 状态 |
| --- | --- | --- |
| `tc-colvis-79029302` | `rls-llq4251xo33vmw` | `creating` |
| `tc-probe-a12e0f1c` | `rls-3vl27kvvvmm691` | `created` |

多次 `DELETE`（项目级与应用级两种路径）均返回 `{"message":"success"}`，但列表里始终存在。
这与其他环境受限项（tiller/helm 后端不可用）一致，需要人工或等后端恢复后清理。

## 6. 流程反思

| # | 规则 | 触发事故 |
| --- | --- | --- |
| 1 | **写操作前先确认「能不能撤销」** | 先装了实例，才发现删不掉；若先花一分钟验证删除，就不会留下两个对象 |
| 2 | **探针也要遵守用例的清理纪律** | 我的探针脚本直接创建对象，没有 `finally` 清理 |
| 3 | **404 要读完整路径再判断** | 起初怀疑是页面没渲染，实际是请求路径里带了 `clusters/default/`；抓一次网络请求就定位了 |
