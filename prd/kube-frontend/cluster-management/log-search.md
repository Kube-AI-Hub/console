# 容器日志查询（L3）

[子模块需求](./_index.md)

## 概述

集群级日志检索：按项目（命名空间）、容器组、容器与关键字在**最近一段时间窗口**内检索日志行。数据来自租户 API 背后的 Elasticsearch 索引。

老 console 把它放在集群「工具箱」里（容器日志查询弹窗）。这是新 UI 补齐工具箱的第一项��—事件查询已在 §48 先落。

## 用户故事

### US1 - 出问题时先看日志 (Priority: P1)

作为 **运维/项目成员**，我希望 **按项目与关键字检索最近的日志**，以便 **不必逐个容器登进去翻**。

**Independent Test**：选一个项目，读接口返回总数与首页条数，页面行数与之对应；输入关键字后结果收窄。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01** — 已知集群有日志，当打开容器日志查询页，则按时间倒序显示「时间 + 项目/容器组/容器 + 日志行」；首页条数等于 `min(50, 接口 total)`；项目过滤只留该项目的日志行；关键字过滤通过 `log_query` 下发并使结果减少；底部显示总数与页码，翻页取 `from/size` 的下一段。

## 设计目标

1. 明确时间窗口（预设 1h/6h/24h/7d）。
2. 分页基于接口的 `from/size`，不是本地切片。

## 约束与边界

- 读 `/kapis/tenant.kubesphere.io/v1alpha2/logs`（`start_time`/`end_time` 为秒）。
- 只读。

## UI 交互设计

- 顶部：项目/容器组/容器/关键字四个输入框 + 时间窗口下拉（1h/6h/24h/7d）。
- 列表：每行「时间 + 项目/容器组/容器 + 日志行」，等宽字体、自动换行。
- 底部：总数与上一页/下一页。

## 文案与校验

- 空态：当前条件下没有日志。
- 总数：共 {count} 条。

## 边界情况

- 时间窗口切换/过滤变化时回到第 1 页。
- 接口不可用：只该区块显示错误与重试。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01** - 按时间窗口与过滤条件检索日志并分页。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-02** - 无结果时给出说明而非空白。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-03** - 顶部显示计数条与时间分布直方图（`operation=histogram`，间隔随时间窗口缩放）。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01** - 首页条数 = min(50, total)；分页与过滤经同一接口参数下发。

## 明确不做

- 日志导出（老 console 有下载，需要服务端导出接口，另立）。
- 实时跟随（轮询）：需要定时轮询与追加合并，另立。
- 导出：`/logs/export` 实测 404，没有可用接口。

## 假设

假设：集群日志组件在采集，ES 索引保留最近若干天；只检索窗口内数据。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-LOG_SEARCH-01`
