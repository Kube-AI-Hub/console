# 项目概览 · 资源使用排行（Top 5）

> 补齐旧 console 项目概览底部 `UsageRanking` 区块。日期 2026-11-16。
> 规格：prd|design/kube-frontend/project-settings/overview-usage.md（AC-OVERVIEW_USAGE-03、DEC-03/04、GOT-03）。

## 1. 旧能力与归宿

| 旧能力 | 归宿 | AC / 用例 |
| --- | --- | --- |
| 项目概览底部「使用排行」Top 5 | **补齐**：CPU / 内存两个页签，各列 5 个工作负载（序号/名称/类型/数值） | AC-OVERVIEW_USAGE-03；TC-OVERVIEW_USAGE-03 |
| 指标切换（CPU/内存/网络收发） | **部分补齐**：CPU 与内存两个页签；网络收发不做（旧页面的网络列在本部署无对应聚合指标，登记为不做） | 同上 |
| 排行行可跳到工作负载 | **补齐**：Deployment/StatefulSet/DaemonSet 链接到对应项目列表页；其余类型只显示名称（与旧页面一致：Pod 归属行不可点） | 同上 |
| 应用模板区块（旧 `Applications`） | 不迁移（项目内「应用」是 CRD composing 应用，与商店不同功能，已登记为别处承接） | PRD 明确不做 |

## 2. 数据契约（实测）

`GET /kapis/monitoring.kubesphere.io/v1alpha3/namespaces/<ns>/workloads?sort_metric=workload_cpu_usage&sort_type=desc&page=1&limit=5&metrics_filter=workload_cpu_usage|workload_memory_usage_wo_cache`

响应对每个指标各返回一组 `data.result[]`；样本的 `metric.workload` 形如 `StatefulSet:tc-e2e-…`，`value[1]` 是数值字符串。
排行只取 `sort_metric` 那一组排序，再逐条挑有名字与有效数值的样本——没有内存样本的工作负载不会混进 CPU 排行。

## 3. 实测（B200 host，admin，项目 default）

| 页签 | 行数 | 首行 | 单位 |
| --- | --- | --- | --- |
| CPU 使用量 | 5 | `tc-shot-projapp-55646-my`（StatefulSet） | 核（0.1） |
| 内存使用量 | 5 | `tc-e2e-570230-rowact`（Deployment） | GiB/MiB（1.1 GiB） |

## 4. 踩到并修掉的问题

`TabsContent` 必须作为 `<Tabs>` 的子节点：写成兄弟节点会抛 `TabsContent must be used within Tabs`，
整页进错误边界（浏览器实测）。已记入 design 的 GOT-03。

## 5. 验证与证据

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 上表 4 项；网络收发与应用模板已登记不做/别处承接 |
| 数据语义 | 通过 | 用例先用 API 取期望前几名，再断言页面首行与之一致；空与失败有独立呈现，不显示假 0 |
| 交互 | 通过 | 页签切换后重新请求（查询键含指标） |
| 视觉与主题 | 通过（人工） | `/tmp/project-ranking-{dark-violet-{1024,1280,1600},dark-green-1280}.png`、`/tmp/project-ranking-{zh,memory}.png`；四档 overflow=0；顺带关闭「深色 + green」走查遗留 |
| 静态/类型/构建/测试 | 通过 | scoped 门禁 0/0；console-next tsc 0；vite build ✓；project-settings 模块串行 **26 passed / 1 skipped**（跳过：spaces 项目无网络策略） |
| 未验收 | — | 部署环境、member 集群、全站串行 E2E |
