# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02 集群侧列表每页条数选择器（10/20/50/100）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-config`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/configmaps`
- **需求**: `prd/kube-frontend/cluster-management/cluster-config.md`

## 产品功能

集群侧六个列表（配置字典/保密字典/服务账号/网络策略/IP 池/持久卷声明）与存储类列表都提供每页条数选择器；切换后请求以新的 limit 与 page=1 重发，表格行数与响应一致。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-config.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02** — 已知集群侧「配置」三页（保密字典/配置字典/服务账号）默认每页 20 条，当点分页处的每页条数选择器并选择 50，则请求以 `page=1&limit=50` 重新发起（查询键含页大小，切换必须触发新请求而不是复用缓存）、表格行数等于该次响应条数、选择器显示 50；档位为 10/20/50/100；同一能力适用于集群存储页族（持久卷声明、卷快照、存储类）与 IP 池、网络策略列表；集群存储类列表是客户端分页（一次取全量），切换档位后表格只显示当前页的行。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-config.md`](../../../../design/kube-frontend/cluster-management/cluster-config.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目定位一份配置 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的保密字典 / 配置字典 / 服务账号**，以便 **先确认对象属于哪个项目，再跳到该项目里处理**。

**Independent Test**：打开集群级保密字典页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/secrets/<name>`；对配置字典与服务账号各重复一次。

## 前置与配置

- 已登录；集群 host 可读

## 测试步骤

1. 依次打开六个集群列表，核对每页条数选择器显示默认值（20 或 10）
2. 每个页面选择 50，等 surface 离开 loading 后记录请求与行数
3. 打开集群存储类列表（客户端分页），选择 50 后核对只显示当前页的行

## 期望结果

- 每页都有 <前缀>:page-size 选择器且可选 10/20/50/100
- 选择 50 后出现 limit=50 且 page=1 的请求（证明页大小进了查询键）
- 行数等于该次响应条数（≤50），选择器显示 50

## 失败排查

- 选择器显示 50 但行数不变、也没有新请求：页大小没进 queryKey
- 存储类列表显示全部行：客户端分页没有按页切片

## 产品改版后如何更新自动化

- 句柄：cluster-configmaps:page-size / cluster-secrets:page-size / cluster-serviceaccounts:page-size / cluster-networkpolicies:page-size / ip-pools:page-size / cluster-pvc:page-size / storageclasses:page-size
