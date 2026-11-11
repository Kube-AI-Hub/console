# 保密字典列表 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/list.md`](../../../prd/kube-frontend/secrets/list.md)。

## 概述

列表由 ai-kit `ResourceList` 渲染。列是数据（`ListSchema.columns`），页面只提供「这个资源有哪些列」与「点击某行某动作时做什么」。类型到中文名的翻译在 `secretTypeLabel()` 一处实现，列表与详情共用。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-LIST-01`
- `AC-L3-KUBE-FRONTEND-SECRETS-LIST-02`

## 设计目标与非目标

**目标**：四类类型的中文名与老控制台逐字一致；未知类型原样显示；排序与分页由服务端完成。

**非目标**：列显隐设置、列宽拖拽、列表内展示键名或值。

## 关键约束

- `rowKey` 为 `name`（同一列表内名称唯一，跨项目时以项目区分展示）。
- 排序键使用上游拼写 `name` / `createTime`——与显示用的列 key 一致，否则排序开关会失效（配置字典踩过的坑）。
- 列可见性由 `hideBelow` 声明，不在 CSS 里散落断点。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-LIST-01 — 类型列宽固定、未知类型不截断为「其他」

**为什么**：类型决定可用性，用户需要看到确切字符串（例如 `kubernetes.io/ssh-auth` 与 `Opaque` 的处理方式完全不同）。折成「其他」会让排查失去线索。

**被否方案**：未知类型统一显示「其他类型」。信息量下降，且与老控制台不一致（老控制台就是原样显示）。

**何时重新考虑**：出现大量 CRD 定义的类型且列表被噪声淹没时，再考虑折叠显示并保留 title。

### DEC-L3-KUBE-FRONTEND-SECRETS-LIST-02 — 名称后追加「默认仓库」徽标

**为什么**：默认镜像仓库是注解，列表里看不到就会让用户在别处（镜像页面）猜。徽标只追加、不替换名称，符合「别名替换名称、附加状态用徽标」的统一规则。

**被否方案**：增加一列「默认」。多一列在窄屏就会被折叠，而徽标在名称旁边始终可见。

## 系统现状

老控制台 `pages/projects/containers/Secrets/index.jsx` 提供同样的四列；新页面多出「项目」列（支持跨项目视图），并复用配置字典的 `useResourceListState`。

## 仓库落点

| 层 | 路径 |
|---|---|
| 页面 | `apps/console-next/src/pages/secrets/SecretsPage.tsx` |
| 查询 | `apps/console-next/src/pages/secrets/queries.ts` |
| 列表状态 | `apps/console-next/src/components/resource/useResourceListState.ts` |
| 类型表 | `apps/console-next/src/pages/secrets/secretTypes.ts` |
| 接口 | `packages/api-client/src/secrets.ts`、`resources.ts` |
| 文案 | `packages/locales/src/index.ts`（`secrets.column.*`、`secrets.type.*`） |

## 对外契约

见 L2 技术方案「端点与注解」一节；本功能点不新增端点。

### DEC-L3-KUBE-FRONTEND-SECRETS-LIST-03 — 列定义内联在页面组件

**为什么**：配置字典技术方案中「列定义放组件内」那条决策把「等第二个使用者出现再抽列定义」定为目标。保密字典出现后，比较两份列定义发现**只有列本身不同**，抽出的是「列的数据结构」而不是「列的内容」——这部分已经由 `ListSchema` 承担。继续内联保持了「一个资源 = 一份列定义」的可读性。

**被否方案**：把三个资源的列定义集中到 `resourceColumns.ts`。所有列访问器都会退化成 `any`，类型安全的收益丢失。

**何时重新考虑**：出现两个资源的列结构完全相同（例如只有名称与时间的清单页）。

### DEC-L3-KUBE-FRONTEND-SECRETS-LIST-04 — 字段数在 `md` 以下折叠，类型在 `lg` 以下折叠

**为什么**：手机宽度下只能放得下名称与操作。名称已经在单元格里内含「默认仓库」徽标与描述，仍能回答「这是什么」；把类型挤进去会让名称被截断到不可读。

**被否方案**：把类型并进名称第二行。第二行已经是描述，两段信息挤在一行会在窄屏互相截断。

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-LIST-01** — 类型的中文名只由 `secretTypeLabel()` 产生，列表与详情调用同一个函数。
- **INV-L3-KUBE-FRONTEND-SECRETS-LIST-02** — 列表行不出现任何 `data` 的键或值。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-LIST-01** — `type` 为空字符串的对象（老版本 API 写入、未经 defaulting）直接显示成空白单元格。
  处置：`toSecretSummary` 把空类型折成 `Opaque`（kube-apiserver 的 defaulting 结果），显示「默认」。
- **GOT-L3-KUBE-FRONTEND-SECRETS-LIST-02** — 默认徽标与联邦徽标同时出现时挤占名称宽度。
  处置：两个徽标都 `shrink-0`，名称 `truncate` 并带 `title`。

## 测试与可观测

- 单元：`test/secrets-page.test.tsx`（类型标签映射）、`packages/api-client/test/secrets.test.ts`（`toSecretSummary` 对空类型与字段数的处理）。
- 端到端：`tests/ui/specs/kube-frontend/secrets/TC-L3-KUBE-FRONTEND-SECRETS-LIST-*.yaml`。

## 后续改进

列显隐设置留待用户提出需求；当前断点折叠已经覆盖手机。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-LIST-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-LIST-02`
