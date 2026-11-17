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

## 3. 更正：改动其实生效了，是我探到了旧构建

上一版这里写着「页面另有读取路径，本轮没有定位到」——**这是错的**。重新探一次（等构建完成后再探）：

```
REQ /kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/spaces
REQ /kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/spaces/resourcequotas
REQ /kapis/clusters/xc/iam.kubesphere.io/v1alpha2/namespaces/spaces/members
REQ /kapis/clusters/xc/iam.kubesphere.io/v1alpha2/namespaces/spaces/roles
```

四条请求**全部带 `clusters/xc`**。上一次看到 host 路径，是因为探针跑在构建完成之前——
浏览器拿到的还是旧 chunk。

页面渲染也印证了：名称空间是 `xc` 的（创建时间 2026-11-12 12:34:36），成员 0 / 角色 6 / 服务账号 3 也都是
`xc` 的数字，不是 host 的。

### 第三种状态（已补）

原先成员集群上配额一段显示「该项目没有设置资源配额」——把「读不到」渲染成了「没有」。
现在 `ProjectInfo` 多一个 `quotaUnavailable` 字段，页面据此渲染两句话之一：

| 场景 | 文案 |
| --- | --- |
| 读到了但没有配额对象 | 该项目没有设置资源配额。 |
| **读不到**（成员集群） | 无法读取该集群的资源配额：成员集群暂不支持读取配额对象。**这不代表没有设置配额。** |

实测：`xc` → `quota-unavailable`=1 / `empty`=0；`host` → `unavailable`=0 / `empty`=1。

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
