# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01 集群级配置 · 三个跨项目列表

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-config`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/secrets`
- **需求**: `prd/kube-frontend/cluster-management/cluster-config.md`

## 产品功能

保密字典、配置字典、服务账号三页的跨项目只读列表：名称（链接）、项目、资源专属列、创建时间；关键字搜索与每页 20 条分页。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-config.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01** — 已知集群里有保密字典、配置字典与服务账号，当从集群侧栏「配置」分组依次打开三页，则每页都显示名称（链接到该对象所属项目内的详情页）、项目、资源专属列（保密字典的类型与字段数、配置字典的字段数、服务账号的保密字典数）与创建时间；每页行数等于 `min(20, total)`；项目列等于对象命名空间；名称链接形如 `/kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/{secrets,configmaps,serviceaccounts}/<name>`；按名称的服务端搜索与每页 20 条的分页可用。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-config.md`](../../../../design/kube-frontend/cluster-management/cluster-config.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-config.md`](../../../../prd/kube-frontend/cluster-management/cluster-config.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目定位一份配置 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的保密字典 / 配置字典 / 服务账号**，以便 **先确认对象属于哪个项目，再跳到该项目里处理**。

**Independent Test**：打开集群级保密字典页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/secrets/<name>`；对配置字典与服务账号各重复一次。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群里至少有一个保密字典、一个配置字典、一个服务账号

## 测试步骤

1. 用 API 依次读 secrets/configmaps/serviceaccounts 的跨项目首页（page=1, limit=20）
2. 打开集群级保密字典页，核对表头、行数、项目列与名称链接
3. 打开集群级配置字典页，核对表头、行数、项目列与名称链接
4. 打开集群级服务账号页，核对表头、行数、项目列与名称链接
5. 核对集群侧栏「配置」分组可达

## 期望结果

- 三页行数都等于 min(20,total)
- 表头分别包含 名称/项目/类型/字段数/创建时间、名称/项目/字段/创建时间、名称/项目/保密字典/创建时间
- 项目列等于对象命名空间
- 名称链接含 /projects/<namespace>/<kind>/<name>，且带 workspace 段

## 失败排查

- 行数为 0：请求带了 namespace 段
- 表头缺列：页面把项目级 schema 直接复用而未替换专属列
- 行数少于 min(20,total)：分页/每页条数没有传给服务端
- 名称链接 404：链接里漏了 workspace 段

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 @/pages/cluster/Cluster*Page.tsx；行句柄是 namespace/name
