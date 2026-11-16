# 外观：深浅色与色调（L3）

[子模块需求](../../../prd/kube-frontend/platform-settings/appearance.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-03
- AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01

## 概述

平台信息页的「外观」分区：主题模式与色调，复用 ai-kit 的主题系统。

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-03 — 对比度要在渲染层验，不只是算令牌

令牌层契约（`config/theme-contrast-contract.test.ts`）只能证明**语义文本令牌**在**语义背景**上的比值，
它明确把「强调色作为文字」列为覆盖外。而真实缺陷恰好落在那里：`--ai-accent` 是填充色，
被链接按钮当成文字色用在不那么深的 `--ai-surface-2` 上只有 2.84:1。

所以渲染层另有一条审计：写 `localStorage['ai-kit-theme']` → 导航 → 断言 `<html data-theme>` 确实切换
（否则测的是另一个主题）→ 用 `helpers/contrast.py` 走 `main` 里的真实文本节点。

### GOT-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-03 — 已知缺陷用清单登记，不放宽断言

两条已知不达标（链接 2.84、成功徽标 4.07）按**文本**登记在 `KNOWN_CONTRAST_DEFECTS`，双向守卫：
出现新违规失败；登记项不再复现或比值变化超过 0.05 也失败（说明已修复，应删除条目）。
这样套件保持绿色、缺陷仍被追踪，清单也不会腐烂成「什么都允许」。
## 系统现状

- `ThemeProvider` 已支持 `data-theme`（dark/light）与 `data-accent`（violet/green），并把选择写入 `localStorage`，还会在首帧前用内联脚本恢复（避免闪烁）。
- 页头已有 `ThemeToggle`（深/浅）与未被使用的 `AccentToggle`（循环切换色调）。
- 本轮把两者做成**可见的单选组**放在平台信息页，符合「在平台设置里切换」的要求。

## 仓库落点

- `apps/console-next/src/pages/platform/PlatformInfoPage.tsx`（`AppearanceSection`）
- `packages/ui/src/index.ts`（补导出 `useTheme` / `AccentPalette`）
- 主题实现本身不改：`packages/ai-kit/src/theme/ThemeProvider.tsx`、`styles/tokens.css`

## 对外契约

无网络调用。只读写 `localStorage` 的 `ai-kit-theme` / `ai-kit-accent`。

## 设计目标与非目标

目标：一处可改、立即生效、刷新保持。非目标：平台级强制、任意取色。

## 关键约束

- 外观是浏览器偏好：**不写平台对象、不影响其他用户**。
- 只使用已校验的两套调色板。

## 方案决策

### DEC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01 — 单选组而不是页头的循环按钮

**为什么**：在该页面上读者是要"选择一种外观"，能看到两个选项及其名称比盲点循环更可预期；页头的 `ThemeToggle` 保持原样（快速切换）。

**被否方案**：把 `AccentToggle` 直接搬到页头。代价是循环切换无法一次选到目标，也不知道有哪些选项。

**何时重新考虑**：色调扩展到三套以上时，改为下拉或独立外观页。

## 不变量

1. 切换后 `<html>` 上的 `data-theme` / `data-accent` 立即变化。
2. 刷新后保持；`localStorage` 不可用时不报错。

## 已知坑

- 图标集里没有 sun/moon，所以按钮用文字标签；新增图标会引入资产。
- 绿色调色板的强调色是 **mint**（`--ai-raw-mint-400`），不是 `green-300`。

## 测试与可观测

`tests/kube-frontend/platform-settings/` 中的 APPEARANCE 用例：切换 → 断言属性 → 刷新 → 断言保持 → 切回。

## 后续改进

- 三套以上调色板时的外观页。
- 跟随系统（`prefers-color-scheme`）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01`
- `TC-L3-KUBE-FRONTEND-THEME-CONTRAST-01`
