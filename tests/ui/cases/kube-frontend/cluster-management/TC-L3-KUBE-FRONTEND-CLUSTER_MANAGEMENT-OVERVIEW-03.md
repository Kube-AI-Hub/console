# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03 集群概览 · 六类资源与调度标签对账

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

完整资源用量与 scheduler 三种结果分别展示，不因同名卡片而漏字段。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04** — 资源用量保留 GPU 显存、GPU 实际使用、CPU、内存、容器组、磁盘六类及新增节点就绪率；每类有使用/总量和比例，GPU/CPU/内存分配量独立显示，GPU 数量允许小数。显存/磁盘为 bytes，按 GiB/TiB 显示；缺失不填零。Kubernetes 状态保留 scheduled 和 error，并额外保留 unschedulable，按 result 标签对账，不能互相替代。

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

### US4 - 没有监控后端时页面仍然可用 (Priority: P2)

作为 **集群管理员**，我希望 **监控缺失只影响用量面板并明确说明**，以便 **仍然能看到版本、就绪状态与模块信息**。

**Independent Test**：在监控接口返回失败的环境下打开该页，核对基本信息与模块区正常渲染，用量面板显示「监控数据不可用」而不是 0。

## 前置与配置

- B200 host 监控接口可读

## 测试步骤

1. 捕获页面同次 cluster 和 scheduler 响应
2. 对账 GPU 显存、GPU 实际用量与分配、CPU、内存、容器组、磁盘
3. 逐项对账 scheduled、error 与 unschedulable
4. 三档视口截图并检查页面不横向溢出

## 期望结果

- 六类资源有分子分母及正确单位，GPU 数量保留小数
- 使用量不等于分配量，error 不等于 unschedulable
- 缺值不显示为零，真实零仍可展示

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
