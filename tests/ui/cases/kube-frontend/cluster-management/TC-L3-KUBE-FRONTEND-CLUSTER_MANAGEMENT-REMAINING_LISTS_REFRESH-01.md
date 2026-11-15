# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01 其余独立列表页刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `remaining-lists-refresh`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/cluster-management/remaining-lists-refresh.md`

## 产品功能

集群 DevOps、JuiceFS 存储、集群自定义监控、灰度发布、镜像构建器、项目服务账号六页提供刷新入口。

### 关联需求

- `prd/kube-frontend/cluster-management/remaining-lists-refresh.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/remaining-lists-refresh.md`](../../../../prd/kube-frontend/cluster-management/remaining-lists-refresh.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-REMAINING_LISTS_REFRESH-01** — 已知集群 DevOps 工程、JuiceFS 存储卷、集群自定义监控、项目灰度发布、镜像构建器、项目服务账号六个列表均已加载，则每页都有「刷新」入口且空闲时可用；当点击刷新，则对应列表重新发起请求；句柄分别为 `devops:refresh`、`cluster-juicefs:refresh`、`custom-monitoring:refresh`、`grayrelease:refresh`、`image-builder:refresh`、`serviceaccounts:refresh`。JuiceFS 页的刷新位于「卷」页签内（该页签持有列表）。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/remaining-lists-refresh.md`](../../../../design/kube-frontend/cluster-management/remaining-lists-refresh.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/remaining-lists-refresh.md`](../../../../prd/kube-frontend/cluster-management/remaining-lists-refresh.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读这六类列表 (Priority: P1)

作为 **集群或项目运维**，我希望 **在这六个列表上直接刷新**，以便 **在触发构建、安装驱动或创建发布后立刻确认结果，而不必退出页面再进来**。

**Independent Test**：打开项目镜像构建器列表点击「刷新」，列表重新发起请求；其余五页同样有刷新入口且空闲时可用。

## 前置与配置

- 已登录且有集群/项目权限

## 测试步骤

1. 依次打开六页，确认各自的刷新入口存在且可用
2. 点击镜像构建器的刷新，观察请求是否重新发起
3. 打开 JuiceFS 页，确认刷新出现在「卷」页签内

## 期望结果

- JuiceFS 的刷新只在持有列表的页签出现

## 失败排查

- JuiceFS 没有按钮：refresh 落进了列定义而不是 schema 根
- 按钮永久禁用：schema 依赖数组缺少 isFetching

## 产品改版后如何更新自动化

- 选择器：devops:refresh / cluster-juicefs:refresh / custom-monitoring:refresh / grayrelease:refresh / image-builder:refresh / serviceaccounts:refresh
