# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05 服务详情 · 端口表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/services`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

服务详情显示端口表（端口名、服务端口、容器端口、节点端口）；ClusterIP 服务的节点端口为 -；无端口的服务不显示该表。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-05** — 已知一个 ClusterIP 服务有端口 80→8080，当打开其详情，则显示端口表，列为端口名、服务端口、容器端口、节点端口，且服务端口为 80、容器端口为 8080、节点端口为 `-`。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由夹具创建一个 tc-e2e- ClusterIP 服务（80 → 8080），用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该服务详情
2. 读取端口表

## 期望结果

- 表头依次为 端口名、服务端口、容器端口、节点端口
- 服务端口 80、容器端口 8080、节点端口为 -

## 失败排查

- 表不出现说明 detail.ports 为空或 kind 不是 services
- 节点端口显示 0 说明应显示 -（ClusterIP 没有节点端口）

## 产品改版后如何更新自动化

- 端口字段变化时改 api-client 的 servicePortsOf
