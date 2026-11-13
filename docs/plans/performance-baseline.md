# 体积与首屏基线（迁移收尾后）

> 生成方式：`node kube-frontend/scripts/perf-report.mjs`（只读 `apps/console-next/dist/assets`，不改产物）。
> 数字取自本次 `npx vite build` 的输出；换构建或改依赖后重跑即可对比。

## 1. 总量

| 类别 | 个数 | 原始 | gzip |
| --- | --- | --- | --- |
| 入口 `index-*` | 1 | 42.3 KiB | 8.3 KiB |
| 共享 chunk（`vendor-*` / `ai-kit` / `app-shared`） | 9 | 1677.7 KiB | 528.6 KiB |
| 页面 chunk（懒加载） | 131 | 385.9 KiB | 139.8 KiB |
| **全部 JS** | 141 | **2105.9 KiB** | **676.7 KiB** |

## 2. 首屏实际要付的

入口 42 KiB（gzip 8 KiB）只包含 shell 与路由骨架；**首屏不会被任何页面 chunk 拖慢**——131 个页面 chunk 全部懒加载，单个最大 20.0 KiB（`MonitoringListPage`）。

首个带表格的页面会再加载一次共享 chunk：`vendor-react` 190 KiB、`vendor-tanstack` 117 KiB、`vendor-radix` 94 KiB、`ai-kit` 377 KiB、`app-shared` 257 KiB、`vendor-misc` 223 KiB（合计 gzip 约 430 KiB）。这些在同一个会话内只付一次。

## 3. 最大的三块，以及它们为什么在那里

| chunk | 原始 / gzip | 说明 |
| --- | --- | --- |
| `vendor-yaml-editor` | 410.7 / 133.6 KiB | CodeMirror + YAML 解析。**不在首屏路径上**：`scheduleWarmup()` 用 `requestIdleCallback`（1.5s 兜底）预热，让第一次「编辑 YAML」不再冷启动（DEC-CORE-KUBE_FRONTEND-04） |
| `ai-kit` | 377.0 / 128.2 KiB | 设计系统与表格/弹窗原语，是所有页面共享的一次性成本 |
| `app-shared` | 256.7 / 66.6 KiB | 应用内共享组件（资源错误面板、定义行、列表状态等） |

## 4. 预算

| 项 | 预算 | 实测 | 结论 |
| --- | --- | --- | --- |
| 入口 | ≤ 100 KiB | 42.3 KiB | 通过 |
| 单页 chunk | ≤ 60 KiB | 最大 20.0 KiB | 全部通过 |
| 共享 chunk | 不计预算，单独观察 | 1.68 MiB 原始 / 529 KiB gzip | 见下 |

预算沿用自迁移收尾的实测水位线，不是行业标准；一旦超了，先判断是「新增依赖」还是「页面把共享件拖进了自己」。

## 5. 可做的优化（按性价比排序，均未实施）

1. **给预热加省流开关**：`navigator.connection?.saveData` 为真时跳过 133 KiB gzip 的编辑器预热。改动只有 `scheduleWarmup` 一处，等待 YAML 编辑时才加载。
2. **`vendor-misc` 223 KiB 拆分**：里面混了多个小依赖，按「进入路由时才可能用到」与「所有页面都用」再分一次，可让首屏少拉几十 KiB。需要先看清组成（`vite --debug` 或 rollup 插件分析），属独立小任务。
3. **`ai-kit` 377 KiB 按需切分**：表格/弹窗/编辑器目前打在同一 chunk；拆开后仅进入表格页不必付出编辑器那部分。收益取决于有多少页面只用其中一部分。

## 6. 复现

```bash
cd kube-frontend/apps/console-next && npx vite build
cd kube-frontend && node scripts/perf-report.mjs          # 人读
cd kube-frontend && node scripts/perf-report.mjs --json   # 机器读（CI 可接）
```

退出码：预算内 `0`，超预算 `2`。