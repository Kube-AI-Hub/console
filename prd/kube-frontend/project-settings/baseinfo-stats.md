# 项目基本信息统计（L3）

[子模块需求](./_index.md)

## 概述

项目「基本信息」页新增 **统计** 区块：成员数、角色数、服务账号数三张小卡。老 console 的 BaseInfo 在这些位置展示同类计数；新 UI 此前只有属性与配额两块。

三张卡各自独立读取列表接口的 `totalItems`，读取失败显示 `-` 而不是 0。

## 用户故事

### US1 - 项目管理员一眼看到项目规模 (Priority: P1)

作为 **项目管理员**，我希望 **在基本信息页看到成员/角色/服务账号数量**，以便 **快速判断项目的人员与权限对象规模**。

**Independent Test**：打开项目基本信息页，三个数字与对应列表接口的 `totalItems` 一致；接口失败时显示 `-`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02** — 已知项目 `<ns>` 的成员/角色/服务账号列表总数为 M/R/S（可能为 0），当打开项目基本信息页，则统计区三张卡分别显示 M/R/S；任一接口失败时该卡显示 `-` 而不是 0；加载中显示占位而不是数字。

## 设计目标

1. 三个计数与各自列表页口径一致（同一个列表接口的 totalItems）。
2. 失败与零可区分：`-` 表示读不到，0 表示确实没有。

## 约束与边界

- 每个统计一次 `pageSize=1` 的列表读：只要 `totalItems`，不下载行。
- 成员/角色走 IAM 命名空间集合（`/kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/{members,roles}`）。
- 服务账号走资源代理（`/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/serviceaccounts`）。
- 只读；三卡不提供跳转以外的交互（本页无按钮）。

## UI 交互设计

- 位置：属性卡之后、配额卡之前，标题「统计」。
- 三卡网格（窄屏一列、宽屏三列），每卡：标签 + 数字。
- `data-ai-id`：`settings-baseinfo:stat:members`、`settings-baseinfo:stat:roles`、`settings-baseinfo:stat:serviceaccounts`；区块 `settings-baseinfo:stats`。
- 加载中：数字位置显示骨架；失败：`-`；成功：整数。

## 文案与校验

- 区块与标签：`settings.baseInfo.stats` / `statMembers` / `statRoles` / `statServiceAccounts`。
- 数字为服务器 `totalItems`，不自行累加页面数据。

## 边界情况

- 接口返回 200 但无 `totalItems`：按已取回条数（0 或 1）显示时必须以 total 字段为准——本实现以接口返回的 total 为准，缺失时显示 `-`。
- 接口 403/404/网络失败：该卡 `-`，不影响属性与配额区块。
- 数量为 0：显示 0（与失败可区分）。
- 项目不存在：整页错误面板（由页面既有逻辑处理）。

## 明确不做

- 统计明细（成员列表、角色列表、服务账号列表）：各自页面已有。
- 变更趋势、图表、告警阈值。
- 新增写操作：本任务只读。

## 假设

- 三个列表接口都返回 `totalItems`（本部署实测 200，字段存在）。
- 统计口径与对应列表页一致：成员=项目成员绑定条数，角色=项目角色对象数，服务账号=项目内 SA 对象数。

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-STATS-01** — 基本信息页展示成员/角色/服务账号三张统计卡。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-STATS-02** — 读取失败显示 `-` 而不是 0。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-STATS-01** — 三卡数字与接口 `totalItems` 一致；失败态可区分。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02`
