# 负载详情（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/detail.md)

## 概述

共享详情组件 `WorkloadDetailPage`：属性、镜像、操作。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-PODS_BLOCK-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-04

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02`
- `prd/kube-frontend/app-workloads/detail.md`

## 设计目标与非目标

详情与列表同属一个功能区：页签、工作区栏、面包屑都不重建。非目标：不做扩缩容表单。

## 关键约束

- 路由 `…/<resource>/:name`；对象名来自路由参数。
- 属性只取对象本身，不额外请求列表。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01 — 详情页与列表同文件夹、由 `route.tsx` 渲染子路由

**为什么**：文件式路由里 `<page>.tsx` 会成为 `<page>.$name.tsx` 的父路由；父路由不渲染 `<Outlet/>` 时，详情 URL 会显示列表。把三件套（`route/index/$name`）固定在一个文件夹，`route.tsx` 只做 `<Outlet/>`，这条规则就不会被下一次改动破坏。

**被否方案**：列表页里用 `pathname` 正则判断「末尾有没有名称」。可行但把路由职责塞进页面，且每个页面都要重复一遍。

**何时重新考虑**：不需要——这是路由结构问题，不是页面问题。

## 系统现状

老 console 每个资源各有一份 Detail 目录（`Secrets/SecretDetail` 等），结构相同、字段不同。

## 仓库落点

- `apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx`
- 路由：每个资源文件夹下的 `$name.tsx`

## 对外契约

详情读 `GET /kapis/.../namespaces/<ns>/<resource>/<name>`。

## 不变量

- 详情的状态与列表一致。
- 面包屑末级是对象名。

## 已知坑

- 详情页的 `useBackTo` 从当前 URL 推导列表地址：对象名可能含 `/` 之外的字符，不能靠字符串替换。

## 测试与可观测

- E2E：`TC-…-DETAIL-01/02`。

## 后续改进

- 扩缩容、编辑信息、日志与终端。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-02`

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-02 — 专属属性由 mapper 产出「标签键 + 值」，页面只渲染

**为什么**：容器组与服务各有 5–6 个专属属性，若写在页面里就是六处 `kind === 'pods' ? … : kind === 'services' ? …` 的分支。改为 `kindAttributes()` 返回 `{key, value}[]`，页面只负责翻译标签与渲染空值。新增一种资源时，只改 mapper。

**被否方案**：每个 kind 一个详情组件。八份近似的属性表，改一处字段要改八处。

**何时重新考虑**：某类资源的详情布局与其它差别大到无法共用同一张属性表时（例如需要嵌入图表）。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-03 — 自动伸缩按项目列出后本地匹配，无 HPA 时不渲染区块

**为什么**：HPA 通过 `scaleTargetRef` 指向目标，Kubernetes 没有反向索引（"这个部署的 HPA 是谁"），只能列出项目的 HPA 再比对。一个项目的 HPA 是几条，代价可接受；而为一个区块引入 watch 或额外索引不值得。

**被否方案**：给 HPA 名字约定 `<workload>-hpa` 再直接 GET。名字约定不是 API 契约，别人的 HPA 未必遵守。

**何时重新考虑**：项目内 HPA 数量增长到分页仍可观时，改为按标签选择器过滤。

**另一条**：没有 HPA 时**不渲染区块**，而不是渲染「未配置」。后者会在每个工作负载上都占一行，而绝大多数工作负载本来就没有自动伸缩。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-04 — 端口表只在服务上出现，节点端口缺省显示 `-`

**为什么**：端口表回答"流量怎么进来"，只有 Service 有这个结构。对部署显示一张空表是噪音。而 `nodePort` 只在 NodePort/LoadBalancer 上存在——显示 `0` 是在陈述"节点端口是 0"，与事实不符；`-` 才是"没有这个字段"。

**被否方案**：所有资源类型都渲染端口区块，无端口时显示「暂无端口」。会让七个无关页面各多一块。

**何时重新考虑**：需要按端口做连通性诊断时，另建诊断视图。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-05 — 关联容器组按**选择器**取，不按名字前缀猜

**为什么**：Deployment/StatefulSet/DaemonSet 用 `spec.selector.matchLabels` 声明"哪些 Pod 是我的"，这是 API 契约；而 `<workload>-<hash>-<suffix>` 只是命名约定，别人的 Pod 也可能叫这个名字。因此没有选择器的类型（Job、CronJob、裸 Pod）**不显示该区块**，而不是退化成猜名字。

**被否方案**：按名字前缀匹配。会漏掉改名后的 Pod，也会误收同名前缀的其它对象。

**何时重新考虑**：Job/CronJob 需要展示其 Pod 时，用 `job-name` 标签（那是它们的选择器）。

**另一条**：列表每 15 秒刷新。Pod 会被替换，静态列表会显示已经不存在的 Pod——比没有列表更误导。
