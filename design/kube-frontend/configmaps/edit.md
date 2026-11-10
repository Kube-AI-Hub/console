# 编辑配置字典 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/edit.md`](../../../prd/kube-frontend/configmaps/edit.md)。

## 概述

三个编辑入口共用一套读取与写回逻辑：三者都提交到 `PUT .../configmaps/{name}`，差别只在提交的对象内容。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03`

## 设计目标与非目标

**目标**：每次只改它负责的字段；并发写入不互相覆盖；YAML 提交前拦住语法与改名。

**非目标**：不做重命名、labels 编辑器、变更历史。

## 关键约束

- 更新走 `PUT`，提交前先 `GET` 取最新 `metadata.resourceVersion`——与 `console/src/stores/base.js:262-276` 相同的两步写入。
- 编辑信息使用 `PATCH`，只提交 `metadata.annotations`，避免整对象替换时丢掉别人刚改的 `data`。
- 编辑设置与编辑 YAML 使用 `PUT`，因为它们本来就要整对象替换。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01 — 三种编辑分成三个入口

**为什么**：三者需要的权限不同（部分集群允许改注解但禁止改数据），合并成一个弹窗会让「只改描述」看起来像数据变更，也让权限表达失真。旧 console 同样是三个入口。

**被否方案**：一个弹窗内分 Tab。少一次点击，但提交语义模糊：用户不确定点保存会改哪些字段。

**何时重新考虑**：若上游开始提供按字段的差异提交。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02 — 编辑信息用 PATCH 而非 PUT

**为什么**：PUT 需要提交完整对象，而弹窗只知道别名与描述。用 PUT 就得先取整个对象再合并，一旦有人在此期间改了 `data`，合并会覆盖那次修改。PATCH 只携带要改的注解，天然避免这个问题。

**被否方案**：统一用 PUT，与旧 console 的 `resource.baseinfo.edit` 保持一致。旧实现同样用 PATCH（`console/src/stores/base.js:283-289`），因此不构成偏离。

**何时重新考虑**：上游对 PATCH 的合并类型有变更时。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03 — 编辑 YAML 提交前校验名称一致

**为什么**：改名不是一次更新能表达的操作，若允许 YAML 改 `metadata.name`，`PUT` 会打到旧名称上而对象里却是新名称，结果是被上游静默忽略或报错。提前拒绝并提示，比让用户猜更诚实。

**被否方案**：静默把名称改回原值。用户会以为自己改成功了。

**何时重新考虑**：产品决定支持重命名时，改为删除重建的显式流程。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-04 — 打开弹窗前先取完整对象

**为什么**：列表只携带摘要（名称、描述、键名），没有 `data` 与注解。若先用摘要打开弹窗再异步补数据，用户会看到一瞬间的空编辑器，并且有机会在数据到达前保存空内容覆盖真实数据。

**被否方案**：用摘要打开、后台补全。少一次等待，但存在覆盖风险。

**何时重新考虑**：列表开始返回完整对象时。

## 系统现状

编辑能力此前完全缺失；写方法由前缀代理转发，BFF 不新增路由。

## 仓库落点

- 弹窗：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapEditDialogs.tsx`
- YAML：`ConfigMapYamlDialog.tsx`
- 请求：`kube-frontend/packages/api-client/src/configmaps.ts`（`update`、`patch`）

## 对外契约

`PUT` 与 `PATCH` 打在既有的 `.../configmaps/{name}` 上，方法与旧 console 相同，无新端点。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01** — 编辑信息不得提交 `data`；编辑设置不得提交注解变更。
- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02** — 任何写操作成功后都必须失效列表与详情两处缓存。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01** — `resourceVersion` 过期会得到 409，而界面上看不出原因。
  处置：`update` 内部先读取再写入；仍失败时呈现上游消息。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02** — 只失效列表前缀会让详情页停留在旧内容。
  处置：同时失效 `['configmaps']` 与 `['configmap']`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03** — 键改名成已存在的键时，若直接写入 map，会静默丢掉另一条配置。
  处置：数据编辑器在提交前检查重名。

## 测试与可观测

- 单元：别名校验、键重复、YAML 改名拒绝、提交对象形状。
- 约束：写操作成功后列表与详情都被刷新。

## 后续改进

与需求「明确不做」保持一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-EDIT-03`
