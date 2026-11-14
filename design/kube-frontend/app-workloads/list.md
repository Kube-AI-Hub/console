# 工作负载列表（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/list.md)

## 概述

八种负载共用一个列表组件 `WorkloadListPage`，由描述符区分标题、列与状态。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04`
- `prd/kube-frontend/app-workloads/list.md`

## 设计目标与非目标

让八种资源的列表在「列、状态、空态、agent 句柄」上只有一份实现，避免八份近似代码各自漂移。非目标：不做创建表单、不做列显隐。

## 关键约束

- `rowKey` 为 `name`；排序键用上游拼写 `name` / `createTime`。
- 状态列只在描述符 `showStatus` 为真时出现；就绪列只在 `showProgress` 为真时出现。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01 — 一个页面 + 描述符，而不是八个页面

**为什么**：八种资源的差异只有标题、列与状态映射。八份页面会让「空态文案」「批量删除」「agent 句柄」这类共性在校对时逐一漏掉——老 console 正是这样积累了三套不同的空态写法。

**被否方案**：为每种资源生成一个页面文件（更「直白」，但改动要乘八）。

**何时重新考虑**：出现与列表结构不同的资源（例如需要树形展示）时，单独成页。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02 — 名称用普通 `<a href>`，不强制走类型化 Link

**为什么**：页面详情与列表在同一个路由文件夹内，列表没有独立的路由 ID 可供类型化跳转；而 `<a href>` 保留了中键与 ⌘ 点击的行为，普通点击由布局的 `onNavigate` 转成客户端跳转。

**被否方案**：给详情建独立路由 ID 再用 `<Link>`。会让「同一页面的列表与详情」重新分裂成两个路由文件。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-04 - 容器组的节点与 IP 列取自对象本身

**为什么**：老 console 的容器组列表有「所在节点」「容器组 IP」两列，这正是排查「Pod 起来了但调度到哪」的第一个问题。两列都来自 Pod 对象（`spec.nodeName` / `status.podIP`），不需要额外请求。

**被否方案**：从关联工作负载推断节点。工作负载没有节点概念，Pod 才有。

**状态筛选为何不做**：kapis 资源代理忽略 `fieldSelector=status.phase=…`（实测返回 0 条），而列表统一走代理；放一个「选了就空」的控件比没有更糟。

## 系统现状

老控制台 `pages/projects/containers/{Deployments,StatefulSets,...}/index.jsx` 各自实现列表；新实现抽出一份，并由 `descriptor` 提供差异。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/WorkloadListPage.tsx`
- `apps/console-next/src/pages/app-workloads/queries.ts`（描述符、查询、manifest）
- 路由：`src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/<resource>/`

## 对外契约

读 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/<resource>`；删除走原生端点（按 API 组）。

## 不变量

- 同一种资源在列表与详情上的状态一定相同（同一个 `workloadStatus`）。
- 写操作的目标路径与资源所属 API 组一致。

## 已知坑

- **写路径前缀**：`/api/v1` 只服务核心组。Deployment/StatefulSet/DaemonSet 在 `apps/v1`，Job/CronJob 在 `batch/v1`，Ingress 在 `networking.k8s.io/v1`。第一版写死 `/api/v1`，导致这些资源的编辑 YAML 与重新部署全部 404。
- **kubectl 的 `readyReplicas` 缺失**：控制器还没写状态时该字段不存在，不能当 0 处理成「已停止」。

## 测试与可观测

- 单测：`api-client/test/workloads.test.ts`（状态分支）、`api-client/test/resources.test.ts`（API 组路由）。
- E2E：`tests/kube-frontend/app-workloads/`。

## 后续改进

- 创建/编辑信息的表单能力；扩缩容。
- 列显隐与列宽拖拽。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-02`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-03`
