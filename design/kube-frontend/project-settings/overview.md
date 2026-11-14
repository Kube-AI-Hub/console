# 项目概览 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/project-overview/overview.md)

## 概述

项目落地页：基本信息 + 配额使用 + 限额范围 + 快捷入口，只读。

## 关联需求

- AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01

## 设计目标与非目标

目标：一屏回答「项目是什么、还有多少余量、下一步去哪」。非目标：用量排行、应用、配额编辑。

## 关键约束

- 项目信息与配额：`projectInfoApi`（namespace 对象 + `/api/v1/namespaces/<ns>/resourcequotas`）。
- 限额范围：`GET /api/v1/namespaces/<ns>/limitranges`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01 — 配额外全部用核心 API

**为什么**：`resources.kubesphere.io` 代理对 `resourcequotas`/`limitranges` 返回 `resource is not supported`（实测），而核心 API 可读。混用两套会让「有的块能出、有的块 404」。
**被否方案**：走 kapis 聚合的 project summary。本集群返回 404。
**何时重新考虑**：资源代理补齐这两个资源时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-02 — 配额显示「已用 / 硬限」而不仅是硬限

**为什么**：项目设置页展示的是硬限（用于编辑），概览要回答「还剩多少」，所以必须带已用与占比；只给硬限等于没回答。
**被否方案**：复制设置页的配额表。读者要自己算。
**何时重新考虑**：平台提供用量占比接口时。

### DEC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-03 — 概览页只放事实，不放引导

**为什么**：引导卡是「一次性内容占据常驻位置」：它只在首次使用时有价值，之后长期占据首屏；而概览页要回答的是「这个项目现在什么样」，两者定位冲突。对应能力在成员页与网关页都有入口，概览页不再重复。

**被否方案**：卡片可折叠——折叠态仍需一次点击才能回到事实，收益不抵成本。

## 系统现状

老 console 的项目概览 = BaseInfo + Quota + LimitRange + Applications + ResourceUsage + Help + UsageRanking。本页迁移前三项与快捷入口；应用与用量排行按模块/接口不可用登记为明确不做。

## 仓库落点

- 页面：`apps/console-next/src/pages/project/ProjectOverviewPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/overview/`
- 接口：`packages/api-client/src/iam.ts` 的 `limitRangesApi`（`projectInfoApi` 已有）
- 区域注册：`areas/registry.ts` 新增 project 区 `project-overview`（defaultPage: overview）

## 对外契约

| 用途 | 路径 |
| --- | --- |
| 项目与配额 | /api/v1/namespaces/&lt;ns&gt;/resourcequotas（+ namespace 对象） |
| 限额范围 | /api/v1/namespaces/&lt;ns&gt;/limitranges |

## 不变量

1. 配额行数等于 hard 键数。
2. 无配额/无限额显示空态而非空表。
3. 快捷入口链接均指向已注册页面。

## 已知坑

- **resources 代理不服务这两个资源**：`/kapis/resources.../namespaces/<ns>/resourcequotas` 返回 `resource is not supported`，必须走 `/api/v1`。
- **动态文案键**：`t(\`quota.resource.${key}\`)` 过不了类型检查，资源名按原样展示。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/project-overview/TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01.yaml`
可观测点：`project-overview:surface`、`:basic`、`:quota`、`:limitranges`、`:links`。

## 后续改进

- 用量排行（依赖监控区间查询）。
- 配额编辑入口（已有设置页）。

## 验收用例

- TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-OVERVIEW-01