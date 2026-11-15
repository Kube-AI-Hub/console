# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01 镜像构建器 · 列表（服务端分页/搜索/刷新/列）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

项目级镜像构建器列表通过 kapis 资源代理读取，服务端分页、名称搜索与 totalItems；表格展示名称/类型/服务/构建镜像/状态/最近构建/创建时间；刷新保留搜索；空态说明来源；错误态可重试。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 列表：通过 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<namespace>/s2ibuilders` 读取，请求带 `page`/`limit`（服务端分页）与 `sortBy=createTime&ascending=false`；行数等于当页 items、总数取 `totalItems`；搜索按名称服务端过滤并回到第 1 页；刷新保留搜索值并重新读取；列含名称（displayName/name 与类型/所属服务副行）、类型、所属服务、构建器镜像、状态（lastRunState：Running→构建中、Successful→构建成功、Failed→构建失败、空/未知→尚未构建）、最近构建时间（lastRunStartTime，缺失显示 -）与创建时间；空列表显示「暂无镜像构建器」空态并说明来源；读取失败显示错误面板与重试；列表行名称链到详情。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到项目里有哪些镜像构建器，并维护别名/删除 (Priority: P1)

作为 **项目运维**，我希望 **在项目里看到已有的镜像构建器、它们最近一次构建的状态与所属服务，并能改别名或删除不再需要的构建器**，以便 **快速判断某个服务的镜像最近是否构建成功，并清理过期的构建配置**。

**Independent Test**：打开项目的镜像构建器页：列表按创建时间倒序、服务端分页并支持名称搜索与刷新；行内显示名称（别名/显示名）、类型、所属服务、构建器镜像、状态、最近构建时间与创建时间；行菜单可编辑信息与删除，删除需输入对象名并回读 404；没有构建器时显示空态并给出创建入口。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- devops 模块已安装，s2ibuilders CRD 可读

## 测试步骤

1. 用 API 创建两个唯一前缀的镜像构建器（带 displayName 与 serviceName 注解）
2. 打开 /kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder
3. 等待 surface 离开 loading，核对表头含 名称/状态/创建时间
4. 按唯一前缀搜索，断言只剩目标行；核对请求走了 kapis 资源代理且带 page/limit 参数
5. 清空搜索并点击刷新，断言状态回到 ready

## 期望结果

- 列表请求命中 kapis/resources.kubesphere.io/v1alpha3/namespaces/default/s2ibuilders 且带 page、limit 参数
- 表头包含 名称/状态/创建时间，行内展示 displayName 与构建镜像
- 搜索后只显示匹配行；刷新不会清空搜索值并重新读取
- 无构建器时显示「暂无镜像构建器」空态并说明来源

## 失败排查

- 列表为空：API 是否 0 条
- 请求 404：是否读了 v1alpha3 之外的路径
- 行数不符：分页 totalItems 与 page 参数

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
