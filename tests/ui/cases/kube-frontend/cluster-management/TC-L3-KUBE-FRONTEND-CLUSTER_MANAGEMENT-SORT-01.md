# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01 集群页 · 存储类型与系统组件的名称排序可切换

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `sort`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/storageclasses`
- **需求**: `prd/kube-frontend/cluster-management/_index.md`

## 产品功能

存储类型与系统组件点击名称列可在升降序间切换，顺序确实改变。

### 关联需求

- `prd/kube-frontend/cluster-management/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/_index.md`](../../../../prd/kube-frontend/cluster-management/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SORT-01** — 已知存储类型与系统组件页各有数据，当点击名称列排序，则顺序变为升序；再次点击变为降序，两次结果不同；系统组件页的初始顺序仍为不健康在前。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/_index.md`](../../../../design/kube-frontend/cluster-management/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/_index.md`](../../../../prd/kube-frontend/cluster-management/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群视角下切换节点与项目 (Priority: P1)

作为 **集群管理员**，我希望 **在这两张表之间切换**，以便 **从节点看到项目而不必进任何一个项目**。

**Independent Test**：从节点切到项目再切回，核对左侧集群菜单的高亮变化且没有整页刷新。

## 前置与配置

- 已登录，且有集群权限
- 两个页面各有至少两条数据

## 测试步骤

1. 打开存储类型页，点击名称排序两次，记录两次顺序
2. 打开系统组件页，同样操作

## 期望结果

- 两个页面两次点击的顺序不同，且分别为升序与降序
- 系统组件的初始顺序仍是不健康在前

## 失败排查

- 点击无效：存储类型走核心 API，服务端会忽略 sortBy（应本地排序）
- 点击无效：系统组件的行排序曾写死为健康度，未使用排序状态

## 产品改版后如何更新自动化

- 排序实现变化时改对应页面与其单测
