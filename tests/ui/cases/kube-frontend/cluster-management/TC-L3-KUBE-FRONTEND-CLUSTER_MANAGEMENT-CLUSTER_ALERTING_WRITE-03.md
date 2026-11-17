# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03 集群告警策略 · 状态列表、详情与自定义策略完整生命周期

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-alerting-write`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{KA_CLUSTER}/alerting-policies`
- **需求**: `prd/kube-frontend/cluster-management/cluster-alerting-write.md`

## 产品功能

集群告警策略页的自定义策略可创建/编辑/编辑 YAML/停用（确认）/启用/删除；两个页签显示规则状态计数、耗时、最近检查，并支持搜索、筛选、排序与分页；行详情进入独立详情页（属性/规则/告警消息/查看指标数据）。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-alerting-write.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-03** — 已知在 host 集群且当前账号可写 `clusterrulegroups`，当在自定义页签创建一条名称为唯一临时名的策略（别名、检查间隔、描述与至少一条规则）后，则列表出现该行（主名显示别名、次行显示对象名与描述），详情页显示别名/检查间隔/规则，且规则行有状态与「查看指标数据」入口；随后编辑别名/描述/规则并保存、停用（出现确认弹窗，确认后状态变为已停用）、再启用、编辑 YAML 保存、删除并确认，则每次操作后回读的对象与页面一致，删除后列表中不再有该行；失败时对话框保留输入并显示原因。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-04** — 已知在 host 集群，当打开集群告警策略页，则两个页签的每一行都显示策略状态与规则状态（未触发/验证中/已触发/已禁用的计数，计数来自聚合 kapis 的 `status.rulesStats`；状态缺失时显示 `-` 而不是 0）、耗时（`status.evaluationTime`，秒，三位小数）与最近检查（`status.lastEvaluation`）；名称/描述搜索、策略状态筛选、规则状态筛选（客户端，作用于已取回的全集）与 10/20/50/100 档位分页同时可用，切换筛选后回到第 1 页；点击行「详情」进入独立详情页，属性含耗时与最近检查，规则表按索引对齐 `status.rulesStatus`，告警消息区块显示该策略的消息或明确空态，返回链接回到告警策略列表。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-05** — 已知在 host 集群，当选中两条或更多可写策略并执行「启用」或「停用」，则对每条可写对象逐条写入 enable 标签（不可写或状态已一致的跳过），完成后显示成功数与失败对象；停用前出现一次确认弹窗；任何一条失败都不把其余成功的行改回原状，列表以 refetch 回读为准。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../design/kube-frontend/cluster-management/cluster-alerting-write.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 管理自定义集群告警策略 (Priority: P1)

作为 **集群管理员**，我希望 **在集群视角直接创建、修改、启停和删除自己的告警策略，并读到每条策略与每条规则的当前状态、耗时和最近检查时间**，以便 **不必为集群级告警改 YAML 或切到项目作用域，也能判断一条策略是否真的在运行、哪条规则在触发**。

**Independent Test**：打开集群告警策略页，自定义页签行数与 `clusterrulegroups` 一致且每行有规则状态/耗时/最近检查；创建一条临时策略后列表出现该行、详情显示其规则与状态；编辑、停用（确认）、启用、编辑 YAML、删除依次成功并回读生效；测试结束删除临时对象。

## 前置与配置

- 已登录，且在 host 集群，账号对 clusterrulegroups 有创建/更新/删除权限
- 集群已安装告警模块（globalrulegroups 至少 1 条）
- 探测结论（2026-11-17，mlu370）：聚合 kapis 返回 status.{evaluationTime,lastEvaluation,rulesStatus,rulesStats}，raw /apis 不返回 status；集群策略写路径为 /apis/.../clusterrulegroups

## 测试步骤

1. 打开集群告警策略页，核对两个页签计数与 kapis 返回的 totalItems 一致，表头含「规则状态/耗时/最近检查」
2. 任取一行有 status 的策略，核对规则状态计数、耗时（三位小数 + 秒）与最近检查与 kapis status 一致
3. 在自定义页签用唯一名称创建两条临时策略（别名/检查间隔/描述/一条规则），核对列表出现别名行、API 回读别名/间隔/规则一致
4. 打开第一条的详情页，核对属性含别名/检查间隔/耗时/最近检查、规则表含告警名称与「查看指标数据」；点击「查看指标数据」打开弹窗，图表区离开 loading 并呈现空态/曲线/可重试错误
5. 编辑第一条的别名与描述并保存，核对详情与 API 回读更新
6. 编辑 YAML 把别名追加后缀并保存，核对 API 回读注解已更新
7. 搜索唯一前缀，勾选两条临时策略，批量停用（确认弹窗）后 API 回读 enable=false；批量启用后回读 true
8. 依次删除两条临时策略并在列表中确认消失；finally 通过 API 删除残余对象

## 期望结果

- 表头包含规则状态、耗时、最近检查；规则状态计数与 kapis status.rulesStats 一致；状态缺失显示「-」；耗时三位小数、最近检查为本地时间
- 规则状态筛选（客户端）只保留计数大于 0 的行；切换筛选后回到第 1 页
- 详情页返回链接回列表，属性/规则/消息三段齐全；指标弹窗按表达式求值，空态不是 0 曲线
- 创建后列表出现该行且 API 回读一致；编辑/YAML/启停/删除每次回读一致；删除后行消失且 API 404
- 批量停用/启用按对象逐条写入并汇总结果，未勾选或不可写行不参与

## 失败排查

- 规则状态全显示「-」：确认 listScope 使用 withStatus，且读的是聚合 kapis 而不是 /apis
- 创建按钮不出现：确认 custom 页签且 SSAR create clusterrulegroups 未被拒绝
- 停用没有确认弹窗：确认走的是列表/详情的 disable 分支，而不是 detail toggle 的启用分支
- 指标弹窗空白：确认 Prometheus 代理路径与表达式；带比较的表达式只返回超过阈值的样本，空图不一定代表查询失败
- 删除残留：finally 用 API DELETE 清理本次唯一名称对象，不要清其他对象

## 产品改版后如何更新自动化

- 页面 data-ai-id 或规则组 status 字段形状变化时同步本用例
