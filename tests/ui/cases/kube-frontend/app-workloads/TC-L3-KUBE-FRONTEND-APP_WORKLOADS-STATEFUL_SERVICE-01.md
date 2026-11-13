# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATEFUL_SERVICE-01 有状态副本集详情 · 关联服务

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATEFUL_SERVICE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `stateful-service`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/statefulsets`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

有状态副本集详情按 spec.serviceName 显示关联服务（名称、类型、虚拟 IP、端口）；指向不存在的服务时显式报错。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-STATEFUL_SERVICE-01** — 已知一个有状态副本集的 `spec.serviceName` 指向一个存在的 headless 服务，当打开其详情，则显示「关联服务」区块，含服务名称、类型（Headless）、虚拟 IP（None）与端口；当 `serviceName` 指向不存在的服务，则该区块显示显式的错误提示而不是空白。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由夹具创建一个 headless 服务与一个指向它的有状态副本集，用例结束无条件删除两者
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该有状态副本集详情
2. 读取关联服务区块

## 期望结果

- 区块显示服务名称
- {'服务类型为 Headless（clusterIP': 'None）'}
- 端口列出

## 失败排查

- 区块不出现说明 spec.serviceName 为空
- 显示「不存在」提示说明夹具创建顺序有误（服务应先建）

## 产品改版后如何更新自动化

- 字段变化时改 api-client 的 toWorkloadService
