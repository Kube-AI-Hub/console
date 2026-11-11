# 配置字典 · 技术方案（L2）

> 承接 [`prd/kube-frontend/configmaps/_index.md`](../../../prd/kube-frontend/configmaps/_index.md)。

## 概述

用 TanStack Query 承载数据、用组件内的列定义承载视图。页面上没有任何来自老 console 的抽象。

## 关联需求

- `AC-FULL-KUBE-FRONTEND-CONFIGMAPS-01`
- `FR-FULL-KUBE-FRONTEND-CONFIGMAPS-01`
- `SC-FULL-KUBE-FRONTEND-CONFIGMAPS-01`

## 设计目标与非目标

**目标**：列表行为覆盖老页面的搜索、排序、分页、批量删除；新增资源只换列与查询。

**非目标**：虚拟滚动、列显隐设置、乐观更新。

## 关键约束

- 排序与分页在服务端完成。
- 页面状态四态归一，由 `AiSurface` 发布。

## 方案决策

### DEC-FULL-KUBE-FRONTEND-CONFIGMAPS-01 — 查询键由请求参数派生

**为什么**：`queryKey` 与请求参数来自同一对象，切换 namespace 时不可能返回旧缓存。两者分开拼装是"切了项目还看到上一个项目数据"的常见来源。

**被否方案**：以 namespace 为键、其余参数放 `select` 过滤——会把分页做成客户端行为，与实际不符。

### DEC-FULL-KUBE-FRONTEND-CONFIGMAPS-02 — 删除后失效列表而非本地移除

**为什么**：上游无事务，批量删除可能部分成功。本地移除会把部分失败显示成全部成功。

**被否方案**：乐观更新 + 回滚。实现复杂度高，且与本期的"正确优先"目标不符。

### DEC-FULL-KUBE-FRONTEND-CONFIGMAPS-03 — 选态在翻页/排序/搜索时清空

**为什么**：对看不见的行执行批量删除是删错对象的主要来源。

**何时重新考虑**：若产品要求跨页多选，需要显式的"已选 N 项（含其他页）"提示。

## 系统现状

老 console 同页 147 行，其中列定义约 35 行，其余是 HOC 与 store 样板。新实现把样板下沉到框架，页面只保留列与查询。

## 页面与技术结构

| 层 | 文件 | 职责 |
|---|---|---|
| 路由 | `routes/c.$cluster.p.$namespace.configmaps.tsx` | 取参数并渲染页面 |
| 页面 | `pages/configmaps/ConfigMapsPage.tsx` | 列定义、交互、四态 |
| 查询 | `pages/configmaps/queries.ts` | queryKey、请求、删除 mutation |
| 客户端 | `packages/api-client/src/configmaps.ts` | 路径与参数 |
| BFF | `server/src/configmaps.ts` | 整形与错误归一 |

## 功能点

- 列表（`list`）
- 搜索（`search`）
- 删除（`delete`）
- 智能体可操作性（`ai-surface`）
- 移动端适配（`mobile`）

## 仓库落点

- 页面：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapsPage.tsx`
- 查询：同目录 `queries.ts`
- 路由：`src/routes/c.$cluster.p.$namespace.configmaps.tsx`
- BFF：`kube-frontend/server/src/configmaps.ts`

## 关键契约与依赖

- 依赖 `@tanstack/react-query` 的缓存失效语义。
- 依赖 kapis 的 `sortBy` / `ascending` / `page` / `limit` 参数名。
- 依赖 `@kube-ai-hub/ai-surface` 的属性常量。

## 对外契约

同 L1 的契约条目；本层额外约定：

- `sortBy` 只接受 `name` / `createdAt`，非法值返回 400。
- `pageSize` 取值 1–100。

## 状态与数据归属

- 列表数据：ks-apiserver，经 BFF 整形，前端仅内存缓存。
- 排序 / 分页 / 关键字：页面自身状态，不写入 URL（本期）。
- 已选项：页面自身状态，翻页或改查询时清空。

## 不变量

- **INV-FULL-KUBE-FRONTEND-CONFIGMAPS-01** — 请求参数与查询键同源。
- **INV-FULL-KUBE-FRONTEND-CONFIGMAPS-02** — 列表状态四态互斥，同一时刻只有一个。

## 已知坑

- **GOT-FULL-KUBE-FRONTEND-CONFIGMAPS-01** — 上游以 `ascending=true/false` 表示方向，而不是 `asc/desc`；BFF 负责转换。
- **GOT-FULL-KUBE-FRONTEND-CONFIGMAPS-02** — 描述来自注解 `kubesphere.io/description`，不是字段。
- **GOT-FULL-KUBE-FRONTEND-CONFIGMAPS-03** — 5xx 会按重试策略重试两次，页面的 `error` 态会延迟约 2 秒；权限与校验错误不重试。

## 测试与可观测

- `test/configmaps-page.test.tsx`：用真实 `fetch` stub 断言请求 URL 与渲染状态。
- BFF：`server/test/bff.test.ts` 覆盖查询解析、错误归一、路径拼装。

## 明确不做

- 不做创建 / 编辑表单。
- 不做虚拟滚动与列显隐设置。
- 不做乐观更新。

## 后续改进

- 列定义抽成可复用模块，供其他资源引用。
- 增加 `useResourceList` 泛型 hook 收敛重复逻辑。

## 验收用例

- `TC-FULL-KUBE-FRONTEND-CONFIGMAPS-01`
