# 创建配置字典 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/create.md`](../../../prd/kube-frontend/configmaps/create.md)。

## 概述

两步表单加 YAML 模式，提交到与旧 console 相同的 kapis 集合端点。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04`

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01 — 表单与 YAML 两个模式共用一个弹窗

**为什么**：旧 console 用一个弹窗加右上角开关。两种模式的提交目标、成功反馈、错误呈现完全相同，做成两个弹窗会有两份几乎一样的代码。

**被否方案**：只做 YAML、或只做表单。前者对「加两个键」这种最常见的操作过于沉重；后者无法粘贴现成对象。

**何时重新考虑**：YAML 需要独立的校验面板或 diff 预览时。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02 — 名称重复检查放在「下一步」处

**为什么**：旧 console 在名称字段上用异步校验。放在进入下一步之前，用户不会先花时间录完数据才发现名字被占用。

**被否方案**：只在提交时检查。省一次请求，但失败发生得太晚。

**何时重新考虑**：名称检查本身变慢到影响操作时，改为失焦触发。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03 — 数据键禁止斜杠、允许点号

**为什么**：kube 允许点号（`app.yaml` 是合法且常见的键），禁止斜杠（会被解析成路径）。原计划两者都禁，实测时发现会把已有对象判为非法，因此只保留斜杠限制。

**被否方案**：完全不做键校验，与旧 console 一致。旧行为允许空键与重复键，会静默丢数据，这类缺陷不继承。

**何时重新考虑**：上游开始对键做更严格的校验时，以它的规则为准。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04 — YAML 编辑器用 CodeMirror 6

**为什么**：需要高亮、补全与语法校验，而应用要能在离网集群里运行。CodeMirror 6 是 ESM、可按需引入、无独立 worker 包；编辑器整体懒加载，不进首屏。

**被否方案**：Monaco（体积与 worker 配置成本高）、Ace（旧 console 的选择，但为非 ESM 时代的产物）。

**何时重新考虑**：需要多文件编辑或 diff 视图时。

## 系统现状

创建入口此前只有按钮没有行为；BFF 无写方法；`POST` 经前缀代理转发，无需新增路由。

## 仓库落点

- 弹窗：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapCreateDialog.tsx`
- 数据编辑：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapDataEditor.tsx`
- YAML：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapYamlDialog.tsx` + `console/packages/ai-kit/src/editor/YamlEditor.tsx`
- 请求：`kube-frontend/packages/api-client/src/configmaps.ts`（`create`、`toKubeObject`）

## 对外契约

`POST` 请求体为 kube 原生 `ConfigMap`；响应同一对象。前端映射为 `ConfigMapDetail`。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01** — 两种模式最终都生成 `{apiVersion:'v1', kind:'ConfigMap', metadata, data}` 形状的对象。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01** — 数据子表单打开时若允许提交，未保存的键值会被丢弃。
  处置：子表单打开期间禁用主提交按钮，由 `onEditingChange` 上报。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02** — 主操作 `onAction('create', row)` 收到的 `row` 是 `undefined`；若处理器先判 `if (!row) return`，创建按钮会静默失效。
  处置：先处理主操作，再处理行操作。该问题在浏览器实测中发现，已补回归用例。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03** — kapis 在开发 harness（`kubectl proxy`）下忽略 `page` 且不返回 `totalItems`，会让分页看起来失效。
  处置：只在 `kube` 模式于 BFF 内模拟分页与总数；产品路径仍由 kapis 完成。

## 测试与可观测

- 单元：名称规则、重复名称、数据键规则、两种模式提交形状。
- 约束：创建按钮与弹窗需带 `data-ai-id`。

## 后续改进

届时先改需求，再调整表单。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-03`

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-05 — 项目放在弹窗内选择，且由页面持有

**为什么**：老 console 的创建第一步有必填的项目选择器，而 `namespace` 只从路由取会让「全部项目」视图下无法创建。
所选项目同时决定两件事：名称查重跑在哪个命名空间、YAML 模式落到哪里，所以它属于页面状态（`Dialog.create.namespace`）而不是弹窗内部状态。

选项复用列表页的 `useProjectOptions(qcluster)`：同一条 React Query 缓存，打开弹窗不会再次拉取集群全部项目。

**被否方案**：弹窗内自己请求项目列表。老 console 的每个 `ProjectSelect` 都自建 store，开三个选择器就是三次相同查询。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-06 — 模态框位移交给 `translate`，动画只管 `transform`

**为什么**：元素用 `-translate-x-1/2 -translate-y-1/2` 居中（`translate` 属性），而关键帧再次 `translate(-50%,-50%)`（`transform` 属性）会让元素在动画期间被位移两次；`fill-mode` 为 `none` 时结束帧被丢弃，表现为从左上角滑入。
改为关键帧只动 `scale`/`opacity`，并补 `both`，两个属性各管一件事。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-07 — 编辑器高亮用语义色，不用 CodeMirror 默认调色板

**为什么**：CodeMirror 默认调色板按白底设计（键名 `rgb(0,0,204)`），在 `--ai-bg-elevated` 的深蓝面板上几乎看不清。改为 `--ai-code-*` 语义变量，暗/亮主题各一套，随 `data-theme` 自动切换。

**注意**：这些变量是**通道值**（`126 184 220`），必须写成 `rgb(var(--x))`；裸 `var(--x)` 会被当作非法颜色而回退到继承色——这正是第一次改动后高亮仍未生效的原因。

同时去掉 `lintGutter()`：诊断仍以波浪线画在正文上，而该槽位在行号与代码之间多占了 17px。

## 设计目标与非目标

**目标**：非法输入在提交前被拦下；两种录入方式产出同一形状的对象。

**非目标**：不做标签输入、多文档 YAML、批量导入。

## 关键约束

- 端点：`POST /kapis/resources.kubesphere.io/v1alpha3[/clusters/{c}]/namespaces/{ns}/configmaps`，与 `console/src/stores/base.js:252-260` 一致。
- BFF 只做前缀转发，不做业务校验；校验在前端表单与上游各一次，BFF 不引入第三份规则。
- 别名与描述写入 `kubesphere.io/alias-name` / `kubesphere.io/description`。

## 方案决策

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-04** — ai-kit 的颜色 token 是**通道值**（`126 184 220`），必须写成 `rgb(var(--x))`。裸 `var(--x)` 会被当作非法颜色**静默**回退到继承色，编译、类型检查、测试全部通过，只有肉眼或 `getComputedStyle` 能发现。
  处置：高亮与编辑器主题里的每一处颜色都检查是否已包裹 `rgb()`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-CREATE-05** — 居中元素的动画不要动 `transform` 里的位移：`-translate-x-1/2` 走的是 `translate` 属性，若关键帧再写 `translate(-50%,-50%)`，动画期间位移两次，且 `fill-mode: none` 会在结束时丢帧，表现为从左上角滑入。
  处置：关键帧只动 `scale`/`opacity`，并补 `both`。
