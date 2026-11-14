# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06 集群概览 · 字段对齐、左列状态与主题边框

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

区块层次和固定字段栅格提高扫读效率，不改变数据含义。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07** — Kubernetes 状态位于左列基本信息正下方，模块仍在该列；右列为资源、排行、组件和工具。资源卡统一名称、已使用、总量、使用率、已分配的栅格位置，无分配字段留空不显示标签，真实零仍显示，未知值不伪造为零。移除 GPU 卡额外利用率行；图标、进度条及 Top5 小条形图来自共享 ai-kit，图标不替代文字。全部区块使用与节点详情一致的 border-ai-line/bg-ai-surface-1，1024/1280/1600 下字段对齐且不撑宽页面。

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

## 前置与配置

- 已登录 B200 host，概览和 gpu02 节点详情可读

## 测试步骤

1. 核对 Kubernetes 状态紧随左列基本信息
2. 在 1024/1280/1600 核对资源字段相对位置并截图
3. 确认没有分配字段的卡片留空，GPU 没有额外利用率行
4. 比较概览各区块与节点属性区计算出的主题边框颜色
5. 核对共享图标和 Top5 进度图表存在

## 期望结果

- 名称、已使用、总量、比例和分配区域整齐对齐，页面无横向溢出
- 未上报不补零，删除冗余行不影响实际使用率和分配量
- 区块边框和主题一致，图标不替代文字或引入新数据口径

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
