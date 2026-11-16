# 用户详情 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/access-control/user-detail.md)

## 概述

读一个用户对象与其登录记录（`/users/<name>/loginrecords`），展示基本信息、分页登录历史，并对非保护账号提供管理员重置密码。

## 关联需求

- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-05`
- `AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-06`

## 设计目标与非目标

目标：一屏回答「这个账号是谁、还在不在用、登录过哪些次、管理员如何重置密码」；登录历史本身按用户自动收敛，不会无限增长。非目标：停用/删除/编辑信息（列表行操作）、跨聚合的角色查询、后台定时清理。

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

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-05 — 登录记录在写入时按用户裁剪，不靠后台控制器

**为什么**：旧实现是一个 `loginrecord-controller`，它把每条记录处理完再用 `AddAfter` 塞回工作队列，等到保留期（曾配置 12000h）到期再处理。每条记录因此常驻一个定时器：一个 3,000 用户的集群累积到 11,611 条记录时，informer 缓存加队列占满了 controller-manager 的 1Gi 限额，反复被 OOMKill；即便把限额提到 4Gi，关闭时 worker 仍在消费队列，`mgr.Start` 等不到 runnable 退出，报 `failed waiting for all runnables to end within grace period of 30s` 后以 255 退出。

改成在 `RecordLogin` 写完记录后，直接列出**当前这个用户**的记录并按时间倒序裁剪：超出 `loginHistoryMaximumEntries` 的最旧记录与早于 `loginHistoryRetentionPeriod` 的记录一并删除。代价从「每条记录一个常驻定时器」降为「每次登录一次单用户 List 加若干 Delete」，且随集群规模不增长。

**被否方案**：保留 controller 但去掉 `AddAfter` 重排队，改为定时扫描。定时扫描仍要周期性 list 全量，且关闭时同样有 worker 未退出的问题；而登录是天然的低频触发点，不需要额外的时间源。

**被否方案**：在 `ListLoginRecords` 查询时清理。用户不登录就永远不清理，而列表是只读语义，写副作用会让分页与 `totalItems` 在翻页间跳动。

**何时重新考虑**：登录记录量级升到单用户上限也难以承受，或需要跨用户的全局配额时，改为独立的清理作业并显式控制并发。

### DEC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-06 — lastLoginTime 随登录写入，只前进不后退

**为什么**：`status.lastLoginTime` 原本只由被删掉的 `loginrecord-controller` 维护，controller 一删就没人写了，而 console 的账号列表、用户详情、成员列表与 Dashboard 共 7 处读它。把更新并进 `RecordLogin` 保证「有登录就有时间」，且与记录写入同一时刻。更新用 `UpdateStatus`，并在新值不晚于现值时直接跳过，避免并发登录把时间改回旧值。

**被否方案**：查询时用最新一条 `LoginRecord` 的时间覆盖显示。那只是展示层拼接，`status.lastLoginTime` 依然是陈旧的，其他读该字段的接口（账号列表排序、Dashboard）拿到的仍是旧值。

**被否方案**：保留 controller 只做时间更新。为了一个字段维持整个 informer 与工作队列不划算，正是这次要拆掉的东西。

**何时重新考虑**：登录时间需要精确到每次登录而非「最后一次」时，改为读记录聚合。

## 系统现状

老 console 的 `pages/access/containers/Accounts/Detail` 有基本信息、登录历史页签与「修改密码」。本页承接基本信息、分页登录历史与管理员重置；停用/启用、删除与编辑信息仍在列表行操作（与旧详情操作等价：同一用户对象、同一写接口）。

## 仓库落点

- 页面：`apps/console-next/src/pages/platform/UserDetailPage.tsx`、`LoginHistoryPanel.tsx`、`UserResetPasswordDialog.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.access/users/$name.tsx`
- 接口：`packages/api-client/src/access.ts` 的 `userDetailApi` / `usersWriteApi.resetPassword` / `isProtectedPlatformUser`
- 文案：`packages/locales/src/index.ts`（`platform.user.*`）
- 登录记录写入与裁剪：`kube-server/pkg/models/auth/login_recoder.go`（`RecordLogin` / `pruneLoginRecords` / `updateLastLoginTime`）
- 构造点：`kube-server/pkg/apiserver/apiserver.go` 注入 `AuthenticationOptions`
- 已删除：`kube-server/pkg/controller/loginrecord/`（原 `loginrecord-controller`）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 用户 | /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt; |
| 登录记录 | /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt;/loginrecords?page=&amp;limit=&amp;sortBy=createTime |
| 重置密码 | PUT /kapis/iam.kubesphere.io/v1alpha2/users/&lt;name&gt;/password  体 `{ password }` |

登录记录的条数上限由 `authentication.loginHistoryMaximumEntries`（默认 200）与 `authentication.loginHistoryRetentionPeriod` 决定，两者都通过 `kubesphere-config` 下发，不在接口层暴露。

## 不变量

1. 状态取自 `status.state`，缺失按 Active。
2. 最近登录优先 `status.lastLoginTime`，回退注解，仍无则「尚未登录」。
3. 登录记录失败不影响基本信息。
4. `spec.success` 不是布尔时状态显示 `-`，不填失败。
5. 重置密码请求体不含 `currentPassword`。
6. 登录记录的裁剪只作用于当前登录用户，不触碰其他用户的记录。
7. 裁剪与 `lastLoginTime` 更新失败都不改变登录结果：`RecordLogin` 仍返回 nil。
8. `status.lastLoginTime` 只前进不后退。

## 已知坑

- **loginrecords 是集合不是字段**：别在用户对象上找登录历史。
- **记录对象没有 time 字段**：时间在 `metadata.creationTimestamp`；状态在 `spec.success`；IP 在 `spec.sourceIP`；原因在 `spec.reason`。`spec.provider` 在本集群常为空，不作为列。
- **管理员重置不能带 currentPassword**：带了会 400。
- **登录列表读的是 informer 缓存**：裁剪通过 API 直接删除对象，缓存由 watch 收敛；刚删完的一瞬间列表里可能还留着已删记录，`totalItems` 也是缓存值。不要因为这种瞬时差异判定裁剪失败，验证时以 API 直查为准。
- **裁剪按 `metadata.creationTimestamp` 排序**：`LoginRecord` 用 `GenerateName` 创建，名字不体现先后，只能靠时间戳。
- **不要再引入后台清理控制器**：那正是导致 OOM 与关闭超时的原因。若要一次性收敛历史遗留数据，单独跑批量脚本，不要把常驻逻辑加回控制面。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/access-control/TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01.yaml` 及 `-02`、`-03`、`-04`。
可观测点：`user-detail:surface`、`user-detail:basic`、`user-detail:logins`、`user-detail:login-list`、`user-detail:login-total`、`user-detail:reset`、`user-reset:submit`。

裁剪与时间更新的后端单测在 `kube-server/pkg/models/auth/login_recoder_test.go`：超额删除、过期删除、只影响当前用户、清理失败不影响登录、`lastLoginTime` 不回退。

## 后续改进

- 该用户在各项目/企业空间的角色。
- 现网历史遗留记录（本集群曾达 11,611 条）不会因为本次改动自动收敛：只有再次登录的用户才会被裁剪。若需一次性收敛，单独跑批量脚本。

## 验收用例

- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03
- TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04
