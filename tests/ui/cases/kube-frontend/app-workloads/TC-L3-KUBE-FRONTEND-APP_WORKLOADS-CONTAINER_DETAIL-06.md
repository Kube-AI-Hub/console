# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-06 容器详情 · 生命周期区块

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `container-detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/container-detail.md`

## 产品功能

声明了 lifecycle 的容器在「资源状态」页签显示生命周期区块，分别列出 postStart 与 preStop 的类型（HTTP 请求 / TCP 端口 / 命令）与参数；未声明 lifecycle 时不显示该区块。

### 关联需求

- `prd/kube-frontend/app-workloads/container-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CONTAINER_DETAIL-06** — 已知容器声明了 lifecycle，当打开「资源状态」页签，则显示生命周期区块，分别列出 postStart 与 preStop 的类型（HTTP 请求 / TCP 端口 / 命令）与参数（路径、端口、scheme 或命令）；未声明 lifecycle 时不显示该区块。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/container-detail.md`](../../../../design/kube-frontend/app-workloads/container-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/container-detail.md`](../../../../prd/kube-frontend/app-workloads/container-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 单个容器为什么不正常 (Priority: P1)

作为 **项目成员**，我希望 **下钻到容器级别看它的配置与状态**，以便 **在容器组整体状态之外判断是镜像拉不到、探针失败还是资源不足**。

**Independent Test**：从容器组详情点容器名进入容器详情，核对其镜像、拉取策略、状态与该容器组对象一致。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个容器组：容器 main 声明 lifecycle.postStart=httpGet（路径、端口、scheme）与 preStop=exec（命令），另一个容器 plain 不声明 lifecycle；用例结束后无条件删除

## 测试步骤

1. 打开 main 容器详情，停在默认「资源状态」页签
2. 读 container-detail:lifecycle 区块与两个钩子行
3. 核对类型文案与参数与对象里的 lifecycle 逐项一致
4. 打开 plain 容器详情，确认没有 container-detail:lifecycle

## 期望结果

- 生命周期区块出现，含「启动后」（postStart）与「停止前」（preStop）两行
- postStart 行显示类型「HTTP 请求」与参数（scheme、路径、端口）
- preStop 行显示类型「命令」与命令行
- 未声明 lifecycle 的容器没有该区块

## 失败排查

- 区块缺失：lifecycle 读成了探针字段（livenessProbe 等）
- 类型显示成 httpGet：LIFECYCLE_TYPE_KEYS 没做文案映射
- 参数为空：只读了处理器名，没取 scheme/path/port 或 command

## 产品改版后如何更新自动化

- 句柄 container-detail:lifecycle 与 :lifecycle:<postStart|preStop>；派生见 api-client 的 containerLifecycleHooks
