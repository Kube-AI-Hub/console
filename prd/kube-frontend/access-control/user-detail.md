# 用户详情（L3）

[子模块需求](./_index.md)

## 概述

一个平台用户的详情：账号本身（邮箱、平台角色、状态、创建时间、最近登录、描述）、**登录历史**（时间、成功/失败、来源 IP、原因，服务端分页），以及管理员**重置密码**（不填写当前密码）。

状态列只能说明「是否被停用」；**被停用**与**没人使用**在列表里长得一样，登录历史是区分它们的唯一证据。

## 用户故事

### US1 - 确认这个账号最近有没有在用 (Priority: P1)

作为 **平台管理员**，我希望 **看到某个用户的最近登录记录**，以便 **判断账号是需要清理还是只是暂时没人用**。

**Independent Test**：打开用户详情，核对最近登录时间与用户对象 `status.lastLoginTime` 一致，登录记录条数等于接口返回条数。

### US2 - 翻看完整登录历史 (Priority: P1)

作为 **平台管理员**，我希望 **登录历史按页翻看，并看到每次登录成功还是失败、从哪个 IP 来**，以便 **核对异常登录，而不是只看到最近 10 条时间戳**。

**Independent Test**：打开一个登录次数超过 10 的账号详情，核对该页行数、`totalItems`、时间/状态/来源 IP/原因四列；点下一页后行与第一页不同且总数不变。

### US3 - 为他人重置密码 (Priority: P1)

作为 **平台管理员**，我希望 **在用户详情为普通账号设置新密码，且不必知道当前密码**，以便 **用户忘记密码时能重新登录，而不去改预置账号或自己的账号**。

**Independent Test**：创建临时用户，用详情「重置密码」设成新值，用新密码能登录、旧密码不能；`admin` 详情没有该按钮。

### US4 - 登录历史不会无限增长 (Priority: P2)

作为 **平台运维**，我希望 **每个用户的登录历史自动收敛到配置的上限与保留期以内**，以便 **登录记录不会随着时间累积成几万条拖慢控制面组件**。

**Independent Test**：把某用户造到超过上限条数的记录，再触发一次该用户登录，确认记录数回落到上限以内且保留最新若干条；另一用户的条数不变。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 已知平台上有用户，当从列表点用户名进入详情，则显示用户名、邮箱、平台角色、状态、创建时间、最近登录与描述；「最近登录」等于用户对象 `status.lastLoginTime`（缺失回退注解，仍无则「尚未登录」）；登录历史列出当前页记录（默认每页 10 条），条数等于 `/users/<名>/loginrecords?page=1&limit=10` 返回的 `items` 数；没有记录时显示空态说明。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02** — 已知某用户 `/loginrecords` 的 `totalItems` 大于 10，当打开其详情，则登录历史表列为时间、状态、来源 IP、原因，当前页行数等于接口 `items` 数，标题旁显示「共 {totalItems} 条」；状态对 `spec.success===true` 显示成功、`false` 显示失败、字段缺失显示 `-` 而不是失败或 0；来源 IP 取 `spec.sourceIP`，缺失显示 `-`；点下一页后请求 `page=2`，行身份与第一页不同且总数不变；`totalItems` 不大于 10 时不出现分页控件。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03** — 已知一个非预置、非当前登录用户，当在详情点「重置密码」并填写符合规则且两次一致的新密码后保存，则 `PUT /users/<名>/password` 的请求体只有 `{ password }`（没有 `currentPassword`），随后用新密码可以登录、用旧密码不能；弱口令或两次不一致时不发请求并提示；保存失败时弹窗保持打开且已填内容仍在；`admin`、`sonarqube` 与当前登录用户的详情不出现「重置密码」。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04** — 已知某用户已积累 `loginHistoryMaximumEntries`（默认 200）条以上登录记录，当该用户再次登录成功，则该用户的 `LoginRecord` 总数回落到上限以内，保留的是时间最新的若干条；`/users/<名>/loginrecords` 的 `totalItems` 不超过上限。清理在登录写入后同步完成，不依赖后台控制器。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-05** — 已知某用户有早于 `loginHistoryRetentionPeriod` 的登录记录，当该用户再次登录成功，则这些过期记录被删除，未过期的记录不受影响；清理只作用于当前登录的用户，其他用户的记录条数不变。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-06** — 已知用户登录成功，当登录记录写入后，则该用户的 `status.lastLoginTime` 更新为本次登录时间；并发或重复登录时该字段只前进不后退；若登录记录清理失败，登录本身仍然成功（返回 token），失败只记录日志。

