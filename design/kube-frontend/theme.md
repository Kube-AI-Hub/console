# 主题 · 技术方案（L2）

> 本文承接 [`prd/kube-frontend/theme.md`](../../prd/kube-frontend/theme.md) 的全部 `AC-*`。

## 概述

主题不是应用自己实现的一套，而是直接采用 ai-kit 已有的 `ThemeProvider` 与设计 token。应用侧只做三件事：首屏前恢复属性、在根组件挂 Provider、在顶栏放一个入口。

## 关联需求

- `AC-L2-KUBE-FRONTEND-THEME-01`
- `AC-L2-KUBE-FRONTEND-THEME-02`
- `AC-L2-KUBE-FRONTEND-THEME-03`
- `AC-L2-KUBE-FRONTEND-THEME-04`
- `AC-L2-KUBE-FRONTEND-THEME-05`

## 设计目标与非目标

**目标**：切换即时生效、刷新不闪色、弹层与页面同主题、触控目标达标。

**非目标**：色调切换、跟随系统、服务端持久化。

## 方案决策

### DEC-L2-KUBE-FRONTEND-THEME-01 — 属性挂在 `<html>`，由 token 覆盖

**为什么**：`tokens.css` 的浅色覆盖选择器是 `:root[data-theme='light']`。把属性放在任意容器上，token 不会换；而 portal 渲染的弹窗（`Dropdown`、`Modal`）挂在 `body` 下，只有根元素有属性时它们才同主题。应用内**没有任何硬编码颜色**（`bg-white` / `text-gray-*` / `bg-[#...]` 计数为 0），因此换属性即全局生效，无需改组件。

**被否方案**：给每个页面包一层 `ai-root` 并按主题传 class。弹层不在该子树里，会露馅。

### DEC-L2-KUBE-FRONTEND-THEME-02 — 首屏前用内联脚本恢复

**为什么**：React 的首帧一定晚于 HTML 解析。只靠 `ThemeProvider` 的 `useEffect` 应用偏好，浅色用户在每次刷新时都会看到一帧深色。ai-kit 导出了 `themeBootstrapScript` 字符串专为此设计，但静态模板不能 import 模块，只能内联一份拷贝。

**代价与对策**：两份拷贝会漂移。`test/theme-bootstrap.test.ts` 比对 `index.html` 的内联脚本与 `themeBootstrapScript` 的关键字面量（存储键、属性名、枚举值），不一致即失败。

### DEC-L2-KUBE-FRONTEND-THEME-03 — 只做深浅色，配色固定紫色

**为什么**：需求只要求深浅。配色保留可恢复是因为存储键与 playbook 共用：在 storybook 里选过绿色的人进入应用时，若脚本不回读 `data-accent`，会看到配色跳变。

### DEC-L2-KUBE-FRONTEND-THEME-04 — 切换按钮在应用侧覆盖尺寸

**为什么**：`ThemeToggle` 内置 `size-9`（36px），而这一行其他按钮是 `h-11 sm:h-9`（触控下 44px）。共享组件不该为某个宿主的排版改动，因此在调用处传 `className="size-11 sm:size-9"`，与邻居对齐且满足触控最小尺寸。

## 模块边界

| 位置 | 内容 |
|---|---|
| `apps/console-next/index.html` | 首屏前的内联恢复脚本、默认属性 |
| `apps/console-next/src/main.tsx` | 挂 `ThemeProvider`（`dark` / `violet`） |
| `apps/console-next/src/shell/AppShell.tsx` | 顶栏 `ThemeToggle` |
| `packages/ui/src/index.ts` | 转出 `ThemeProvider` / `ThemeToggle` / `themeBootstrapScript` |
| `packages/locales/src/index.ts` | `shell.theme` 双语文案 |

## 不变量

- **INV-L2-KUBE-FRONTEND-THEME-01** — 主题属性只写在 `<html>` 上。
- **INV-L2-KUBE-FRONTEND-THEME-02** — 应用组件中不出现硬编码颜色，只用 `--ai-*` token。
- **INV-L2-KUBE-FRONTEND-THEME-03** — `index.html` 的默认属性与 `ThemeProvider` 的默认值一致。

## 已知坑

- **GOT-L2-KUBE-FRONTEND-THEME-01** — 应用不能 import `@kube-ai-hub/ai-kit`，只能经 `@kube-ai-hub/ui`；补导出时别漏 `themeBootstrapScript`，否则测试编译失败。
- **GOT-L2-KUBE-FRONTEND-THEME-02** — jsdom 下 `import.meta.url` 不是 file URL，测试里读 `index.html` 要基于 `process.cwd()`。
- **GOT-L2-KUBE-FRONTEND-THEME-03** — 组件测试之间会残留 `localStorage`，上一个用例选的 `light` 会成为下一个用例的默认值；每个用例前要清理存储。

## 测试

- `apps/console-next/test/theme-bootstrap.test.ts`：内联脚本与 `themeBootstrapScript` 语义一致；HTML 默认属性与 Provider 默认值一致。
- `apps/console-next/test/theme-toggle.test.tsx`：点击切换 `<html>` 属性、`aria-pressed`、持久化键名、配色应用。

## 验收用例

- `TC-L2-KUBE-FRONTEND-THEME-01`（US1）
- `TC-L2-KUBE-FRONTEND-THEME-02`（US2）
