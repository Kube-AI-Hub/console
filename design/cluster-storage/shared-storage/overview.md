# 概览 · 技术方案（L3）

## 概述

概览读 `GET /kapis/juicefs.kubesphere.io/v1alpha1/summary` 与 `/volumes`，渲染四张卡片、各卷使用率条与提示条。没有写操作。

## 关联需求

- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02`
- `AC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-03`

## 设计目标与非目标

**目标**：汇总数字与卷列表来自同一次请求的结果，不可能互相矛盾；文字在深色主题下可读；提示条只在确有情况时出现。

**非目标**：不做历史趋势、不做告警。

## 关键约束

- 汇总口径固定：总配额 = Σ PV 容量，总已用 = Σ kubelet used，最高使用率 = max(used/capacity)。
- 颜色只用 `scss/variables` 的 token（宪法 C3）。

## 方案决策

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01 — 汇总由后端算，前端不重算

后端 `GET /summary` 返回 `volumeCount / capacityBytes / usedBytes / maxUsageRatio / metricsEnabled / storageNodes`，前端只格式化。

- **为什么**：同一组数字在概览与卷页都要出现，前端重算就会有两套口径（尤其是「最高使用率」这种取最大值）。
- **被否方案**：前端从 `volumes` 自行 reduce。会在分页、过滤或字段缺失时与后端不一致。
- **何时重新考虑**：如果汇总需要跨集群聚合，改为后端一次聚合多集群。

### DEC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02 — 颜色只用主题 token

卡片标题用 `$second-text-color`、数值与卷名用 `$dark`、提示条保持浅底深字。

- **为什么**：控制台是深色主题（页面底 `#14215a`、卡片 `#4a5aa2`）。写死浅色主题的 `#79879c` 只有 **1.76:1**、`#242e42` 只有 **2.12:1**，正文不可读；token 后分别是 **3.97:1** 与 **5.29:1**。
- **被否方案**：给页面加一套 `dark` 变量、按主题切换。控制台没有运行时的主题切换，等于自己维护两套色板，仍然会在某一套里出错。
- **何时重新考虑**：控制台引入明暗双主题时，由 token 层解决，页面仍不写色值。

## 系统现状

- 页面：`console/src/pages/clusters/containers/Storage/JuiceFS/Overview/index.jsx`
- 样式：同目录 `index.scss`（此前写死 `#242e42` / `#79879c` / `#eff4f9`）
- 接口：`GET /kapis/juicefs.kubesphere.io/v1alpha1/summary`

## 仓库落点

| 层 | 路径 |
| --- | --- |
| 页面 | `console/src/pages/clusters/containers/Storage/JuiceFS/Overview/index.jsx` |
| 样式 | `console/src/pages/clusters/containers/Storage/JuiceFS/Overview/index.scss` |
| 数据 | `console/src/stores/juicefs.js`（`fetchSummary`、`fetchVolumes`） |
| 接口 | `kube-server/pkg/kapis/juicefs/v1alpha1/handler.go` 的 `getSummary` |

## 对外契约

- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — `GET /summary` 返回 `{ volumeCount, capacityBytes, usedBytes, maxUsageRatio, metricsEnabled, storageNodes }`，其中 `maxUsageRatio` 是 0..1 的小数，`capacityBytes`/`usedBytes` 是字节。
- **CON-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — `GET /volumes` 的每一项包含 `quotaDrift`（布尔），只有顶层卷在 statfs 与 PV 容量相对差 > 1% 时为 true。

## 不变量

- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — 卡片上的「总配额」等于卷页各行配额之和。
- **INV-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — 提示条的文字与卡片文字都满足对比度阈值；浅底提示条内的文字不受深色主题影响。

## 已知坑

- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01** — 直接写 `color: #242e42` 在深色卡片上几乎不可见。以后任何新页面都不要写色值；`check_docs.py --what structure` 会扫 `src/pages/**/*.scss` 里的十六进制色值。
- **GOT-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02** — 嵌套卷（`model-cache/public`）的 statfs 天然等于「已用 + 父目录余量」，与自己的 PV 容量不一致是正常现象，不能据此报漂移。

## 测试与可观测

- L3 用例：数值一致（`TC-...-OVERVIEW-01`）、对比度与未翻译 key（`TC-...-OVERVIEW-02`）。
- 对比度审计由 `tests/ui/helpers/contrast.py` 在浏览器里计算，阈值 4.5:1。

## 后续改进

- 使用率条加「按节点」维度。

## 验收用例

- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-01`
- `TC-L3-CLUSTER-STORAGE-SHARED_STORAGE-OVERVIEW-02`
