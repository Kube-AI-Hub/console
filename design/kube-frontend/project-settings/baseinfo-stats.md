# 项目基本信息统计 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-settings/baseinfo-stats.md)

## 概述

`ProjectInfoPage`（项目基本信息）新增三张统计卡：成员数 / 角色数 / 服务账号数，各自读对应列表接口的 `totalItems`。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02

## 设计目标与非目标

目标：三个计数与列表页同口径，失败与零可区分。
非目标：统计图表、趋势、成员/角色/SA 的明细与写操作。

## 关键约束

- 成员：`GET /kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/members?page=1&limit=1`（`membersApi`）。
- 角色：`GET /kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/roles?page=1&limit=1`（`rolesApi`）。
- 服务账号：`GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/serviceaccounts?page=1&limit=1`（`serviceAccountsApi`）。
- 三个读取互相独立；单卡失败不拖垮页面。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02 — 用现有列表 API 的 total，而不是全量计数

**为什么**：三个资源都有现成的分页 list（api-client 已导出），`totalItems` 就是权威计数；`pageSize=1` 让请求只带回一行，统计成本与对象数量无关。
**被否方案**：`limit=-1` 拉全量再 `.length`。对象多时白下载，且与列表页分页口径可能不一致。
**何时重新考虑**：接口不再返回 total（改成 cursor 分页）时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-03 — 三张卡各自查询、失败显示 `-`

**为什么**：三类对象的读权限可能不同（服务账号走资源代理，成员/角色走 IAM）；合并成一个 `Promise.all` 会让一个 403 把三个数字都变成错误。`-` 是「读不到」，0 是「确实没有」，二者不能混。
**被否方案**：失败统一按 0 降级（假事实）；或整块隐藏（读者以为功能不存在）。
**何时重新考虑**：后端提供一次性统计聚合接口时。

## 系统现状

老 console 的 BaseInfo 在项目详情侧栏展示成员/角色等计数；新 UI 基本信息页此前只有属性与配额。项目成员页/角色页/服务账号页已经能列出这些对象，但读者要先切页面才能数。

## 仓库落点

- 页面：`apps/console-next/src/pages/settings/ProjectInfoPage.tsx`（新增三查询与 `StatCard`）
- 路由：`routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/baseinfo/`（已存在，无需改动）
- api-client：复用 `membersApi` / `rolesApi` / `serviceAccountsApi` 的 list，无新增

## 对外契约

| 用途 | 路径 | 计数字段 |
| --- | --- | --- |
| 项目成员数 | `/kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/members` | `totalItems` |
| 项目角色数 | `/kapis/iam.kubesphere.io/v1alpha2/namespaces/<ns>/roles` | `totalItems` |
| 服务账号数 | `/kapis/resources.kubesphere.io/v1alpha3/namespaces/<ns>/serviceaccounts` | `totalItems` |

## 不变量

1. 数字来自接口 `totalItems`，不是页面行数或本地累加。
2. 失败显示 `-`；0 只在接口明确返回 0 时出现。
3. 三卡任一失败不影响其他卡与属性/配额区块。
4. 统计区不渲染 `<dt>`：基本信息页原有的定义列表断言读取整页 `dt`，新增标签不能改变它。

## 已知坑

- **`total` 的字段回退**：api-client 的 list 已把 `totalItems` / `total_count` 归一为 `total`，页面用 `data.total`；缺失时 `-`。
- **两个 kapis 组**：成员/角色是 IAM，服务账号是资源代理；混用会 404。
- **不要用 `items.length`**：`pageSize=1` 时永远是 0 或 1。
- **`dt` 回归**：现有用例断言基本信息页的 `dt` 列表恰好是六个属性；统计卡必须用非 `dt` 标记。
- 查询 `retry: false`：统计是辅助信息，失败重试交给页面刷新，不在后台反复请求。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-settings/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02.yaml`
可观测点：`settings-baseinfo:stats`、`settings-baseinfo:stat:members|roles|serviceaccounts`。用例先读三个接口 `totalItems`，再断言卡片文本。

## 后续改进

- 成员/角色/服务账号卡加「查看」链接（跳对应列表页），需要统一的卡片交互设计。
- 若后端提供项目统计聚合接口，合并为一次请求。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02
