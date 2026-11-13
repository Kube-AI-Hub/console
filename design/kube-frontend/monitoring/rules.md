# 告警策略（L3）

[子模块需求](../../../prd/kube-frontend/monitoring/rules.md)


## 概述

告警策略：与告警策略共用同一个列表组件，差异由描述符表达。

## 关联需求

- AC-L3-KUBE-FRONTEND-MONITORING-RULES-02

- AC-L3-KUBE-FRONTEND-MONITORING-RULES-01

- `prd/kube-frontend/monitoring/rules.md`

## 设计目标与非目标

落实 L2 的两条不变量。非目标见 L2。

## 关键约束

- 读告警 kapis 组；分页与搜索参数随请求下发。

## 方案决策

### DEC-L3-KUBE-FRONTEND-MONITORING-RULES-01 — 详情用弹窗，从行数据渲染

**为什么**：这些对象很小，列表响应已带全字段。再发一次详情请求在慢接口上是纯等待。

**被否方案**：详情页路由。为只读小对象增加一条路由与一次请求，收益为零。

**何时重新考虑**：详情需要列表没有的字段（例如规则表达式全文）时。

## 系统现状

老 console 用抽屉展示同类信息。

## 仓库落点

- `pages/monitoring/MonitoringListPage.tsx`（详情弹窗内联）

## 对外契约

只读；告警消息支持删除。

## 不变量

详情展示的字段与列表行来自同一份数据。

## 已知坑

- 模块未安装时接口返回空体：见 L2 的 DEC-L3-KUBE-FRONTEND-MONITORING-RULES-02。

## 测试与可观测

E2E 见 `tests/kube-frontend/monitoring/`。

## 后续改进

按上文。

## 验收用例

- `AC-L3-KUBE-FRONTEND-MONITORING-RULES-01`
