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
- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08

## 概述

平台用户表。

## 设计目标与非目标

把状态与平台角色变成可读列；对账号的写操作（创建、改角色、停用/启用、删除、编辑邮箱与描述、管理员重置密码）都在本模块内完成。创建必须写下 `uninitialized`，最近登录必须读 `status.lastLoginTime`。
非目标：企业空间的创建与成员管理；列显隐开关；用户头像。

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

企业空间用户组、配额与跨作用域授权不在本页。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-05`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-07`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08`

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

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-09 — 列表最近登录读 status，注解只作回退

**为什么**：旧 mapper 读 `status.lastLoginTime`。新列表一度只读 `iam.kubesphere.io/last-login-time`，而该注解在改密时也会被刷新，于是从未登录的账号显示成「刚刚登录」。缺值显示「尚未登录」，与旧 `NOT_LOGIN_YET` 同义，不用 `-`（那是「字段不存在」而不是「没登录过」）。

**被否方案**：继续只读注解。会把改密时间当成登录时间。

**何时重新考虑**：平台把登录时间只保留在注解并废弃 status 字段时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-10 — 创建时写下 uninitialized，描述可选

**为什么**：旧 `user.create` 在提交前无条件写 `iam.kubesphere.io/uninitialized=true`，这样首次登录必须改密。漏掉这一笔，初始密码会一直有效。描述是旧创建表单就有的字段，仍走 `kubesphere.io/description`。

**被否方案**：只发角色注解。账号能登录，但不会被要求改掉管理员设的初始密码。

**何时重新考虑**：平台改为创建后自动发邀请邮件、不再用 uninitialized 时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-11 — 用户列表默认按 createTime 降序

**为什么**：旧 `UserStore`/`BaseStore` 在未指定 `sortBy` 时使用 `createTime`。新页与角色/企业空间共用 `PlatformListPage`，曾默认 `name` 降序，于是同一批用户的首屏顺序与旧站不同，而表上又没有创建时间列可点回去。用户页单独默认 `createTime`；名称排序仍由用户名列提供（AC-04）。

**被否方案**：三种列表都默认按名称。角色与企业空间没有旧 createTime 首屏约定，用户列表有。

**何时重新考虑**：产品要求用户列表首屏按字母序，并在表头提供创建时间列时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-08 — 预置账号与当前用户整行不可写

**为什么**：旧列表 `showAction` 排除 `globals.config.presetUsers`（`admin`、`sonarqube`）以及当前用户名。新列表曾经只排除 `admin`，预置的 `sonarqube` 和操作者自己可以被停用或删除。保护函数与配置清单对齐，复选框与行菜单共用，避免「勾得上但保存必失败」。

**被否方案**：只保护 `admin`。会把配置里其余预置账号暴露给停用/删除。点了再根据 403 提示则是可点的陷阱。

**何时重新考虑**：BFF 下发 `presetUsers` 而不再与 `config.yaml` 对齐时，改为读配置接口。
