# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06 集群概览 · 资源排行优先、字段对齐与主题边框

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

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07** — 资源区仅保留显存/GPU/CPU/内存/容器组/磁盘六类，统一五字段栅格；节点总量、就绪数量和就绪率移到排行左侧，不显示或请求节点历史趋势，宽屏与右侧排行约1:2。节点块在同一槽内纵向铺满：头部与排行头部等高（含排行指标下拉时不低于 60px），正文把就绪率环图与就绪/总量数字作为同一组内容在块内垂直居中，环心显示就绪率，数字右侧配进度条与「查看全部节点」文字链接，块内不出现按钮；缺值时就绪率显示 `-` 且不画进度条。基本信息与Kubernetes状态默认相邻可见，宽度及左边界与节点数block对齐。常用运维入口四项同宽同高、图标和文字左对齐且间距一致。无分配字段留空、未知不填零，健康与压力色分开，GPU无额外compute利用率行；三档及深浅/色调/中英文无裁剪溢出，动画服从减弱动画偏好。

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

1. 核对资源和排行位于辅助信息之前，Kubernetes状态紧随辅助列基本信息
2. 核对资源区没有节点卡，节点数与排行同一行且宽度约1:2
3. 核对节点总量、就绪数量和就绪率保留，没有节点趋势或时间窗
4. 核对基本信息/Kubernetes状态与节点数左边界及宽度一致
5. 核对四个常用运维入口同宽同高、图标和文字起始位置及基线一致
6. 在 1024/1280/1600 核对资源字段相对位置并截图
7. 确认没有分配字段的卡片留空，GPU 没有额外利用率行
8. 比较概览各区块与节点属性区计算出的主题边框颜色
9. 核对共享图标和 Top5 进度图表存在

## 期望结果

- 名称、已使用、总量、比例和分配区域整齐对齐，页面无横向溢出
- 未上报不补零，删除冗余行不影响实际使用率和分配量
- 区块边框和主题一致，图标不替代文字或引入新数据口径

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
