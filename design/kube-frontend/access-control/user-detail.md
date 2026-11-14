# 用户详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/user-detail.md)

## 概述

读一个用户对象与其登录记录（`/users/<name>/loginrecords`），展示基本信息、分页登录历史，并对非保护账号提供管理员重置密码。

## 关联需求

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03`

## 设计目标与非目标

目标：一屏回答「这个账号是谁、还在不在用、登录过哪些次、管理员如何重置密码」。非目标：停用/删除/编辑信息（列表行操作）、跨聚合的角色查询。

## 关键约束

- 用户：`/kapis/iam.kubesphere.io/v1alpha2/users/<name>`。
- 登录记录：同路径 `/loginrecords?page=&limit=&sortBy=createTime&ascending=false`，响应带 `totalItems`。
- 管理员重置：`PUT /users/<name>/password`，体为 `{ password }`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01 — 最近登录取 status，注解只作回退

**为什么**：`status.lastLoginTime` 是平台在登录时写入的权威字段；`iam.kubesphere.io/last-login-time` 注解在部分用户上没有，且可能滞后。两者都读，优先 status。

**被否方案**：只读注解。列表页一直这么做，于是「最近登录」列在从未登录的用户上显示的是改密时间。

**何时重新考虑**：平台把登录时间搬进注解并废弃 status 字段时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02 — 登录记录独立降级

**为什么**：`loginrecords` 是另一个集合，权限或组件缺失时可能不可用。它失败时只有该区块显示「不可用」，基本信息仍然可读——一个聚合挂掉不该让整页变错误页。

**被否方案**：两个查询合成一个 Promise.all 并整体失败。会把「登录记录不可用」放大成「用户详情不可用」。

**何时重新考虑**：后端把两者合并为一个接口时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03 — 登录历史走服务端分页，四列与旧页签对齐

**为什么**：旧详情的登录历史是独立页签，列是时间、成功/失败、来源 IP、原因，`total > limit` 才出现分页。新页曾经只渲染最近 10 条的时间与 provider·reason，既丢了失败态和 IP，也把第 11 条以后藏起来。`spec.success` 缺失不能当成失败：那是「对象没说」，不是登录失败。

**被否方案**：继续 limit=10 且不读 totalItems。看起来像完整历史，实际是截断。把缺失 success 画成失败会制造没有发生过的事故。

**何时重新考虑**：平台提供按成功/IP 筛选的查询参数时，再加筛选，不改默认排序（createTime 降序）。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04 — 管理员重置只发送新密码

**为什么**：实测 `PUT { password }` 返回 200，随后新密码可登录、旧密码 400；带上 `currentPassword` 会被当成「对方的当前密码」而 400 `incorrect old password`。这与个人设置（必须 currentPassword）不是同一条授权路径。预置账号与当前用户沿用旧 `showEdit`：入口直接不渲染，而不是点了再报错。

**被否方案**：复用个人设置弹窗并要求当前密码。管理员不可能知道对方的当前密码，入口等于不可用。

**何时重新考虑**：IAM 为管理员重置提供单独动词或必须带当前密码时。

## 系统现状

老 console 的 `pages/access/containers/Accounts/Detail` 有基本信息、登录历史页签与「修改密码」。本页承接基本信息、分页登录历史与管理员重置；停用/启用、删除与编辑信息仍在列表行操作（与旧详情操作等价：同一用户对象、同一写接口）。

## 仓库落点

- 页面：`apps/console-next/src/pages/platform/UserDetailPage.tsx`、`LoginHistoryPanel.tsx`、`UserResetPasswordDialog.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.access/users/$name.tsx`
- 接口：`packages/api-client/src/access.ts` 的 `userDetailApi` / `usersWriteApi.resetPassword` / `isProtectedPlatformUser`
- 文案：`packages/locales/src/index.ts`（`platform.user.*`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 用户 | /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt; |
| 登录记录 | /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt;/loginrecords?page=&amp;limit=&amp;sortBy=createTime |
| 重置密码 | PUT /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt;/password  体 `{ password }` |

## 不变量

1. 状态取自 `status.state`，缺失按 Active。
2. 最近登录优先 `status.lastLoginTime`，回退注解，仍无则「尚未登录」。
3. 登录记录失败不影响基本信息。
4. `spec.success` 不是布尔时状态显示 `-`，不填失败。
5. 重置密码请求体不含 `currentPassword`。

## 已知坑

- **loginrecords 是集合不是字段**：别在用户对象上找登录历史。
- **记录对象没有 time 字段**：时间在 `metadata.creationTimestamp`；状态在 `spec.success`；IP 在 `spec.sourceIP`；原因在 `spec.reason`。`spec.provider` 在本集群常为空，不作为列。
- **管理员重置不能带 currentPassword**：带了会 400。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01.yaml` 及 `-02`、`-03`。
可观测点：`user-detail:surface`、`user-detail:basic`、`user-detail:logins`、`user-detail:login-list`、`user-detail:login-total`、`user-detail:reset`、`user-reset:submit`。

## 后续改进

- 该用户在各项目/企业空间的角色。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03
