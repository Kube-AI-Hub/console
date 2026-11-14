# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05 集群概览 · Top5 九种排行与下钻分页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

首页全局 Top5 与完整页同源，排序维度、单位和范围不丢失。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06** — 首页 Top5 默认 GPU 显存利用率，九项指标（GPU 显存/GPU/GPU 分配/CPU/load1/内存/磁盘/inode/容器组利用率）可切换，按整个集群服务端降序取五项而非当前节点列表页排序。节点名链接详情并显示 IP、控制面标记；GPU 分配按卡数排序、按 allocated/total 显示比例，load1 不乘100，未知不填零。“查看更多”保留指标进入服务端分页完整排行，可搜索、排序、刷新及选择每页档位。

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

## 前置与配置

- B200 节点排行 type=rank 接口可读

## 测试步骤

1. 捕获真实 Top5 响应核对顺序、IP与详情链接
2. 切换全部九种指标并确认请求和单位
3. 查看更多确认指标保留，完整页与服务端当前页一致
4. 用十二个模拟节点核对五项截断、全局总数、翻页和缺值

## 期望结果

- 真实数据与模拟超过五节点分开，排序不是当前节点列表页的前五项
- load1 不乘100，GPU 分配按卡数排序但展示分配率
- 完整页分页/搜索/刷新可用；名称进入节点详情

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
