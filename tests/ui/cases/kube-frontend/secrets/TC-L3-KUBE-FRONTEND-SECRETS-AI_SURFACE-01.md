# TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01 保密字典 · 状态与句柄契约

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `ai-surface`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/ai-surface.md`

## 产品功能

区域发布四态，交互元素有稳定句柄，遮挡开关带 aria-pressed。

### 关联需求

- `prd/kube-frontend/secrets/ai-surface.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/ai-surface.md`](../../../../prd/kube-frontend/secrets/ai-surface.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01** — Given 打开保密字典列表，When 读取 `secrets:surface` 的 `data-ai-state` 与各行的 `data-ai-row`，Then 状态为四态之一、行为对象名；`secrets:search`、`secrets:create`、`secrets:bulk-delete` 均存在且 `secrets:bulk-delete` 带 `data-ai-needs="secrets:row-select"`；详情页存在 `secret-detail:toggle-values` 且其 `aria-pressed` 初始为 `false`。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/ai-surface.md`](../../../../design/kube-frontend/secrets/ai-surface.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/ai-surface.md`](../../../../prd/kube-frontend/secrets/ai-surface.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为智能体，只靠稳定句柄完成「创建一条凭据 → 找到它 → 删除它」


**Independent Test**：依次操作 `secrets:create`、`secrets:field-name`、`secrets:create-next`、`secrets:data-add`、`secrets:data-key`、`secrets:data-value`、`secrets:data-save`、`secrets:create-submit`，然后用 `[data-ai-row=<name>]` 定位并走删除流程；每一步后读取 `secrets:surface` 的 `data-ai-state`。

### US2 - 作为智能体，识别页面的四种状态并走通的恢复路径


**Independent Test**：正常时为 `ready`；搜索无匹配为 `empty`；上游失败为 `error` 且 `secrets:retry` 可点；403 时为 `error` 且**没有**重试按钮。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开列表并读取 secrets:surface 状态
2. 读取行与动作句柄
3. 打开任意详情并读取遮挡开关

## 期望结果

- 状态为 loading/ready/empty/error 之一
- 每行带 data-ai-row；bulk-delete 带 data-ai-needs
- 遮挡开关存在且 aria-pressed=false

## 失败排查

- 句柄缺失时对照 pages/secrets 源码中的 actionProps

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
