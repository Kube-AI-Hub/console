# 用户列表（L3）

[子模块需求](../../../prd/kube-frontend/access-control/users.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01

## 概述

平台用户表。

## 设计目标与非目标

把状态与平台角色变成可读列；对账号的写操作（创建、改角色、停用/启用、删除、编辑邮箱与描述）都在本模块内完成。
非目标：企业空间的创建与成员管理。

## 关键约束

- 读 IAM `users`；角色取自两个可能的注解键。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01 — 平台角色读两个注解键，按顺序取第一个

**为什么**：平台在不同版本分别写 `iam.kubesphere.io/platform-role` 与 `iam.kubesphere.io/globalrole`。只读一个会在某些对象上显示空。

**被否方案**：读 `roleRef`。用户对象上没有这个字段，角色是注解承载的。

**何时重新考虑**：平台统一为单一键时。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-USERS-05 — 批量停用/启用，admin 不可勾选

**为什么**：老 console 在用户页提供批量启用/停用；逐个菜单操作十个离职账号是会被跳过的活儿。admin 账号既不能停用，就不该出现在选择里——可勾选却必然被拒绝的复选框是陷阱。

**被否方案**：不做批量，只保留行操作。多账号场景下操作成本与账号数线性增长。

**何时重新考虑**：需要跨页选择时（当前选择只在当前页保持）。

## 系统现状

老 console 用户列含用户名、状态、平台角色、最近登录；本模块一致。

## 仓库落点

- `pages/platform/PlatformListPage.tsx`（users 分支）
- `packages/api-client/src/access.ts` 的 `toUserSummary` / `platformRoleOf`

## 对外契约

读：`GET /kapis/iam.kubesphere.io/v1alpha2/users`（分页）。写：创建走 `POST users`，改角色/状态/邮箱走**整对象 PUT**
（该端点对 PATCH 返回 405），删除走 `DELETE users/<name>`。改自己的密码是另一条端点，属「用户设置」。

## 不变量

状态缺失按活跃处理。

## 已知坑

- 3 千多用户时首屏慢，必须有加载态。

## 测试与可观测

E2E 见 `tests/kube-frontend/access-control/`。

## 后续改进

管理员重置他人密码：老 console 在用户详情页提供，属独立的重置流程（需要确认与弱口令策略），另立功能点。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-USERS-02 — 密码规则在客户端先校验

**为什么**：平台的口径很短（长度、字母、数字），把它写进表单后，用户得到的是「密码需包含数字」而不是一个通用的 400。规则写在 `passwordProblem` 一处，界面与用例都用它。

**被否方案**：只依赖服务端报错。把可解释的规则变成黑盒，用户要靠试错才能猜出要求。

**何时重新考虑**：平台把口令策略做成可配置项时，规则应来自服务端。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-USERS-03 — 平台角色只列出三个可分配值

**为什么**：`globalroles` 有 19 个，其中多数是 `role-template-*` 构建块，另有两个是内部身份（`authenticated`/`anonymous`）。把它们放进下拉会让管理员选到一个语义不成立的角色。只保留 `platform-regular` / `platform-self-provisioner` / `platform-admin`。

**被否方案**：列出全部。选择面更大，但正确率更低。

**何时重新考虑**：平台允许自定义平台角色时，改为读接口并按标签过滤。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-USERS-06 — 密码字段用注册的字段类型，不另写一套表单

**为什么**：创建用户弹窗是 schema 驱动的 `ResourceForm`，而密码需要「输入框 + 强度面板」。ai-kit 的
`registerFieldType` 就是为这种需求存在的：schema 层负责布局，控制台自己注册领域字段类型。用注册表意味着不动
`ResourceForm`、不加第二个表单实现，两处（个人设置与创建用户）也就能共用同一个 `PasswordStrength` 组件——
同一份规则、同一份文案，靠 `scope` 参数区分句柄。

**被否方案**：给 `ResourceForm` 加一个 `render` 分支。为一个字段改库，会让下一个字段再改一次；注册表已经存在，
先读库再决定要不要改库。

**何时重新考虑**：一个字段需要读其它字段的值才能渲染时（当前渲染器只拿到自己的值与校验态）。

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-USERS-04 — 改角色用 PUT，并对 500+「not found」做特判

**为什么**：IAM 的 `users` 端点对 PATCH 返回 **405**（实测），只能整对象 PUT。同时它对**不存在的用户返回 500**（消息为 `user.iam.kubesphere.io "x" not found`），而不是 404——若不特判，删除成功后页面会显示「服务器错误 + 重试」，用户无法判断到底删没删掉。

**被否方案**：把 500 一律当可重试。会让「删除成功」看起来像失败。

**何时重新考虑**：IAM 修正状态码，或平台提供专门的角色变更接口时。
