# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04 集群概览 · 组件分类、可见性与 kubeconfig 工具

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

概览组件入口和当前用户工具保留，配置缓存和权限隔离。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05** — 基本信息显示集群可见性；六类系统组件入口按当前集群和分类进入列表，可清除分类，详情保持同集群。kubectl 不自动连接；主动打开 kubeconfig 时只读当前用户/集群配置，显示安全提示并可下载 kubeconfig.yaml。关闭取消读取并清除敏感缓存，身份或集群变化不显示旧内容，403 不提供重试；不记录或截图凭据正文。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开集群先看整体是否正常 (Priority: P1)

作为 **集群管理员**，我希望 **进入集群的第一屏就能看到就绪状态、版本、节点数与资源用量**，以便 **不必先点进节点或监控才能判断这个集群能不能用**。

**Independent Test**：打开集群概览，核对「基本信息」与「资源用量」两块都渲染出真实值，且状态徽标与集群对象的 Ready 条件一致。

### US3 - 知道这个集群装了哪些可选模块 (Priority: P2)

作为 **集群管理员或支持人员**，我希望 **概览列出已启用与未启用的模块**，以便 **在排查页面不可用时确认配置开关，而不把开关误当成 API 安装证明**。

**Independent Test**：核对模块区分为「已启用」与「未启用（N）」两组，条目与集群对象 status.configz 一致。

## 前置与配置

- 已登录 B200 host，组件接口及用户 kubeconfig 可读

## 测试步骤

1. 对账可见性与六类组件数量，进入监控分类并清除过滤
2. 确认只有点击 kubeconfig 才读取当前用户配置，关闭不保留正文
3. 用非敏感模拟配置验证下载文件内容和再次打开重取
4. 拦截 403 验证没有重试或下载入口

## 期望结果

- 分类链接属于当前集群，列表按 namespace 过滤并可恢复全量
- 配置只读、提示明确；下载与 403 模拟和真实读取分别记录
- 不记录或截图真实配置正文，不发送 PUT/PATCH

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
