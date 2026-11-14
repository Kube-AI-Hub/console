# 租户(企业空间)配额（L3）

[子模块需求](./_index.md)

## 概述

租户(企业空间)控制台的 **配额** 页：`/kube-frontend/workspaces/<ws>/quota`。它回答「这个租户(企业空间)下各项目分到了多少资源、已经用掉多少」，数据粒度是**项目 × 资源**。

老 console 的 `/workspaces/:ws/quota` 展示的是**租户(企业空间)级** ResourceQuota（`quota.kubesphere.io` 的 CR，每个集群一份）。新 UI 沿用同一读者，但数据源按本部署上真正可枚举的对象改成项目级 ResourceQuota（见「明确不做」的探测证据）。

## 用户故事

### US1 - 租户(企业空间)管理员看配额分布 (Priority: P1)

作为 **租户(企业空间)管理员**，我希望 **在一张表里看到这个空间下每个项目的配额上限与已用量**，以便 **判断哪个项目快用满、要不要调整配额**。

**Independent Test**：打开 `/workspaces/<ws>/quota`，核对行数等于「该空间各项目 ResourceQuota 中 `spec.hard` 条目数之和」，且行内的限额/已用与接口值一致。

## 验收场景

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02** — 已知租户(企业空间)内有 P 个项目、这些项目的 ResourceQuota 共含 N 条 `spec.hard` 资源（可能为 0），当打开该空间的配额页，则页面列出 N 行，每行显示项目、资源键、上限与已用（已用取 `status.used`，缺失时为 0）；N 为 0 时显示空态并说明「这些项目还没有设置资源配额」；接口失败时显示错误面板与重试，而不是空态。

## 设计目标

1. 一个读者问题（「各项目配额与用量」）一张表答完，不要求逐个项目点进去。
2. 行的含义只有一种：项目 + 资源键；同一项目多条资源就是多行，不做嵌套表格。
3. 数据来源用**项目命名空间**的 ResourceQuota，与项目详情的「配额」口径一致。

## 约束与边界

- 只读：编辑配额是项目详情页的功能（`QuotaEditDialog`），本页不复制写入口。
- 一次取全：先取该空间的项目，再按项目取 ResourceQuota（每个项目一个请求），前端分页，页大小 20。
- 行数按 `spec.hard` 的键展开；`status.used` 只有部分资源会出现，缺失按 0 显示（Kubernetes 对尚无用量的资源不写 key，这是正常状态而不是数据缺失）。

## UI 交互设计

- 页面头：标题「配额」、描述「该租户(企业空间)下各项目的配额与用量。」
- 表：项目 / 资源 / 上限 / 已使用；「上限」「已使用」右对齐等宽数字。
- 超过 20 行时出现分页器。
- `data-ai-id`：`workspace-quota:surface`（列表容器）、`workspace-quota:retry`（错误重试）。

## 文案与校验

- 列名：项目 → `workspace.field.project`；资源 → `projectInfo.quota.resource`；上限 → `projectInfo.quota.hard`；已使用 → `projectInfo.quota.used`。
- 空态：标题「暂无数据」（`common.empty`）；描述按有无项目分两种——有项目但无配额时用 `workspace.quota.empty`（「这些项目还没有设置资源配额。」），无项目时用 `workspace.projects.emptyDescription`。
- 空值统一显示 `-`。

## 边界情况

- 项目很多：一次 `limit=-1` 读项目；ResourceQuota 的读取并发发出（`Promise.all`），失败即整页错误面板，不把失败的项目伪装成「没有配额」。
- 项目没有 ResourceQuota：该项目不产生行；若全部项目都没有，则是空态。
- 一个项目有多个 ResourceQuota：全部展开（每个对象的 `spec.hard` 都算），不静默只取第一个。
- 资源键是任意字符串（如 `requests.nvidia.com/gpu`）：按原样显示，不维护白名单。

## 明确不做

- **租户(企业空间)级配额**：本部署**不可枚举**。探测证据（admin token，B200）：
  - `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/public/resourcequotas` → **405**（ks-apiserver 只注册了 POST 与 `{name}` 的 GET/PUT/DELETE，没有集合 GET）；
  - `GET /kapis/resources.kubesphere.io/v1alpha3/workspaces/public/resourcequotas` → **404**；
  - `GET /apis/quota.kubesphere.io/v1alpha2/resourcequotas` → 200，`items: []`（集群内 0 个对象）；
  - `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces/public/resourcequotas/public` → **404** `resourcequotas.quota.kubesphere.io "public" not found`。
  因此不做一个「空间级配额」区块：没有对象、也没有能列出对象的接口。
- 配额编辑（写）：属于项目详情页；本页只读。
- 用量趋势/图表：需要监控后端，本页只显示 ResourceQuota 的 `status.used` 快照。

## 假设

- 每个项目的 ResourceQuota 可由该项目命名空间的集合接口读到（`GET /api/v1/namespaces/<ns>/resourcequotas`，实测 200）。
- 行数在 500 以内，一次取全后客户端分页足够；超过 500 时仍是「取全」，因为项目级配额条目本身不会到量级问题。

## 功能需求

- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02** — 配额页按「项目 × 资源」列出上限与已用，空态区分「没有项目」与「这些项目还没有设置资源配额」。
- **FR-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-03** — 读取失败时给出错误面板与重试，不降级为空态。

## 成功标准

- **SC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02** — 行数与接口展开一致；上限/已用逐列与接口一致；空态/错误态可区分。

## 验收用例

- `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-02`
