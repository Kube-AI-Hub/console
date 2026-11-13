# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03 负载详情 · 容器组与服务的专属属性

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/spaces/pods`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

容器组详情显示节点、IP、QoS 与重启次数；服务详情显示类型、虚拟 IP、选择器与会话亲和性。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-03** — 已知打开一个容器组的详情，则属性含状态、所在节点、容器组 IP、节点 IP、QoS 等级与重启次数；已知打开一个服务的详情，则属性含服务类型、虚拟 IP、外部地址、选择器与会话亲和性。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 已登录，且在 host 集群的 spaces 项目空间（该项目有容器组与服务）

## 测试步骤

1. 打开容器组列表并进入任一容器组的详情
2. 读取属性名
3. 打开服务列表并进入任一服务的详情
4. 读取属性名

## 期望结果

- 容器组详情的属性含 状态、所在节点、容器组 IP、节点 IP、QoS 等级、重启次数
- 服务详情的属性含 服务类型、虚拟 IP、外部地址、选择器、会话亲和性

## 失败排查

- 属性缺失时看 api-client 的 kindAttributes 是否覆盖该 kind
- 值为空显示 - 属正常（例如未分配外部地址）

## 产品改版后如何更新自动化

- 属性增减时改 prd/design 的字段表与 kindAttributes
