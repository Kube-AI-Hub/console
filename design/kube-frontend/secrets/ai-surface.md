# 保密字典 · 智能体可操作性 · 技术方案（L3）

> 承接 [`prd/kube-frontend/secrets/ai-surface.md`](../../../prd/kube-frontend/secrets/ai-surface.md)。

## 概述

页面通过 `AiSurface` 发布 `data-ai-state`，通过 `actionProps()` 发布 `data-ai-id`，通过 `rowAttributes` 发布 `data-ai-row`；`registerPage()` 把动作登记进 manifest。遮挡开关带 `aria-pressed`，默认 `false`。

## 关联需求

- `AC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01`

## 设计目标与非目标

**目标**：句柄稳定、不依赖文案与层级；状态机器可读；遮挡对机器同样成立。

**非目标**：自然语言指令、为每个输入框都提供句柄。

## 关键约束

- 句柄格式 `区域:动作`；列表 `secrets`、详情 `secret-detail`。
- 动作依赖用 `data-ai-needs` 表达（`secrets:bulk-delete` 需要 `secrets:row-select`）。
- 契约测试 `config/ai-surface-contract.test.ts` 读取 `pages/**/*Page.tsx` 断言 `<AiSurface>`、`state={`、无裸 `<button>`。

## 方案决策

### DEC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01 — ai-kit 组件的句柄挂在包裹元素上

**为什么**：ai-kit 的 `Select`（尤其 `searchable` 模式）只接收白名单属性，`data-ai-id` 不会出现在 DOM 里。与其修改 ai-kit 的公共 API（影响所有使用者），不如在页面层用 `AiSurface` 包一层，句柄落在真实存在的元素上，自动化可以稳定找到。

**被否方案**：给 `Select` 增加 `...rest` 透传。会改变共享组件的语义（每个 ai-kit 组件是否透传属性将不再一致），且需要 ai-kit 发版。

**何时重新考虑**：ai-kit 明确约定「所有控件透传 `data-*`」并统一实现时。

### DEC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-02 — 明文可见性用 `aria-pressed` 而不是纯图标

**为什么**：智能体与读屏软件都依赖 `aria-pressed` 判断当前是否显示明文；纯图标只能靠截图判断。

**被否方案**：用 `data-ai-state` 表达。那是区域状态的四态枚举，不是开关。

## 系统现状

配置字典已建立这套契约（`configmaps:*`）；保密字典沿用同样的前缀规则，未引入新机制。

## 仓库落点

| 层 | 路径 |
|---|---|
| manifest | `apps/console-next/src/pages/secrets/queries.ts`（`secretsPage`） |
| 句柄 | `pages/secrets/*.tsx`、`pages/secrets/SecretDataSection.tsx` |
| 契约测试 | `kube-frontend/config/ai-surface-contract.test.ts` |

## 对外契约

| 句柄 | 位置 | 说明 |
|---|---|---|
| `secrets:surface` | 列表区域 | 四态 |
| `secrets:search` / `secrets:create` / `secrets:bulk-delete` / `secrets:retry` | 工具条 | |
| `secrets:select:<name>` | 行复选框 | |
| `secrets:open:<name>` | 名称链接 | 进入详情 |
| `secret-detail:surface` | 详情区域 | 四态 |
| `secret-detail:toggle-values` | 数据区 | `aria-pressed` |
| `secret-detail:set-default` | 头部 | 仅非默认镜像仓库 |
| `secrets:field-*` / `secrets:data-*` | 创建与编辑弹窗 | |
| `yaml:submit` / `yaml:download` | YAML 弹窗 | |

## 不变量

- **INV-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01** — manifest 中声明的每个 `id` 都能在页面上找到对应 `data-ai-id`（由用例断言）。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01** — `actionProps()` 展开在业务回调之后会覆盖回调（实跑中角色选择器因此失效）。
  处置：始终先展开 `actionProps`，再写 `onChange` / `onClick`；契约测试扫描顺序。

## 测试与可观测

- 契约：`config/ai-surface-contract.test.ts`。
- 端到端：`TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01`（读取状态与句柄）。

## 后续改进

把 manifest 与句柄一致性做成自动断言（读取源码中的 `actionProps('secrets:...')` 与 manifest 对照）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-SECRETS-AI_SURFACE-01`
