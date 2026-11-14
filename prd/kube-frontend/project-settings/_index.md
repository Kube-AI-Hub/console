# 项目设置（L2）

[上级模块](../_index.md)

项目空间的可访问性、权限与运行配置。老 console 的「项目设置」分组共六页：基本信息、角色、成员、网络隔离、网关设置、日志收集 —— 已全部迁移。

## 概述

- **路由**：`/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/{baseinfo,roles,members,networkpolicies,gateways,logging}`
- **谁用**：项目管理员，回答三个问题：谁在这个项目里、他能做什么、这个项目的网络与日志怎么配置。
- **做哪几步**：看基本信息与配额 → 查角色规则 → 核对成员 → 配网络隔离 / 网关 / 日志收集。
- **看到什么**：
  - 基本信息：名称、别名、租户(企业空间)、描述、创建者、创建时间 + 资源配额（资源、上限、已使用）。
  - 角色：名称（副行描述）、规则数、创建时间；模板角色带「模板」徽标且无写操作。
  - 成员：用户名（副行邮箱）、状态、角色、最近登录；邀请 / 改角色 / 移除 / 批量移除。
  - 网络隔离：项目级开关 + NetworkPolicy 列表（创建 / 删除）。
  - 网关设置：未创建时为空态 + 创建；已创建时显示类型、地址、端口与状态（未就绪时轮询）。
  - 日志收集：三态开关（未配置 / 已开启 / 已关闭），关闭前确认。

## 用户故事

### US1 - 在一个功能区里完成项目配置 (Priority: P1)

作为 **项目管理员**，我希望 **项目的权限与运行配置都在同一排页签里**，以便 **不必为了开个日志收集去另一个菜单找**。

**Independent Test**：在六个页签之间依次切换，每次显示对应页面（或空态），页签高亮跟随，切换不产生文档请求。

## 验收场景

- **AC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 已知已登录且有项目权限，当在六个页签之间切换，则每次都显示对应页面或其空态，页签高亮跟随，且切换不产生文档请求。

## 设计目标

1. 权限数据统一从 IAM 聚合 API 读取，不经过通用资源代理。
2. 模板角色（`role-template-*`）以徽标区分，且不提供会失败的写操作。
3. 破坏性或不可逆的开关（网络隔离、日志收集、网关删除）都要有确认或明确的代价说明。

## 约束与边界

- 读：`/kapis/iam.kubesphere.io/v1alpha2/...`（角色、成员）、`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>`（命名空间对象）。
- 写：角色规则走原生 RBAC；网络隔离写命名空间注解；日志收集写命名空间标签；网关走 `gateway.kubesphere.io`。
- 成员的「角色」来自 `iam.kubesphere.io/role` 注解，「最近登录」来自 `status.lastLoginTime`。
- 网关真正就绪需要控制器 Helm chart，本集群缺失：页面验证到「创建 → 状态上报 → 删除」。

## UI 交互设计

工作区栏 + 六个页签；页签是真实链接（可中键/⌘ 新开），普通点击走客户端跳转。各页面内部：

- 角色：行操作「编辑信息」「编辑权限」「删除」；模板角色只有「详情」。
- 网络隔离：开关在策略列表上方，二者同屏（回答「流量为什么不通」需要两个答案）。
- 日志收集：关闭时在面板内展开确认，说明边车移除会重启容器组。

## 页面结构

| 页签 | 路由 |
|---|---|
| 项目基本信息 | `…/baseinfo` |
| 项目角色 | `…/roles` |
| 项目成员 | `…/members` |
| 网络隔离 | `…/networkpolicies` |
| 网关设置 | `…/gateways` |
| 日志收集 | `…/log-collections` |

## 文案与校验

- 角色列：名称、规则数、创建时间；模板角色徽标「模板」。
- 成员列：名称、状态、角色、最近登录；状态「活跃 / 已停用」。
- 日志收集三态：未配置 / 已开启 / 已关闭 —— 前两者不可合并。
- 空值统一 `-`。

## 异常态

- 加载中：骨架；空：空态且不渲染表头；失败：错误面板 + 重试；401/403：提示无权限。
- IAM 接口返回 200 空体时按空列表处理。
- 平台模块缺失（日志模块、网关控制器）时**禁用开关并说明**，不整块隐藏 —— 隐藏会让读者以为功能不存在。

## 明确不做

- 项目成员详情页：旧页名称无链接。
- 网关真正就绪的验证：需要安装网关控制器 Helm chart（对象可创建、状态可上报，Service 不会创建）。
- 项目删除：属危险操作，需单独的确认流程。
- 项目概览（用量与配额趋势）：需要指标历史接口，已有「集群监控」承担趋势展示。

## 功能点

| 功能点 | 需求 |
|---|---|
| 项目基本信息 | [base-info.md](./base-info.md) |
| 项目角色 | [roles.md](./roles.md) |
| 角色权限规则 | [role-rules.md](./role-rules.md) |
| 项目成员 | [members.md](./members.md) |
| 网络隔离 | [network-isolation.md](./network-isolation.md) |
| 网关设置 | [gateway.md](./gateway.md) |
| 日志收集 | [logging.md](./logging.md) |

## 验收用例

- `TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-02`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-LOGGING-01`

## 假设

- 六个页签的地址都在同一个项目工作区内，因此共享同一份工作区栏与项目切换器。
- IAM 聚合接口与本仓库其它页面读取的是同一份对象；返回 200 空体时按空列表处理。

## 成功标准

- **SC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 六个页签在真实数据下都能到达就绪态；任一页失败时只影响该页，不影响其它页签切换。

## 功能需求

- **FR-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 六个页签共用同一套布局与页签组件，差异由页面自身表达。
- **FR-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-02** — 平台模块缺失时降级为「禁用 + 说明」，不隐藏功能。
