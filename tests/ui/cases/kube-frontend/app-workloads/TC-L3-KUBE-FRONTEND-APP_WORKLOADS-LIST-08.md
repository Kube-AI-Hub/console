# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08 集群作用域容器组列表 · 状态筛选与节点下钻

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/pods`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

集群作用域的容器组列表（跨命名空间）与项目作用域共用一套口径：四项状态筛选走 kapis 的 status=，节点列显示节点名与节点 IP 并链接到该集群的节点详情，未调度显示「-」且不可点。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-08** — 已知集群作用域的容器组列表有数据，当在状态筛选里选「运行中」，则列表只显示状态为运行中的容器组（跨命名空间），请求带 status=Running，总数与筛选一致，筛选项完整为「等待中 / 运行中 / 已完成 / 错误」四项；「所在节点」列显示节点名与节点 IP 且是链接到该集群的节点详情，未调度的容器组该列显示「-」且不是链接；清空筛选后恢复全部。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 已登录，且在 host 集群（mlu370），admin 可跨命名空间读取容器组
- 由用例创建一个 nodeSelector 指向不存在节点的容器组（未调度），用例结束后无条件删除

## 测试步骤

1. 用集群作用域 kapis 端点读三次 totalItems：不带筛选、status=Running、status=Waiting
2. 打开 /kube-frontend/clusters/<cluster>/pods，等列表就绪
3. 读取 cluster-pods:filter:status 的选项文案，核对四项齐全且顺序为 等待中 / 运行中 / 已完成 / 错误
4. 选中「运行中」，捕获请求 URL，核对带 status=Running 且不含 namespaces/<ns> 段
5. 核对行数等于 min(服务端 status=Running 的 totalItems, 该请求的 limit)，且每行都出现在服务端该筛选结果里
6. 挑一个已调度的行，读 cluster-pods:node:<行名> 的文本与 href
7. 打开本用例创建的未调度行，读「所在节点」单元格并确认没有节点链接
8. 改回「全部状态」，核对请求不带 status、行数回到全集

## 期望结果

- 筛选控件存在且选项完整：等待中 / 运行中 / 已完成 / 错误（另有「全部状态」）
- 选中「运行中」后请求带 status=Running、跨命名空间，列表只显示运行中的容器组，行数与服务端同参数总数一致
- 已调度行的节点列同时含节点名与节点 IP，是链接且 href 以 /clusters/<cluster>/nodes/<node> 结尾
- 未调度行该列显示「-」且不是链接
- 清空筛选后请求不带 status，行数恢复到全集

## 失败排查

- 选了筛选却空表：取值大小写或键名错了；?fieldSelector=status.phase=… 实测 0 条，未知键同样静默返回空
- 跨命名空间读不到：端点写成了 /namespaces//pods（空命名空间）或用了项目作用域路径
- 行数与总数不一致：筛选被做成前端过滤当前页，或 placeholderData 让表格还停在上一次响应上
- 节点链接 404：href 拼成了 projects/<ns>/nodes/…；节点是集群作用域

## 产品改版后如何更新自动化

- 句柄 cluster-pods:filter:status / :node:<行名> / :reason:<行名>；见 ClusterPodsPage.tsx
