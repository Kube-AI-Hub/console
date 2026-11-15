# 浅色主题与第二色调验收 + 禁用态可读性修复

> 关闭能力矩阵里长期挂着的「浅色/第二色调未验收」维度（部分）。日期 2026-11-16。
> 规格：prd|design/kube-frontend/theme.md（AC-THEME-06、DEC/GOT-06）。

## 1. 做了什么

| 项 | 结果 |
| --- | --- |
| 浅色 + violet 走查 | 集群概览 / 集群节点 / 集群监控 / 集群成员 / 项目配置字典，1024/1280/1600 三档 **均无横向溢出** |
| 浅色 + green（第二色调）走查 | 同上四页三档，无溢出；`data-accent` 生效，背景与强调色随 token 变化 |
| 深色回归 | 同一批页面在 dark 下仍正常（对照截图） |
| **禁用态按钮可读性** | 发现并修复真实缺陷（见下） |

## 2. 修掉的缺陷：禁用态实心按钮读不清

`Button` 的基础类里有 `disabled:opacity-50`。对实心按钮（primary/danger）来说，那是「白字 + 半透明实心色」：
浅色页面上实测 `#ab2f29` 以 50% 叠白底，对比度约 **2:1**，既读不清又仍然像可点。

改为：禁用时 `bg-ai-surface-2` + `text-ai-fg-muted`、去掉阴影、`opacity` 保持 1、边框降为 `ai-line`，
规则放在 Button 基础类上，所有变体继承。修复后计算样式：

| 主题 | 背景 | 前景 | opacity |
| --- | --- | --- | --- |
| dark | `rgb(58,73,143)` | `rgb(201,225,243)` | 1 |
| light | `rgb(234,230,244)` | `rgb(74,90,162)` | 1 |

并加了一条架构契约测试 `config/disabled-control-contract.test.ts`：禁止 `disabled:opacity-50` 回归，
要求基础类保留中性表面、弱化文字、去阴影与 `pointer-events-none`。

## 3. 验证与证据

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 旧能力覆盖 | 通过 | 旧 console 同样只有深浅两套；本轮补齐浅色与第二色调的实际走查 |
| 数据语义 | 不涉及 | — |
| 交互与权限 | 通过 | 主题由 localStorage + `data-theme`/`data-accent` 驱动，刷新后保持 |
| 视觉与主题 | 通过（人工 + 计算样式） | `/tmp/theme-light-{violet,green}-{overview,nodes,monitor,members}-1280.png`；`/tmp/btn-disabled-{light,dark}.png` |
| 静态/类型/构建/测试 | 通过 | theme scoped 门禁 0/0；console-next tsc 0；vite build ✓；契约套件 1444 passed（新增 3 条禁用态契约）；theme 用例 **3 passed** |
| 未验收 | — | 深色下「第二色调 green」未单独走查；部署环境、member 集群、全站串行 E2E |

## 4. 说明

第二色调（violet/green）由 `ThemeProvider` 的 `data-accent` 承载，平台信息页可切换；此前 PRD 的「约束与边界」
写着「不做色调切换」，与实际实现不符，本轮一并订正。
