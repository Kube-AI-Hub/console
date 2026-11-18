# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-12 集群概览 · 未就绪集群的导航与页面守卫

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-12`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{notReadyCluster}/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

未就绪集群的侧栏只放行概览，其余页面禁用并给出原因；直接访问这些页面时给出同语言的说明与回到概览的入口。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-13** — 未就绪集群（Ready 条件非 True）的集群侧栏只放行「集群概览」：其余页面项置为禁用——不可点击、不保留 href、`aria-disabled="true"`、悬停说明「未就绪」，并带锁定标记；分组仍可展开，让读者看到有哪些页面，但叶子项不可进入。加载中（集群列表尚未返回）不锁定任何项，避免每次进入集群都闪一下灰菜单。直接访问被禁页面的 URL（书签、粘贴、浏览器后退）时，集群作用域布局显示与等待页同语言的说明——「该集群尚未加入，此页面在集群就绪前不可用」——并提供前往集群概览的链接，不把 apiserver 的 `cluster <id> is not ready` 英文原文抛给读者。集群就绪后侧栏恢复可点击，守卫不再出现。

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

- 已登录，存在一个 Ready 条件非 True 的集群

## 测试步骤

1. 打开未就绪集群的概览，展开侧栏各分组
2. 核对「集群概览」可点击，其余叶子项被禁用
3. 核对被禁用项没有 href，且 title 说明原因
4. 直接访问该集群的节点页面
5. 核对页面显示等待说明与前往概览的链接，而不是 apiserver 的英文原始错误
6. 让集群变为就绪后核对侧栏恢复可点击

## 期望结果

- 概览叶子项 `aria-disabled` 为空且 href 指向 overview
- 其余叶子项 `aria-disabled="true"`、无 href、`title` 为「未就绪」
- 直接访问 `/clusters/{id}/nodes` 时出现 `cluster:not-ready`，含中文说明与 `cluster:not-ready-overview` 链接
- 页面不出现 `cluster <id> is not ready` 这类未翻译的 apiserver 原文
- 集群就绪后侧栏叶子项恢复 href，且守卫不再出现

## 失败排查

- 侧栏未禁用：确认 `['clusters']` 查询拿到该集群且 `ready` 为 false；加载中不锁定，避免闪烁
- 守卫未出现：检查路由层拿到的 page 段是否为 overview（overview 放行）

## 产品改版后如何更新自动化

- 侧栏或守卫结构变化时改 pages/cluster_fleet.py 与 test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_OVERVIEW_12.py
