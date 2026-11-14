# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01 集群网关 · 双视图与真实集合对账

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-gateways`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways`
- **需求**: `prd/kube-frontend/cluster-management/cluster-gateways.md`

## 产品功能

集群与项目网关两视图只读展示状态和控制器消息。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-gateways.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-gateways.md`](../../../../prd/kube-frontend/cluster-management/cluster-gateways.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01** — 网关设置从集群侧栏可达；默认显示集群网关，切换项目网关更新 URL。列表显示名称、项目、状态、访问方式、地址、控制器消息和创建时间；状态以 Deployed 条件为准，空值为 -，无对象为空态，接口失败不伪装为无数据。两视图可刷新，项目链接到已有网关设置页。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-gateways.md`](../../../../design/kube-frontend/cluster-management/cluster-gateways.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-gateways.md`](../../../../prd/kube-frontend/cluster-management/cluster-gateways.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 判断集群与项目网关是否就绪 (Priority: P1)

作为 **集群管理员**，我希望 **查看不同作用域的网关状态**，以便 **判断路由是否具备访问入口**。

**Independent Test**：打开集群和项目网关两个视图，对账接口对象；无对象时显示空态，有对象时状态取控制器条件。

## 前置与配置

- 已登录且有集群网关读取权限
- 用例只读，不创建 Gateway 或更改控制器

## 测试步骤

1. 读取 Gateway 原生集合
2. 打开集群网关设置，核对默认集群视图的数量
3. 切换项目网关，核对 URL 和数量

## 期望结果

- 列表数量与相同作用域的 API 对象一致
- 无对象进入空态而非错误，切换页签更新 URL

## 失败排查

- 403 与读取失败不得当作空集合，检查原生资源请求

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py
