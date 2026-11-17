# 集群作用域角色（L3）

[子模块需求](./_index.md)

## 概述

集群控制台的「集群角色」页：/kube-frontend/clusters/<cluster>/roles 列出当前集群的 clusterrole（名称、系统徽标、规则数、创建时间）；详情 /roles/<name> 用两个页签展示权限规则与已授权用户。读集群作用域的 IAM 集合，只读。

来源：2026-11-17 产品复核重纳 N-06（老 console 的 clusters/containers/Roles 列表 + 详情两页签）。

## 用户故事

### US1 - 在集群控制台核对角色与授权 (Priority: P2)

作为 **集群管理员**，我希望 **在某个集群的上下文里看到该集群的角色、规则与直接授权的用户**，以便 **不用切到平台访问控制页（且只看到 host）也能回答「这个集群里谁能做什么」**。

**Independent Test**：进入 /clusters/host/roles，列表行数与接口 totalItems 一致；进入任一带规则的角色详情，规则行数等于对象 rules 长度；已授权用户页签与 /users?clusterrole=<name> 一致（无绑定时显示空态）。

### US2 - 在平台角色页切换查看成员集群角色 (Priority: P2)

作为 **平台管理员**，我希望 **在平台「集群角色」页切换 host / 成员集群查看该集群的角色**，以便 **不用逐个进入集群控制台也能核对各集群有哪些角色**。

**Independent Test**：多集群安装打开 /access/clusterroles，选择器列出 host 与成员；切到成员后显示该集群角色（只读、无创建入口）；切回 host 后平台角色列表与创建按钮恢复。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01** — 已知集群有 R 个 clusterrole，当打开该集群角色页，则列出 R 行，每行显示名称（系统角色带「系统」徽标）、规则数（rules 长度，可为 0）、创建时间；R 为 0 时空态，接口失败时错误面板与重试。点击名称进入详情，默认「权限规则」页签按 API 组/资源/动作逐条列出 rules；切到「已授权用户」页签列出直接绑定该角色的 IAM 用户（用户名/状态/最近登录）；没有直接绑定时给出明确空态。页面只读，不提供创建/编辑/删除。
- 列表与详情都读**当前集群**：host 用 /kapis/iam…；成员集群用 /kapis/clusters/<c>/iam…；数据不随平台角色页的 host 固定值。
- **平台角色页多集群切换**：/access/clusterroles 顶部在集群数 >1 时显示集群选择器；host 保持原有可写列表，成员集群显示只读角色列表（写操作在集群控制台）；单集群部署不显示选择器。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02** — Given 多集群安装且集群数 >1，When 打开 /kube-frontend/access/clusterroles，Then 顶部显示集群选择器并列出 host 与成员集群；选择成员集群后显示该集群的角色列表（来自 /kapis/clusters/<c>/iam…）、只读提示，且没有创建角色入口；切回 host 后平台角色列表与创建按钮恢复。Given 单集群部署，Then 不显示选择器，页面行为与原来一致。

## 设计目标

- 集群上下文自洽：同一个集群的 URL 只显示该集群的角色。
- 「规则」不是 YAML 转储，而是可扫读的 API 组/资源/动作三列。

## 约束与边界

- 列表一次取全（limit=-1），前端分页。
- 规则数按 rules 数组元素数计；缺失按 0。
- 已授权用户来自 IAM 聚合 users?clusterrole=<name>；**原生 Kubernetes 绑定**（system:* 用户、ServiceAccount、启动时的 admin 绑定）不是 IAM 用户，不会出现在该接口中——空态是真实答案，不是漏行。
- 页面只读；角色写能力留在平台「访问控制 › 集群角色」（写路径与平台角色相同，不在本页重复一套编辑器）。

## UI 交互设计

- 列表：名称（系统徽标）、规则数（右对齐等宽）、创建时间；行链接到详情。
- 详情：面包屑回列表；标题 + 对象名 + 规则数/创建时间；页签「权限规则 (N)」「已授权用户 (N)」。
- 规则表：API 组 / 资源（含 nonResourceURLs）/ 动作。
- 用户表：用户名 / 状态 / 最近登录；空态说明「没有直接绑定到该角色的用户」。
- data-ai-id：cluster-roles:surface/table/name:<name>/retry；cluster-role-detail:surface/rules/rule:<i>/tab:rules/tab:users/users/user:<name>/rules-empty/users-empty/retry。

## 文案与校验

- 列名：名称、规则数、创建时间；详情页签：权限规则、已授权用户。
- 状态沿用用户页状态文案；最近登录缺失显示 -。
- 空态：角色列表「该集群没有可显示的角色。」；规则「该角色没有权限规则。」；用户「没有直接绑定到该角色的用户（组与服务账号不在本页签）。」

## 边界情况

- 系统角色（role-template-*）只读并带徽标，但规则照常显示。
- rules 为空：显示 0 与规则空态，不隐藏角色行。
- 已授权用户为 0：空态；不要退化成空白表。
- 成员集群 IAM 读取失败：错误面板 + 重试；不静默回退 host 数据。
- 直接输入不存在的角色名：错误面板（对象不存在），链接可回列表。

## 明确不做

- 在本页创建/编辑/删除角色（写能力在平台访问控制页）。
- 组/ServiceAccount 的授权列表（本页签只列用户；老页面同样只列用户）。
- 平台角色页的多集群切换（B200 单集群不可验证；集群作用域页已按集群读取，后续批次在 mlu370 补平台页切换）。

## 假设

- 集群作用域的 clusterroles 集合按 IAM 聚合返回该集群对象（host 实测 218 个）。
- 角色总量在 500 以内。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01** — 集群角色列表按当前集群读取，显示名称/规则数/创建时间与系统徽标。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02** — 详情两页签：规则逐条三列、已授权用户与 IAM 聚合一致（含空态）。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01** — 列表行数 = 当前集群 clusterroles totalItems；规则行数 = 对象 rules.length。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02** — 用户行集合 = /users?clusterrole=<name> 的 IAM 用户集合。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ROLES-02
