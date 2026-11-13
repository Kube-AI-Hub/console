# TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01 集群管理 · 切换不刷新且没有项目工作区栏

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `cluster-management` `page`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/_index.md`

## 产品功能

['集', '群', '级', '页', '面', '在', '节', '点', '与', '项', '目', '之', '间', '切', '换', '是', '客', '户', '端', '跳', '转', '，', '且', '不', '出', '现', '项', '目', '工', '作', '区', '栏', '。']

### 关联需求

- `prd/kube-frontend/cluster-management/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/_index.md`](../../../../prd/kube-frontend/cluster-management/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-01** — 已知已登录且有集群权限，当在左侧集群菜单的页面之间切换，则每次都显示对应页面（或空态），菜单高亮跟随，切换不产生文档请求。
- **AC-FULL-KUBE-FRONTEND-CLUSTER_MANAGEMENT-02** — 已知在集群级页面，当观察页面顶部，则**不出现**项目工作区栏（`data-ai-id="workspace-bar"`）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/_index.md`](../../../../design/kube-frontend/cluster-management/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/_index.md`](../../../../prd/kube-frontend/cluster-management/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群视角下切换节点与项目 (Priority: P1)

作为 **集群管理员**，我希望 **在这两张表之间切换**，以便 **从节点看到项目而不必进任何一个项目**。

**Independent Test**：从节点切到项目再切回，核对左侧集群菜单的高亮变化且没有整页刷新。

### US2 - 明确知道自己在集群视角而不是某个项目里 (Priority: P2)

作为 **集群管理员**，我希望 **这些页面不出现项目切换器**，以便 **不会误以为筛选会生效**。

**Independent Test**：打开节点页，核对页面没有项目工作区栏。

## 前置与配置

- 已登录，且有集群权限

## 测试步骤

1. 打开节点页
2. 确认页面没有项目工作区栏
3. 切到项目页签
4. 再切回节点
5. 统计切换期间的文档请求

## 期望结果

- 两个页面各自出现列表或空态
- 页面不出现 data-ai-id=workspace-bar
- 切换后对应页签高亮
- 切换期间文档请求为 0

## 失败排查

- 出现工作区栏说明集群页复用了项目布局
- 出现文档请求说明页签退化成整页跳转

## 产品改版后如何更新自动化

- 布局变化时改 routes/kube-frontend.clusters.$cluster/route.tsx
