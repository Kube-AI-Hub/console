# 用户详情（L3）

[子模块需求](./_index.md)

## 概述

一个平台用户的详情：账号本身（邮箱、平台角色、状态、创建时间、最近登录、描述）与**登录历史**（最近若干次登录的时间与方式）。

状态列只能说明「是否被停用」；**被停用**与**没人使用**在列表里长得一样，登录历史是区分它们的唯一证据。

## 用户故事

### US1 - 确认这个账号最近有没有在用 (Priority: P1)

作为 **平台管理员**，我希望 **看到某个用户的最近登录记录**，以便 **判断账号是需要清理还是只是暂时没人用**。

**Independent Test**：打开用户详情，核对最近登录时间与用户对象 `status.lastLoginTime` 一致，登录记录条数等于接口返回条数。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 已知平台上有用户，当从列表点用户名进入详情，则显示用户名、邮箱、平台角色、状态、创建时间、最近登录与描述；「最近登录」等于用户对象 `status.lastLoginTime`；登录历史列出最近 10 条记录（时间 + 方式），条数等于 `/users/<名>/loginrecords` 返回条数；没有记录时显示空态说明。

## 设计目标

1. 一屏回答「这个账号是谁、还在不在用」。
2. 登录历史取自平台自己的记录，不靠时间戳推断。

## 约束与边界

- 读 `/kapis/iam.kubesphere.io/v1alpha2/users/<name>` 与 `…/loginrecords?limit=10`。
- 只读；停用/启用与删除不在本页。

## UI 交互设计

- 顶部返回链接 + 用户名 + 状态徽标。
- 基本信息两列；描述单独一行。
- 登录历史：每行「时间 + 方式（provider · reason）」。

## 文案与校验

- 无登录记录：没有记录到登录。
- 登录接口不可用：登录记录不可用（只有该区块降级，基本信息仍在）。
- 空值统一 `-`。

## 边界情况

- `status.state` 缺失：按 Active 显示（平台从未停用过）。
- `status.lastLoginTime` 缺失：回退到 `iam.kubesphere.io/last-login-time` 注解，仍无则 `-`。

## 明确不做

- 停用/启用与删除：在用户列表的行操作里完成，详情页只读。
- 该用户在项目/企业空间里的角色：需要跨聚合查询，与成员管理重叠。

## 假设

- 登录记录由 apiserver 在每次登录时写入，按用户命名空间内的对象存放。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 读用户对象展示基本信息与状态。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02** — 读该用户的登录记录并降级展示。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-01** — 最近登录与 `status.lastLoginTime` 一致；登录记录条数与接口一致。
