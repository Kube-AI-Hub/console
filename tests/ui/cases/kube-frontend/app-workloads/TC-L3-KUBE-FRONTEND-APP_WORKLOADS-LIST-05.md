# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05 容器组列表 · 状态筛选（status=）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/list.md`

## 产品功能

容器组列表的状态筛选走 kapis 的 status=<Waiting|Running|Completed|Error>：四项齐全、选中后请求带 status=Running、行与总数只含该状态，清空后恢复全集。

### 关联需求

- `prd/kube-frontend/app-workloads/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST-05** — 已知容器组列表有数据，当在状态筛选里选「运行中」，则列表只显示状态为运行中的容器组，请求带 status=Running，总数与筛选一致；筛选项完整为「等待中 / 运行中 / 已完成 / 错误」四项；清空筛选后恢复全部。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/list.md`](../../../../design/kube-frontend/app-workloads/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/list.md`](../../../../prd/kube-frontend/app-workloads/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前项目有哪些负载、是否正常 (Priority: P1)

作为 **项目运维**，我希望 **在一屏内看到名称、状态与就绪副本**，以便 **判断是否需要介入**。

**Independent Test**：打开 `…/projects/default/deployments`，核对名称列、状态徽章、就绪计数与创建时间。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建两个「等待中」容器组（一个 nodeSelector 指向不存在的节点、一个镜像拉不下来），用例结束后无条件删除

## 测试步骤

1. 用 kapis 读三次 totalItems：不带筛选、status=Running、status=Waiting
2. 打开容器组列表，等列表就绪
3. 读取 pods:filter:status 的选项文案，核对四项齐全且顺序为 等待中 / 运行中 / 已完成 / 错误
4. 选中「运行中」，捕获这次列表请求的 URL 并核对带 status=Running
5. 核对行数等于 min(服务端 status=Running 的 totalItems, 该请求的 limit)，且每行都出现在服务端该筛选返回的容器组里
6. 改选「等待中」，核对行数与该状态 totalItems 一致，且本用例创建的两个容器组都在列表里
7. 改回「全部状态」，捕获请求 URL 核对不带 status，核对行数回到全集

## 期望结果

- 筛选控件 pods:filter:status 存在，选项完整：等待中 / 运行中 / 已完成 / 错误（另有「全部状态」）
- 选中「运行中」后请求 URL 含 status=Running，列表只显示运行中的容器组，行数与服务端同参数总数一致
- 选中「等待中」后本用例创建的两个等待中容器组都在列表里，行数与该状态总数一致
- 清空筛选后请求不带 status，行数恢复到全集

## 失败排查

- 选了筛选却空表：先 curl 同一端点确认 status 取值大小写；?fieldSelector=status.phase=… 实测 0 条，未知键（?phase=）同样静默返回空
- 行数与总数不一致：筛选被做成前端过滤当前页，或 totalItems 被当成切片后条数
- 控件不存在：列表 schema 只在 kind 为 pods 时挂 filters

## 产品改版后如何更新自动化

- 选项文案改 packages/locales 的 workloads.filter.status.*；句柄改 WorkloadListPage.tsx 的 statusFilterControl.aiId
