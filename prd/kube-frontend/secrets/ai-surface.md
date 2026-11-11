# 保密字典 · 智能体可操作性（L3）

## 概述

保密字典页与其他资源页遵循同一套智能体契约（`data-ai-id` / `data-ai-state` / `data-ai-row` / `data-ai-needs`），并在 `registerPage` 中登记自己的动作。区别在于**遮挡**也必须对智能体成立：页面声明「值默认隐藏」，只有显式点击「显示明文」才能读到明文。

## 用户故事

### US1 - 作为智能体，只靠稳定句柄完成「创建一条凭据 → 找到它 → 删除它」

**Independent Test**：依次操作 `secrets:create`、`secrets:field-name`、`secrets:create-next`、`secrets:data-add`、`secrets:data-key`、`secrets:data-value`、`secrets:data-save`、`secrets:create-submit`，然后用 `[data-ai-row=<name>]` 定位并走删除流程；每一步后读取 `secrets:surface` 的 `data-ai-state`。

### US2 - 作为智能体，识别页面的四种状态并走通的恢复路径

**Independent Test**：正常时为 `ready`；搜索无匹配为 `empty`；上游失败为 `error` 且 `secrets:retry` 可点；403 时为 `error` 且**没有**重试按钮。

## 验收场景

- **AC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01** — Given 打开保密字典列表，When 读取 `secrets:surface` 的 `data-ai-state` 与各行的 `data-ai-row`，Then 状态为四态之一、行为对象名；`secrets:search`、`secrets:create`、`secrets:bulk-delete` 均存在且 `secrets:bulk-delete` 带 `data-ai-needs="secrets:row-select"`；详情页存在 `secret-detail:toggle-values` 且其 `aria-pressed` 初始为 `false`。

## 设计目标

- 句柄不随文案变化，也不依赖 DOM 层级：文案改动不应让自动化失效。
- 遮挡对机器同样成立：智能体默认读不到明文，必须显式展开——这把「意外泄露」的风险从人类扩展到自动化。

## 约束与边界

- 句柄格式 `区域:动作`，列表区域 `secrets`、详情区域 `secret-detail`。
- 复选框句柄 `secrets:select:<name>`，排序句柄 `secrets:sort:<key>`。
- 页面只能通过 `AiSurface` 发布状态（契约测试 `ai-surface-contract.test.ts` 会读源码校验）。
- ai-kit 的 `Select` 不透传额外属性，因此其句柄挂在包裹的 `AiSurface` 上（`secrets:field-type`、`secrets:field-project`）。

## UI 交互设计

- 状态四态与其它资源页一致；错误态面板的句柄为 `resource-error`。
- 写操作的错误以 `resource-mutation-error` 展示，不把列表变成错误页。

## 文案与校验

- 句柄与 manifest 的 `actions[].id` 必须一致（`secrets:search`、`secrets:create`、`secrets:row-select`、`secrets:bulk-delete`）。

## 边界情况

- 详情 URL 直接打开：状态从 `loading` 变 `ready`，无需经过列表。
- 删除确认：智能体必须填写 `secrets:delete-input` 才能点 `secrets:delete-confirm`（禁用状态可读）。

## 功能需求

- **FR-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01** — 列表与详情的交互元素必须带稳定 `data-ai-id`，区域必须带 `data-ai-state`。
- **FR-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-02** — 明文可见性必须通过带 `aria-pressed` 的按钮切换，默认遮挡。

## 成功标准

- **SC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01** — 契约测试与页面用例均通过，`ai-surface-contract.test.ts` 覆盖新增页面文件。

## 明确不做

- 不做自然语言指令解析（由上层智能体完成）。
- 不为每个表单字段都提供句柄（只覆盖可被自动化驱动的控件）。

## 假设

- 智能体读取 DOM 属性，而不是 OCR 截图。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01`
