# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02 集群概览 · 双栏、快捷入口与部分缺值

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

集群负载突出、入口属于当前集群，缺失监控不伪造零。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03** — 概览在1024/1280/1600视口优先显示资源总量/用量与排行，其后为基本信息、控制面、组件、模块和其他工具，不撑宽页面。节点/显卡/监控保持同集群快捷链接；kubectl点击一次原地打开终端，页面挂载不自动连接。代理未就绪集群保留接入说明。缺值/零分母显示 `-` 不画0%环，真实零显示0%，不以单节点代替集群用量。

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

- 已登录且可读取 B200 host 集群

## 测试步骤

1. 三档视口打开真实概览并截图，核对不横向溢出
2. 核对节点、GPU、监控和 kubectl 快捷链接
3. 捕获协调刷新请求，确认使用 cluster 指标而非 nodes 接口
4. 拦截集群监控，模拟真实零、缺失总量、零分母与缺失内存

## 期望结果

- 1024/1280/1600 身份侧栏和资源主栏可读且不撑宽页面
- 各快捷入口指向当前集群，未点击终端连接按钮不建立会话
- 真实零且分母有效显示 0%，缺值或零分母显示 - 且没有进度条
- 基本信息和模块保持可用，测试不发写请求

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
