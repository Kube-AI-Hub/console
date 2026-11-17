# 资源消费（账单）与浮动工具箱（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/bill.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-02

## 概述

全站右下角浮动工具箱（可拖拽、位置持久、6 个入口）与资源消费页（按项目、时间窗展示 CPU/内存/存储/GPU）。数据来自 kapis 计量聚合；未启用时页面明确说明。

## 设计目标与非目标

目标：任意页面一键到排障工具；资源消费「没有数据」与「没有计量」可区分。非目标：账单导出、费用计算、工作空间/集群层级汇总、工具箱自定义。

## 关键约束

- 计量基路径 host 为 /kapis/metering.kubesphere.io/v1alpha1；成员集群为 /kapis/clusters/<c>/metering.kubesphere.io/v1alpha1。
- 查询参数 start/end 为 Unix 秒，step 是 Go duration（如 5m），不是秒数；旧 utils 传数值秒，在当前版本会 400。
- 每个 metric 的 data.result[] 按 namespace 给样本；带 start/end 时样本有 values 序列。
- 工具箱的 6 个入口都是集群作用域；当前集群优先 URL，其次 localStorage 最近集群，最后 host。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01 — 计量缺失是独立状态，不是空表

**为什么**：404/5xx 时渲染空表会被读成「所有项目都没用资源」，与「平台没有开启计量」是相反结论；老页面在无数据源时也没有可解释文案。查询层把 404/400/501/5xx 归一为 available:false + reason，页面显示未启用说明与重试；200 的 results 为空才是空态；403 仍抛错走错误面板。

**被否方案**：统一 catch 成空数组。会掩盖权限错误与模块缺失。

**何时重新考虑**：计量接口提供显式的「未安装」状态码/字段时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-02 — 工具箱位置按浏览器记忆，拖拽与点击互斥

**为什么**：悬浮球挡内容时用户会挪开；每次导航复位等于没记忆。指针移动超过 3px 视为拖动，抬起只持久化位置、不 toggle；未移动才 toggle，否则拖动结束会意外展开面板。弹层不手工处理 Escape（放弃自绘弹层键盘逻辑），收起由再次点击悬浮球或选择入口完成。

**被否方案**：hover 展开（触屏不可用）；只拖 Y 轴（老实现），横向拦内容时仍无解。

**何时重新考虑**：需要按用户同步位置时（服务端偏好）。

## 系统现状

老 console：components/KubeTools 悬浮球（6 工具、Y 轴拖动），containers/Bill（/bill，按项目/时间区间与费用）。新 UI 工作台/集群页此前无工具箱、无账单页；本批按 N-03 重纳。

## 仓库落点

- apps/console-next/src/shell/Toolbox.tsx（挂载于 AppShell）
- apps/console-next/src/pages/cluster/ClusterBillPage.tsx
- apps/console-next/src/routes/kube-frontend.clusters.$cluster/bill/index.tsx
- apps/console-next/src/areas/registry.ts（bill 侧栏项）
- packages/api-client/src/metering.ts（meteringBase / namespaceUsageApi）

## 对外契约

| 用途 | 路径 | 规则 |
| --- | --- | --- |
| 项目级计量 | GET /kapis/metering.kubesphere.io/v1alpha1/namespaces?start=&end=&step=5m | start/end Unix 秒；step Go duration；metric data.result[].metric.namespace |
| 成员集群 | GET /kapis/clusters/<c>/metering.kubesphere.io/v1alpha1/namespaces… | cluster 段在 /kapis 之后 |

指标映射：meter_namespace_cpu_usage（均值核）、meter_namespace_memory_usage_wo_cache（均值字节）、meter_namespace_pvc_bytes_total（最新字节）、meter_namespace_gpu_usage（均值卡）。

## 不变量

1. 表格行集合 = 返回结果中出现过的 namespace 集合；一行一个项目。
2. 未启用（404/400/501/5xx）→ 未启用说明；200 空结果 → 空态；403 → 错误面板。
3. CPU/内存/GPU 取窗口均值，存储卷取最新值。
4. 6 个入口 href 都带当前集群段；拖动后位置持久且拖动不展开。
5. 悬浮球不影响页面滚动与点击（固定定位、面板在上方）。

## 已知坑

- step 的 Go duration（5m）不是秒数；传 600 会 400 time: missing unit。
- 计量接口 200 时 results 可能包含多个 metric；只按白名单四个指标映射，避免把不相关指标塞进行。
- B200 的计量返回 fee 全为 0；不要把费用列做成空列。
- 工作台 URL 没有集群段：必须回退最近集群/host，否则入口会拼出 undefined。
- 指针捕获必须释放；否则拖动后页面其他点击失效。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01（B200 计量已启用）。单测：packages/api-client/test/metering.test.ts（平铺/均值/最新值、未启用、403 抛错）。
可观测点：toolbox:ball/panel/item:<key>；cluster-bill:surface/table/row:<ns>/range:*/empty/unavailable/retry。

## 后续改进

费用与价格、工作空间层级汇总、导出 CSV、工具箱自定义入口、移动端布局。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-BILL-01