## 设计目标

1. 一屏回答「这个账号是谁、还在不在用」。
2. 登录历史取自平台自己的记录，不靠时间戳推断。

## 约束与边界

- 读 `/kapis/iam.kubesphere.io/v1alpha2/users/<name>` 与 `…/loginrecords?page=&limit=&sortBy=createTime&ascending=false`。
- 重置密码写 `PUT …/users/<name>/password`，请求体只有 `{ password }`。
- 停用/启用、编辑信息、删除仍在用户列表行操作；详情只提供重置密码。
- 预置账号（`admin`、`sonarqube`）与当前登录用户不可重置。
- 登录记录的清理由登录写入触发，只处理当前登录用户；上限与保留期分别取 `loginHistoryMaximumEntries`（默认 200）与 `loginHistoryRetentionPeriod`。
- 清理失败不影响登录成功；`status.lastLoginTime` 由登录写入时维护，只前进不后退。

## UI 交互设计

- 顶部：返回链接、用户名、状态徽标在左；「重置密码」在右（受保护账号不渲染该按钮）。重置弹窗：只读邮箱、新密码（强度面板 `user-reset`）、确认密码；句柄 `user-detail:reset`、`user-reset:password`、`user-reset:confirm`、`user-reset:submit`。
- 基本信息两列栅格；描述单独一行。登录历史在基本信息下方同一列，带边框卡片，标题右为「共 N 条」。
- 登录历史表四列：时间（等宽数字）、状态（成功/失败徽章，未知为 `-`）、来源 IP（等宽，`hideOnMobile`）、原因。默认每页 10 条；`totalItems` 大于 10 时底部分页（`user-detail:logins:page:next`）。1024 宽下来源 IP 可随表格内部横滚，不把未知状态画成失败。

## 文案与校验

- 无登录记录：没有记录到登录。
- 登录接口不可用：登录记录不可用（只有该区块降级，基本信息仍在）。
- 空值、缺失 `spec.success`、缺失来源 IP 统一 `-`，不填 0、不标失败。
- 重置密码：新密码规则与创建用户相同；两次不一致提示「两次输入的密码不一致。」

## 边界情况

- `status.state` 缺失：按 Active 显示（平台从未停用过）。
- `status.lastLoginTime` 缺失：回退到 `iam.kubesphere.io/last-login-time` 注解，仍无则「尚未登录」。

## 明确不做

- 停用/启用、编辑信息与删除：在用户列表的行操作里完成。
- 该用户在项目/企业空间里的角色：需要跨聚合查询，与成员管理重叠。
- 不把个人设置的「改自己的密码」（必须填当前密码）做成详情上的重置。
- 不做后台定时清理登录记录：清理只在登录写入时按用户同步执行。
- 不做一次性批量清理历史遗留记录：只影响此后登录的用户。

## 假设

- 登录记录由 apiserver 在每次登录时写入，按用户命名空间内的对象存放。
- `loginHistoryMaximumEntries` 与 `loginHistoryRetentionPeriod` 由平台配置下发；上限为 0 或缺失时不按条数裁剪，保留期为 0 时不按时间裁剪。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03`
- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 读用户对象展示基本信息与状态。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02** — 读该用户的登录记录并按页展示时间、状态、来源 IP 与原因；缺 `spec.success` 不显示为失败。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03** — 对非保护账号提供管理员重置密码，请求体不含当前密码。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04** — 登录写入后按当前用户裁剪超出 `loginHistoryMaximumEntries` 的最旧记录，并删除早于 `loginHistoryRetentionPeriod` 的记录。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-05** — 登录写入后更新该用户 `status.lastLoginTime`，只前进不后退；清理与更新时间失败不影响登录结果。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 最近登录与 `status.lastLoginTime` 一致；当前页条数与接口 `items` 一致。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02** — `totalItems` 大于 10 时可翻页，两页行身份不同且总数等于接口 `totalItems`。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-03** — 重置后新密码可登录、旧密码不可；预置与当前用户无入口。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04** — 一次登录后该用户记录数不超过上限，且保留的是最新记录；其他用户记录数不变。
- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-05** — 登录成功后 `lastLoginTime` 等于本次时间；清理失败时登录仍返回 token。
