# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICES-01 服务 · 端口列与编辑端口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `services`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/services`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

服务列表显示端口；「编辑服务」可改端口并保留端口名；ExternalName 服务不提供该操作。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICES-01** — 已知一个 ClusterIP 服务有端口 80→8080，当在列表看到端口列并用「编辑服务」改为 8080，则 `spec.ports` 只剩一个端口、`port` 为 8080、端口名仍为 `http`；当服务类型是 `ExternalName`，则行操作中不出现「编辑服务」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具创建一个 ClusterIP 类型、端口 80→8080 的 tc-e2e- 服务，用例结束无条件删除
- 另建一个 ExternalName 服务用于核对入口是否隐藏
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开服务列表，读取该行的端口列
2. 打开行操作，读取条目
3. 点「编辑服务」，把端口改为 8080 并确认
4. 用 API 核对 spec.ports
5. 对 ExternalName 服务打开行操作

## 期望结果

- 端口列显示 80→8080
- 行操作含「编辑服务」
- 修改后 spec.ports 只剩一个端口且 port 为 8080，端口名仍为 http
- ExternalName 服务的行操作不含「编辑服务」

## 失败排查

- 端口没变时确认发送的是完整端口列表（merge patch 对数组是整体替换）
- 端口名丢失说明提交时没有沿用原有名称

## 产品改版后如何更新自动化

- 服务字段变化时改 api-client 的 servicePortsOf
