# 项目角色列表（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/roles.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-03

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01

## 概述

角色列表：名称/描述、规则数、创建时间，模板角色带徽标。

## 设计目标与非目标

落实模板角色可区分。非目标：角色写操作。

## 关键约束

- 读 `iam.kubesphere.io/v1alpha2`；`rules` 长度为规则数。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01 — 规则数只计数，不在列表展开

**为什么**：管理员先在列表判断「这个角色是不是空的」，细节留给详情。把规则展开到列表会让每一行变成一张小表。

**被否方案**：列表里直接显示动词列表。单行高度不可控，且窄屏无法阅读。

**何时重新考虑**：出现「按权限搜索角色」的需求时。

## 系统现状

老 console 的角色列表有名称、描述、创建时间；本模块把描述折进副行，加入规则数。

## 仓库落点

- `pages/settings/SettingsListPage.tsx`（roles 分支）

## 对外契约

只读。

## 不变量

规则数等于 `rules` 数组长度。

## 已知坑

- 模板角色数量多（本项目 27 个角色里大部分是模板），不加徽标会让人误以为它们都可分配。

## 测试与可观测

E2E 见 `tests/kube-frontend/project-settings/`。

## 后续改进

按权限搜索。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-01`

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-ROLES-02 — 规则用「一行一条」的文本编辑，不用逐行表单

**为什么**：项目角色的规则通常是从 `kubectl describe` 抄下来的几条，用 `API 组 | 资源 | 动作` 的文本行可以**一次看全**；逐行表单会把五条规则变成一个需要滚动的编辑器，且增删行的交互比换行更重。

**被否方案**：可增删行的结构化表格。为低频、低条数的场景引入了状态管理成本。

**何时重新考虑**：需要表单级校验（例如按资源自动补全动作）时。

**另一条**：对话框先开、再加载规则，加载中显示骨架屏。**先等数据、成功后再弹出**会让用户以为点击没生效。

### DEC-L3-KUBE-FRONTEND-PROJECT-SETTINGS-ROLES-03 — 规则写到原生 RBAC 的 namespaced Role

**为什么**：与集群角色同理——IAM 层的写入会丢弃 `rules`。项目角色是命名空间的 `Role`，因此写到 `/apis/rbac.authorization.k8s.io/v1/namespaces/<ns>/roles/<name>`，先读 `resourceVersion` 再整对象 PUT。

**被否方案**：走 IAM 的 `/kapis` 写路径。会得到一个没有规则的角色，而响应是 200。
