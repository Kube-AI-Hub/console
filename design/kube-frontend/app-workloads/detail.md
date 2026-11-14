# 负载详情（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/detail.md)

## 概述

共享详情组件 `WorkloadDetailPage`：属性、镜像、操作。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-JOB_RUNS-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATEFUL_SERVICE-01

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICE_PODS-01

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

### 页签体系

详情页内部的页签（概览 / 关联容器组 / 修订版本 / 事件 / 元数据，容器组为 概览 / 容器 / 事件 / 元数据）由 [详情页页签](../detail-tabs.md) 承接：页签集合由资源类型推导，数据留在页面顶层，切换页签只切面板。本节不重复其决策与契约。

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

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-06 — 关联容器组的名称是通往该容器组详情页的链接

**为什么**：看到某个 Pod 不正常之后，下一个问题一定是"它怎么了"——而答案在容器组详情页（专属属性、镜像、YAML），不在这个摘要表里。把它做成纯文本等于让读者自己复制名字再去寻址。

**被否方案**：整行可点。会与将来的行操作菜单冲突，且"点哪里都能走"在小屏幕上容易误触。

**何时重新考虑**：需要从摘要直接展开 Pod 详情时，改为行内展开面板。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-07 — 选择器有两种形状，必须分开读

**为什么**：工作负载的选择器是 `spec.selector.matchLabels = { k: v }`，而 **Service 的是扁平的 `spec.selector = { k: v }`**。按工作负载的形状去读服务，会得到空对象，于是"关联容器组"静默地列出 0 行——页面不报错，只是什么都不显示，最难排查的那类失败。

**被否方案**：无论类型都先取 `matchLabels`、为空再退回顶层。能work，但把"两种形状"这个事实藏进了回退逻辑，后来人看不出为什么。

**何时重新考虑**：出现第三种选择器形状（例如带 `matchExpressions`）时，改为按类型返回不同的构造器。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-08 — 关联服务按 `serviceName` 声明取，并显式报告"不存在"

**为什么**：有状态副本集不是"选择"服务，而是用 `spec.serviceName` **声明**一个服务来治理它的 pod DNS（`<pod>.<service>`）。因此这里不做选择器匹配——那会推测出一个对象并未声明的联系。

**关键点**：`serviceName` 可以指向一个**不存在**的服务，apply 不会失败，但 pod 拿不到 DNS 记录。这是常见配置错误且很难从症状反推。所以区块在找不到服务时显示「指向的服务 X 不存在」，而不是渲染一个空白区块——空白会被读成"没有关联服务"。

**被否方案**：服务不存在时不渲染区块。等于把"配置错了"和"没配置"混为一谈。

**何时重新考虑**：平台开始校验 `serviceName` 时。

### DEC-L3-KUBE-FRONTEND-APP-WORKLOADS-DETAIL-09 — 执行记录按 `job-name` 标签取 Pod，退出码取最大值

**为什么**：一个任务的历史就是它启动过的 Pod——每次重试是另一个 Pod，其 phase 与退出码正是"为什么失败"的答案。按 `job-name` 标签选中（任务控制器给每个 Pod 打这个标签），而不是按名字前缀匹配：前缀会误收名字开头相同的另一个任务。

退出码取各容器终止码的**最大值**：一个 Pod 里有多个容器时，任何一个非零都说明这次执行失败。

**已知限制**：Pod 可能已被清理（`ttlSecondsAfterFinished` 或集群的历史清理）。此时区块不显示——**这是事实，不是缺陷**：历史确实已经不在了，伪造一行比不显示更糟。

**何时重新考虑**：平台开始保留任务历史（例如写入日志系统）时，改为从那里读。
