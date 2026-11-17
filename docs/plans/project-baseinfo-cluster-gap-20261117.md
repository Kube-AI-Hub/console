# 项目基本信息页仍在读主集群（2026-11-17，未完成）

## 1. 已确认的事实

打开 `/kube-frontend/public/clusters/xc/projects/spaces/baseinfo`，抓到的请求：

```
/kapis/resources.kubesphere.io/v1alpha3/namespaces/spaces          ← 无集群段（host）
/api/v1/namespaces/spaces/resourcequotas                            ← 无集群段（host）
/kapis/clusters/xc/iam.kubesphere.io/v1alpha2/…/members             ← 正确
/kapis/clusters/xc/iam.kubesphere.io/v1alpha2/…/roles               ← 正确
```

**前两条读的是主集群**：在 `xc` 的项目基本信息页上，名称空间与配额都来自 host。

## 2. 本轮做过的改动（正确但未覆盖该页）

| 位置 | 改动 |
| --- | --- |
| `api-client/src/iam.ts` `projectInfoApi.get` | namespace 走 `clusterScoped`，quota 走 `corePath` |
| `api-client/src/iam.ts` `projectQuotaApi.list` | 增加 `cluster`，走 `corePath` |
| `api-client/src/iam.ts` `limitRangesApi.list` | 增加 `cluster`，走 `corePath` |
| 调用方 | `NamespaceDetailPage`、`ProjectOverviewPage` 传入 cluster |

`api-client` 37 文件 / 392 passed，`tsc` 0 错误，`vite build` ✓。

## 3. 为什么没生效

`baseinfo` 路由渲染的是 `settings/ProjectInfoPage`，但它发出的两条请求**并不来自** `projectInfoApi.get`
（否则 namespace 会带 `clusters/xc`）。也就是说该页另有读取路径，**本轮没有定位到**。

`projectQuotaApi.list` 我也改了签名，但 grep 没找到调用它的地方——说明这两条请求来自别处
（可能是页面内联的 `api.request` 或另一个未导出的小函数）。

## 4. 下一步（明确的定位方法）

在 `apps/console-next/src` 里搜 `/api/v1/namespaces/` 与 `resourcequotas` 的**页面级**用法：

```bash
grep -rn "api/v1/namespaces" apps/console-next/src --include=*.ts --include=*.tsx
```

本轮只查了 `pages/project` 与 `pages/settings` 的配额相关文件，漏掉了可能的内联请求。

## 5. 已知的能力边界（实测）

| 路径 | 结果 |
| --- | --- |
| `/api/v1/namespaces/spaces/resourcequotas`（host） | 200 |
| `/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/spaces/resourcequotas` | **404** |
| `/kapis/resources.kubesphere.io/v1alpha3/namespaces/spaces/resourcequotas`（host 的 kapis） | **404** |
| `/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/spaces/limitranges` | **404** |

即 **`resourcequotas` 与 `limitranges` 只能从 core 组读，而 core 组没有成员形态**——
成员集群上这两类数据**根本读不到**。所以正确行为只能是「明确告知不可用」，绝不能回退到 host。

## 6. 反思

| # | 规则 |
| --- | --- |
| 1 | **改 API 层不等于改了页面**：要抓请求确认页面真的走了新路径 |
| 2 | 页面可能内联拼路径，绕过 api-client——审计时**必须同时扫 apps/ 与 packages/**（C23） |
| 3 | 「读不到」与「读到了别人的」是两件事，前者可接受、后者不可 |
