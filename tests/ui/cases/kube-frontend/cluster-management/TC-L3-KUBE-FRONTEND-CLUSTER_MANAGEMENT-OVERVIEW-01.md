# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01 集群概览 · 基本信息、用量、控制面与模块

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

集群落地页显示集群身份、资源用量、Kubernetes 状态与已启用模块；监控不可用时只有用量面板降级。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01** — 已知已登录且对集群有读取权限，当打开集群概览页，则「基本信息」显示状态徽标（就绪时「运行正常」并附条件消息）、供应者、Kubernetes 版本、Kube AI Hub 版本、节点数、连接方式、API 端点与描述；「已启用模块」列出 status.configz 中为真的模块、「未启用」列出为假或缺失的模块，不代表 API 未安装；页面不出现项目工作区栏。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02** — 已知集群存在且监控后端可用，当查看「资源用量」，则 CPU、内存、容器组、节点各显示已使用、总量与使用率，CPU 与内存额外显示已分配；集群有 GPU 时显示 GPU 实际使用、总数和独立已分配量，不再附加 GPU 利用率文本行；当监控接口不可用时，用量面板显示监控不可用说明而不是 0 或空白，基本信息与模块区不受影响。Kubernetes 状态保留请求速率、延迟、scheduled/error/unschedulable 五字段。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开集群先看整体是否正常 (Priority: P1)

作为 **集群管理员**，我希望 **进入集群的第一屏就能看到就绪状态、版本、节点数与资源用量**，以便 **不必先点进节点或监控才能判断这个集群能不能用**。

**Independent Test**：打开集群概览，核对「基本信息」与「资源用量」两块都渲染出真实值，且状态徽标与集群对象的 Ready 条件一致。

### US2 - 判断「有没有空间」而不是只看百分比 (Priority: P1)

作为 **集群管理员**，我希望 **已使用、总量、使用率和已分配各自对齐呈现**，以便 **区分「跑得满」和「申请满了但实际很闲」——后者意味着新 Pod 调不进来**。

**Independent Test**：核对 CPU、内存卡分别出现已使用、总量、使用率与已分配字段，且数值与监控接口返回一致；不存在合并斜杠文本的依赖。

### US3 - 知道这个集群装了哪些可选模块 (Priority: P2)

作为 **集群管理员或支持人员**，我希望 **概览列出已启用与未启用的模块**，以便 **在排查页面不可用时确认配置开关，而不把开关误当成 API 安装证明**。

**Independent Test**：核对模块区分为「已启用」与「未启用（N）」两组，条目与集群对象 status.configz 一致。

### US4 - 没有监控后端时页面仍然可用 (Priority: P2)

作为 **集群管理员**，我希望 **监控缺失只影响用量面板并明确说明**，以便 **仍然能看到版本、就绪状态与模块信息**。

**Independent Test**：在监控接口返回失败的环境下打开该页，核对基本信息与模块区正常渲染，用量面板显示「监控数据不可用」而不是 0。

## 前置与配置

- 已登录，且对集群 host 有读取权限
- 集群对象 /kapis/cluster.kubesphere.io/v1alpha1/clusters/host 可读
- KubeSphere 监控 API 可用（不可用时该用例按监控缺失分支断言）

## 测试步骤

1. 用 API 读取集群对象与集群指标，记下供应者、Kubernetes 版本、节点数、CPU 总量、GPU 总量、模块集合
2. 打开集群概览页，等待 data-ai-state 不再是 loading
3. 核对基本信息各字段与集群对象一致
4. 核对已启用模块数与 configz 中为真的项数一致
5. 核对资源用量：CPU/内存/容器组/节点均独立显示已使用、总量和使用率；有 GPU 时显示实际使用、总数及独立已分配量，无额外利用率文本行
6. 核对 Kubernetes 状态五个独立标签数字存在

## 期望结果

- 供应者、Kubernetes 版本、节点数与接口一致
- 基本信息标签为「Kube AI Hub 版本」，不是「KubeSphere 版本」；数值与 status.kubeSphereVersion 一致
- 状态徽标在 Ready 条件为 True 时显示「运行正常」
- 已启用模块数与 configz 一致；未启用模块不与已启用混排，不推断 API 安装状态
- 用量行同时出现已用、总量与百分比三个要素
- 监控不可用时用量面板显示「监控数据不可用」，且基本信息与模块区仍然渲染
- 页面不出现 workspace-bar

## 失败排查

- 页面空白：先确认 /kapis/cluster.kubesphere.io/v1alpha1/clusters/<id> 是否可读
- 用量全为 0：检查 metrics_filter 的 $ 与 | 编码，以及 toMetricValues 是否读到 results[].data.result[0].value[1]
- 无法调度恒为 0：scheduler_schedule_attempts 按 labels.result 分多条，需按 result 取值
- 模块数与 configz 不一致：检查是否按白名单过滤了未知键

## 产品改版后如何更新自动化

- 字段变化时改 pages/cluster_management.py 与 ClusterOverviewPage.tsx 的 cluster-overview:* 标识
