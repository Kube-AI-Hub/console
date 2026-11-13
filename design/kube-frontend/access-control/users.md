# 用户列表（L3）

[子模块需求](../../../prd/kube-frontend/access-control/users.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-03

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-02

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01

## 概述

平台用户表。

## 设计目标与非目标

把状态与平台角色变成可读列。非目标：用户写操作。

## 关键约束

- 读 IAM `users`；角色取自两个可能的注解键。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01 — 平台角色读两个注解键，按顺序取第一个

**为什么**：平台在不同版本分别写 `iam.kubesphere.io/platform-role` 与 `iam.kubesphere.io/globalrole`。只读一个会在某些对象上显示空。

**被否方案**：读 `roleRef`。用户对象上没有这个字段，角色是注解承载的。

**何时重新考虑**：平台统一为单一键时。

## 系统现状

老 console 用户列含用户名、状态、平台角色、最近登录；本模块一致。

## 仓库落点

- `pages/platform/PlatformListPage.tsx`（users 分支）
- `packages/api-client/src/access.ts` 的 `toUserSummary` / `platformRoleOf`

## 对外契约

只读。

## 不变量

状态缺失按活跃处理。

## 已知坑

- 3 千多用户时首屏慢，必须有加载态。

## 测试与可观测

E2E 见 `tests/kube-frontend/access-control/`。

## 后续改进

用户创建与角色分配。

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

### DEC-L3-KUBE-FRONTEND-ACCESS-CONTROL-USERS-04 — 改角色用 PUT，并对 500+「not found」做特判

**为什么**：IAM 的 `users` 端点对 PATCH 返回 **405**（实测），只能整对象 PUT。同时它对**不存在的用户返回 500**（消息为 `user.iam.kubesphere.io "x" not found`），而不是 404——若不特判，删除成功后页面会显示「服务器错误 + 重试」，用户无法判断到底删没删掉。

**被否方案**：把 500 一律当可重试。会让「删除成功」看起来像失败。

**何时重新考虑**：IAM 修正状态码，或平台提供专门的角色变更接口时。
