# 用户详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/user-detail.md)

## 概述

读一个用户对象与其登录记录（`/users/<name>/loginrecords`），只读展示。

## 关联需求

- AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01

## 设计目标与非目标

目标：一屏回答「这个账号是谁、还在不在用」。非目标：写操作（停用/删除/编辑）、跨聚合的角色查询。

## 关键约束

- 用户：`/kapis/iam.kubesphere.io/v1alpha2/users/<name>`。
- 登录记录：同路径 `/loginrecords?limit=10&sortBy=createTime&ascending=false`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01 — 最近登录取 status，注解只作回退

**为什么**：`status.lastLoginTime` 是平台在登录时写入的权威字段；`iam.kubesphere.io/last-login-time` 注解在部分用户上没有，且可能滞后。两者都读，优先 status。

**被否方案**：只读注解。列表页一直这么做，于是「最近登录」列在从未登录的用户上显示的是改密时间。

**何时重新考虑**：平台把登录时间搬进注解并废弃 status 字段时。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02 — 登录记录独立降级

**为什么**：`loginrecords` 是另一个集合，权限或组件缺失时可能不可用。它失败时只有该区块显示「不可用」，基本信息仍然可读——一个聚合挂掉不该让整页变错误页。

**被否方案**：两个查询合成一个 Promise.all 并整体失败。会把「登录记录不可用」放大成「用户详情不可用」。

**何时重新考虑**：后端把两者合并为一个接口时。

## 系统现状

老 console 的 `pages/access/containers/Accounts/Detail` 有基本信息与登录历史页签。本页迁出这两块；停用/启用、删除与编辑信息仍留在列表操作（尚未迁移）。

## 仓库落点

- 页面：`apps/console-next/src/pages/platform/UserDetailPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.access/users/$name.tsx`
- 接口：`packages/api-client/src/access.ts` 的 `userDetailApi`
- 文案：`packages/locales/src/index.ts`（`platform.user.*`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 用户 | /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt; |
| 登录记录 | /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt;/loginrecords?limit=10 |

## 不变量

1. 状态取自 `status.state`，缺失按 Active。
2. 最近登录优先 `status.lastLoginTime`，回退注解。
3. 登录记录失败不影响基本信息。

## 已知坑

- **loginrecords 是集合不是字段**：别在用户对象上找登录历史。
- **记录对象没有 time 字段**：时间在 `metadata.creationTimestamp`，方式在 `spec.provider`/`spec.reason`。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01.yaml`
可观测点：`user-detail:surface`、`user-detail:basic`、`user-detail:logins`、`user-detail:login-list`。

## 后续改进

- 停用/启用与删除（列表行操作）。
- 该用户在各项目/企业空间的角色。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01
