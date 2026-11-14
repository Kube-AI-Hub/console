# 集群作用域项目详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/namespace-detail.md)

## 概述

`/kube-frontend/clusters/<cluster>/namespaces/<name>`：集群项目列表行下钻的只读项目详情。基本信息来自命名空间对象，配额来自其 ResourceQuota，限额来自 LimitRange；另有跳转到项目作用域的快捷入口。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01

## 设计目标与非目标

目标：集群管理员不离开集群控制台即可看清项目的状态、标签与配额/限额；缺失项目有明确说明。
非目标：任何写操作、成员/角色列表、监控趋势。

## 关键约束

- 命名空间 + 配额：`projectInfoApi(api).get({cluster, namespace})`（resources 代理 + 核心组 `/api/v1/namespaces/<ns>/resourcequotas`）。
- LimitRange：`limitRangesApi(api).list({namespace})`（`/api/v1/namespaces/<ns>/limitranges`）。
- 缺失命名空间：resources 代理返回 **500**，正文 `namespace "<name>" not found`（不是 404）。
- 页面 URL 属集群作用域，无 workspace 段；跳转到项目作用域时才用 `kubesphere.io/workspace` 标签拼 workspace 段。
- 只读；B200 写类 webhook 故障，本页不触发任何写。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01 — 复用 projectInfoApi，并给 ProjectInfo 补 labels

**为什么**：`projectInfoApi` 已经把命名空间对象与 ResourceQuota 合成一次读取，配额口径与项目设置页完全一致；本页只缺 labels，给 `ProjectInfo` 增加一个 `labels` 字段（映射里本来就有 labels 局部变量）比在页面里再发一次同样的 GET 更小、更可复用。
**被否方案**：页面直接请求 resources 代理 + 自己拼配额。会与项目设置页出现两套配额映射。
**何时重新考虑**：`projectInfoApi` 拆成两个独立读取时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-02 — 缺失项目按消息识别，而不是按状态码

**为什么**：实测 `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<missing>` 返回 **500** 且正文是 `namespace "<name>" not found`。若只按 `ApiError.isNotFound` 判断，会把删除的项目显示成「服务端错误 + 重试」——重试永远不会成功。因此 `isNotFound` 或消息匹配 not found 才判定为缺失。
**被否方案**：把 500 一律当 not-found。会掩盖真实 500。
**何时重新考虑**：resources 代理修正为 404 后，可退化为状态码判断（保留消息兜底）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-03 — 三个读数各自独立，限额失败只降级本卡

**为什么**：LimitRange 在集群里常缺失或读权限不同；把三查询合并会导致「限额读不到 → 整个详情不可读」。基本信息与配额是页面主信息，必须独立成功。
**被否方案**：Promise.all 合并；失败统一整页错误。
**何时重新考虑**：页面主信息改为限额时。

## 系统现状

老 console 的集群项目列表行链接到项目控制台或项目详情（KubeSphere 3.x 的集群→项目→详情是项目控制台入口）。新 UI 的集群项目列表此前行无落点，平台侧虽有只读工作空间详情，但不覆盖集群管理员视角的命名空间对象与配额/限额。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/NamespaceDetailPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.$cluster/namespaces/$name.tsx`
- 列表入口：`pages/cluster/ClusterListPage.tsx` namespaces 分支的名称改为 `Link`（`data-ai-id=projects:link:<name>`）
- API：`packages/api-client/src/iam.ts` 的 `ProjectInfo` 增加 `labels`（其余不动）

## 对外契约

| 用途 | 路径 | 字段 |
| --- | --- | --- |
| 命名空间 | `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<name>` | `metadata.labels`、`metadata.creationTimestamp`、`status.phase` |
| 配额 | `/api/v1/namespaces/<name>/resourcequotas` | `spec.hard`、`status.used`（经 `projectInfoApi`） |
| 限额 | `/api/v1/namespaces/<name>/limitranges` | `spec.limits[].type/default/defaultRequest` |

## 不变量

1. 配额行数 = ResourceQuota `spec.hard` 键数；无配额显示空态。
2. 限额行数 = 所有 LimitRange 条目按 (type, resource) 展开数；无 LimitRange 显示空态。
3. LimitRange 读取失败不影响基本信息与配额。
4. 缺失命名空间显示 `:not-found`，不显示重试。
5. 页面不产生写请求。

## 已知坑

- **缺失命名空间是 500**：见 DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-02；错误面板的重试对缺失对象没有意义。
- **标签是数组渲染**：`labels` 可能含 `kubernetes.io/metadata.name` 等系统标签，全部展示（不做白名单，避免读者以为项目没有标签）。
- **workspace 标签同时存在两种键**：`kubesphere.io/workspace`（归属）与 `kubesphere.io/namespace`（项目名），跳转只用前者。
- **集群级列表慢**：31 个命名空间的列表在共享环境可达数十秒，列表→详情的用例要留足 timeout，不重试循环。
- **配额/限额为空是常态**：B200 全部命名空间都没有 ResourceQuota/LimitRange，空态分支是主路径，不能被当成失败。
- **LimitRange 条目展开**：一个 LimitRange 条目可按 type（Container/Pod）与资源展开成多行；页面逐行显示 default request/limit，缺项显示 `-`。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01.yaml`
可观测点：列表 `projects:link:<name>`；详情 `namespace-detail:surface/title/name/status/labels/quota/quota-empty/limits/limits-empty/limits-table/not-found/back`。

## 后续改进

- 删除项目、编辑配额/限额（需写路径恢复）。
- 项目成员/角色摘要（需 IAM 命名空间集合）。
- 若 resources 代理把缺失对象改为 404，可简化 not-found 判断（见 DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-02）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NAMESPACE_DETAIL-01
