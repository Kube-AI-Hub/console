# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10 集群概览 · 密集属性表与节点块铺满

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

概览的信息块用行式属性表提高密度，节点块铺满槽位，两者都不改变字段含义。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-11** — 基本信息与 Kubernetes 状态使用同一套行式属性表：每行一条字段，标签在左列（14px、中等字重、主色），值在右列（12px、次色），标签是行里更大的一半；字段之间以 1px 主题分隔线相连且分隔线横跨标签列与值列（两半在同一 y，不出现错位断线）；状态与可见性把说明文字并入值节点，不另起一行标签。两块合计高度在同一视口下比改动前的单列堆叠下降至少 40%，1024/1280/1600 三档下标签不换行、值可换行，两块标签列起点一致且值列起点一致（相邻行偏差小于 2px），标签与值的计算色在深浅两主题下均达到 4.5:1。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07** — 资源区仅保留显存/GPU/CPU/内存/容器组/磁盘六类，统一五字段栅格；节点总量、就绪数量和就绪率移到排行左侧，不显示或请求节点历史趋势，宽屏与右侧排行约1:2。节点块在同一槽内纵向铺满：头部与排行头部等高（含排行指标下拉时不低于 60px），正文把就绪率环图与就绪/总量数字作为同一组内容在块内垂直居中，环心显示就绪率，数字右侧配进度条与「查看全部节点」文字链接，块内不出现按钮；缺值时就绪率显示 `-` 且不画进度条。基本信息与Kubernetes状态默认相邻可见，宽度及左边界与节点数block对齐。常用运维入口四项同宽同高、图标和文字左对齐且间距一致。无分配字段留空、未知不填零，健康与压力色分开，GPU无额外compute利用率行；三档及深浅/色调/中英文无裁剪溢出，动画服从减弱动画偏好。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开集群先看整体是否正常 (Priority: P1)

作为 **集群管理员**，我希望 **进入集群的第一屏就能看到就绪状态、版本、节点数与资源用量**，以便 **不必先点进节点或监控才能判断这个集群能不能用**。

**Independent Test**：打开集群概览，核对「基本信息」与「资源用量」两块都渲染出真实值，且状态徽标与集群对象的 Ready 条件一致。

### US5 - 优先定位资源压力并查看变化 (Priority: P1)

作为 **集群运维人员**，我希望 **先看资源总量/用量和节点排行，并切换资源趋势**，以便 **快速定位压力与异常节点**。

**Independent Test**：资源和排行先于身份信息；切换资源与1h/6h/24h，趋势与同次历史响应对账；默认30秒更新，可暂停，隐藏页面不继续轮询。

## 前置与配置

- 已登录 B200 host，概览可读且监控可用

## 测试步骤

1. 打开集群概览并等待就绪，记录基本信息与 Kubernetes 状态两块高度之和
2. 逐行读取基本信息：标签列宽、标签字号、值字号与两侧计算色
3. 核对每行之间有 1px 主题分隔线，且首行不出现重复边框
4. 逐行读取 Kubernetes 状态五个字段，核对标签列与值列起点和基本信息一致
5. 在 1024/1280/1600 核对标签不换行、值可换行、无横向溢出并截图
6. 核对节点块头部高度与排行头部一致，块内没有按钮，只有「查看全部节点」链接
7. 核对环图与就绪/总量数字在块内垂直居中，环心显示就绪率且不另起一行重复
8. 切换深浅主题与中英文，核对标签与值仍可分辨

## 期望结果

- 两块合计高度不超过改动前单列堆叠的 60%，字段一个不少
- 标签是行里更大的那一半（14px 中等字重、主色），值次之（12px、次色），两者计算色在深浅主题下对比度均不低于 4.5:1
- 标签列与值列起点在两块之间及相邻行之间偏差小于 2px
- 节点块头部与排行头部高度差小于 2px，块内按钮数为 0，链接指向当前集群节点列表
- 环图与数字组的垂直中心与块内容区中心偏差小于 4px，就绪率只出现一次
- 三档与深浅主题下均无裁剪、无横向滚动

## 失败排查

- 标签换行：先看身份列实际宽度，再看 DescriptionList 的 dense 标签列上限
- 头部不等高：核对两块是否都走共享 Panel 的 headerClassName，而不是各自写 min-h

## 产品改版后如何更新自动化

- 列宽或字号变化时改 packages/ai-kit/src/primitives/DescriptionList.tsx 与 pages/cluster_overview.py
