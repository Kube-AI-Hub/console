# 保密字典详情 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/detail.md`](../../../prd/kube-frontend/secrets/detail.md)。

## 概述

详情路由读取 `GET .../secrets/{name}`，渲染属性区与 `SecretDataSection`。数据区按类型分派到四个渲染分支；眼睛按钮控制一个 `revealed` 布尔值。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01`
- `AC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02`

## 设计目标与非目标

**目标**：默认遮挡、切换可逆、遮挡长度等于原文长度；四种类型的结构差异只在渲染层体现。

**非目标**：复制值、就地编辑、labels/annotations 展示。

## 关键约束

- 遮挡函数 `maskValue()` 是纯函数，按解码后的字符数生成 `*`。
- `revealed` 是组件状态，不用 `localStorage`：刷新即恢复遮挡。
- 「设为默认镜像仓库」只在 `type === 'kubernetes.io/dockerconfigjson' && !isDefault` 时出现。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01 — 用 `ai-kit` 的 `Modal` 承载「设为默认」确认

**为什么**：确认框只需要标题、说明与两个按钮，ai-kit 的 `Modal` 已提供焦点陷阱、Esc 关闭与 `aria-modal`。自绘遮罩在第一次实测中就能被行内遮挡问题打回（实跑时确实出现过遮罩挡住后续点击）。

**被否方案**：自绘固定定位遮罩。需要重新实现焦点管理与滚动锁定，且容易与 Radix 的 `aria-hidden` 交互出错。

### DEC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02 — 先清旧默认、再设新默认

**为什么**：`is-default-class` 是注解，上游不强制唯一。老控制台 `setDefault` 先找当前默认项置 `false` 再置新项 `true`，镜像拉取器才能在只有一个 `true` 时确定选择。顺序有讲究：若先设新再清旧，中间态存在两个 `true`。

**被否方案**：只设新项。两个 `true` 会让不同组件对「哪个是默认」判断不一致。

### DEC-L3-KUBE-FRONTEND-SECRETS-DETAIL-03 — 列出 `.dockerconfigjson` 中的全部 registry

**为什么**：编辑表单只维护一个 registry，但用户可能通过 kubectl 或镜像导入写入多个。详情必须展示全部，否则「看不到的配置」会让排查失去依据。

**被否方案**：只展示第一个。与老控制台一致（它只取第一个），但那是编辑器的限制，不该扩散到只读视图。

## 系统现状

老控制台 `Secrets/Detail/index.jsx` 的属性区五项与顺序一致；`SecretDetail/index.jsx` 提供同样的眼睛按钮与四个渲染分支。

## 仓库落点

| 层 | 路径 |
|---|---|
| 路由 | `apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace.secrets.$name.tsx` |
| 数据区 | `apps/console-next/src/pages/secrets/SecretDataSection.tsx` |
| 默认项 | `apps/console-next/src/pages/secrets/queries.ts`（`useRegistrySecrets`、`useSetDefaultSecret`） |
| 接口 | `packages/api-client/src/secrets.ts`（`setDefault`） |

## 对外契约

`PATCH /api/v1/namespaces/{ns}/secrets/{name}`，`application/merge-patch+json`，body 为 `{"metadata":{"annotations":{"secret.kubesphere.io/is-default-class":"true"|"false"}}}`。

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-DETAIL-01** — 初次渲染时 `revealed === false`，页面上不存在明文。
- **INV-L3-KUBE-FRONTEND-SECRETS-DETAIL-02** — 同一项目内最多一个 Secret 带有 `is-default-class: "true"`（由「先清后设」顺序保证）。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-DETAIL-01** — 系统令牌的 `data` 里 `token` 是 JWT，长度上千；遮挡后同样上千个 `*`，会把一行撑到很宽。
  处置：值容器 `overflow-x-auto` 且 `whitespace-pre-wrap`，`*` 连续字符允许换行。
- **GOT-L3-KUBE-FRONTEND-SECRETS-DETAIL-02** — 非 UTF-8 内容（二进制证书、压缩数据）用 `atob` 解出乱码，用户会以为数据损坏。
  处置：`isTextBase64()` 用 `TextDecoder(fatal)` 判定，失败时显示「（二进制内容…）」。
- **GOT-L3-KUBE-FRONTEND-SECRETS-DETAIL-03** — 「设为默认」弹窗在打开时才拉取 registry Secret 列表；若请求失败，确认后只设置新项、不清旧项，会留下两个 `true`。
  处置：弹窗内的错误可见；同时 `setDefault` 在拿到 `previous` 时先清后设，`previous` 未知时只设新项并在 PRD 假设中记录。

## 测试与可观测

- 单元：`test/secrets-page.test.tsx`（`maskValue` 长度、`isTextBase64`）。
- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01`、`-02`。

## 后续改进

若用户需要「复制值」，应提供带二次确认的复制按钮，而不是把值放进剪贴板。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-01`
- `TC-L3-KUBE-FRONTEND-SECRETS-DETAIL-02`
