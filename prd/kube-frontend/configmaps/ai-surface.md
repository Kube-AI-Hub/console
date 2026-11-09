# 智能体可操作性（L3）

## 概述

让自动化在不看截图、不依赖文案的前提下操作这个界面。界面语义是产品能力的一部分，不是测试辅助。

## 用户故事

### US1 - 作为智能体，判断页面是否可用再行动

**Independent Test**：轮询 `data-ai-state`，在 `loading` 时不点击任何操作；在 `ready` 后枚举 `data-ai-id` 并完成一次搜索。

### US2 - 作为智能体，知道某个动作为什么不可用

**Independent Test**：读取「批量删除」按钮的 `data-ai-needs`，据此先执行选择动作，再点击删除。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01** — Given 页面正在加载，When 读取区域根元素的 `data-ai-state`，Then 为 `loading` 且 `aria-busy="true"`；加载完成后同一元素为 `ready` / `empty` / `error` 之一。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02** — Given 列表已加载，When 枚举页面内所有 `data-ai-id`，Then 取值唯一，且每行有 `data-ai-row=<资源名>`；批量删除按钮带 `data-ai-needs="configmaps:row-select"`。

## 设计目标

- 句柄与文案解耦：改文案、换语言都不影响自动化。
- 状态唯一：一个区域只有一个 `data-ai-state`，不靠多个布尔属性拼状态。
- 可恢复：失败态提供重试（权限除外），否则自动化走到死路。

## 约束与边界

- 属性由 `@kube-ai-hub/ai-surface` 定义，常量集中，重命名为破坏性变更。
- `config/ai-surface-contract.test.ts` 扫描页面源码：使用裸 `<button>` 视为违规，因为它绕过了 `aiId` 约定。

## UI 交互设计

属性约定：

| 属性 | 位置 | 取值 |
|---|---|---|
| `data-ai-state` | 区域根元素 | `loading` / `ready` / `empty` / `error` |
| `data-ai-id` | 可交互元素 | `区域:动作`，页面内唯一 |
| `data-ai-row` | 列表行 | 资源名 |
| `data-ai-needs` | 依赖前置的按钮 | 前置动作 id，空格分隔 |

已知句柄：`configmaps:surface`、`configmaps:search`、`configmaps:create`、`configmaps:bulk-delete`、`configmaps:retry`、`configmaps:sort:name`、`configmaps:sort:createdAt`、`configmaps:select:<name>`、`configmaps:delete:<name>`、`configmaps:open:<name>`。

## 文案与校验

- 属性值一律 ASCII，不使用中文，避免转义与编码问题。

## 边界情况

- 权限错误不提供 `configmaps:retry`：智能体据此判断该路径不可恢复。
- 空态与错误态有各自的 `data-ai-state`，不用「列表为空」区分：两者对自动化的含义相反。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01** — 每个页面必须发布唯一 `data-ai-state`。
- **FR-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02** — 每个可交互元素必须带页面内唯一的 `data-ai-id`。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01** — 仅用属性完成一次「选中 → 批量删除」流程，无需读取任何文案。

## 明确不做

- 不做 MCP server：句柄是给任意自动化用的，绑定一种协议会限制复用。
- 不做坐标级操作接口。

## 假设

- 自动化能执行 JS 或 DOM 查询；纯截图驱动的智能体不在本期保证范围。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-AI_SURFACE-02`
