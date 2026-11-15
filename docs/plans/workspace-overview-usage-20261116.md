# 企业空间概览 · 资源用量与项目用量排行

> 补齐旧 console 企业空间概览的 `ResourceUsage` 与 `UsageRanking` 两块。日期 2026-11-16。
> 规格：prd|design/kube-frontend/access-control/workspace-console.md（AC-WORKSPACE_CONSOLE-07、DEC-14/15）。

## 1. 旧能力与归宿

| 旧能力 | 归宿 | AC / 用例 |
| --- | --- | --- |
| 企业空间资源用量（CPU/内存/容器组/网络） | **补齐**：四项一行，缺失指标显示 `-` | AC-WORKSPACE_CONSOLE-07；TC-…-07 |
| 企业空间使用排行（项目 Top 5） | **补齐**：CPU / 内存两页签，名称链到项目概览 | 同上 |
| 旧「集群信息」页签 | 不做（本部署空间详情只有 `spec.placement.clusterSelector`，system-workspace 为空，无法给出可信的集群列表；已登记） | 记录 §4 |
| 存储用量列 | 不做（本部署无空间级存储指标，整行不出现而不是显示 `-`） | design DEC-15 |

## 2. 数据契约（实测）

| 读 | 端点 | 形态 |
| --- | --- | --- |
| 空间用量 | `GET /kapis/monitoring.kubesphere.io/v1alpha3/workspaces/<ws>?metrics_filter=…&step=60s` | **vector**，每指标一条样本 |
| 项目排行 | `GET /kapis/monitoring.kubesphere.io/v1alpha3/namespaces?sort_metric=namespace_cpu_usage&sort_type=desc&limit=N` | **集群级**排行，按样本 `workspace` 标签过滤 |

关键点：排行端点**不接受** workspace 参数（实测带 `workspace=` 仍返回全集群样本），所以空间过滤必须在客户端按标签做；
没有 `workspace` 标签的样本无法归属，直接跳过而不是猜。

## 3. 实测（B200 host，admin，system-workspace）

| 项 | 值 |
| --- | --- |
| CPU 用量 | 10.1 核 |
| 内存用量 | 129.2 GiB |
| 容器组数量 | 111 |
| 网络收发 | ↓ 0.2 GiB · ↑ 0.2 GiB |
| 项目排行（CPU） | kube-system 5.2 / kubesphere-monitoring-system 1.3 / kubesphere-system 1.1 |

## 4. 验证与证据

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 旧能力覆盖 | 通过（范围内） | 上表；集群信息页签与存储列已登记不做及理由 |
| 数据语义 | 通过 | 用例先用 API 取期望值再比对；缺失指标 `-`；排行断言每个名称都在 API 的 workspace 样本集合里 |
| 交互 | 通过 | 两页签切换；项目名链到 `/kube-frontend/<ws>/projects/<ns>/overview` |
| 视觉与主题 | 通过（人工） | `/tmp/ws-overview-{dark-violet-{1024,1280,1600},light-violet-1280,light-green-1280}.png`；五档 overflow=0 |
| 静态/类型/构建/测试 | 通过 | scoped 门禁 0/0；console-next tsc 0；vite build ✓；access-control 串行 **44 passed**（含新用例） |
| 未验收 | — | 部署环境、member 集群、全站串行 E2E |
