# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-13 节点列表 · 批量编辑污点

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-13`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

勾选多个节点后一次编辑污点，公共污点写入全部选中节点，各节点独有污点只改自己；也可从行操作菜单编辑单个节点。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-13** — 已知节点列表有可写权限，当勾选一个或多个节点并点击「编辑污点」，或从行操作菜单选择「编辑污点」，则打开批量污点弹窗：多选时上方为「公共污点」（所有选中节点共有的污点，修改写入全部节点）、下方为按节点折叠的「各节点独有污点」；单选时只有一份列表。每行由「键 / 值 / 效果（阻止调度 / 尽可能阻止调度 / 阻止调度并驱逐现有容器组）」组成，可增删行。提交前校验键非空、键与效果不重复；未变化的节点不写入；每个节点带自己的 `resourceVersion` 独立写入，冲突（409）或无权限（403）逐节点报告且不回滚已成功的节点；成功后提示更新数量并刷新列表。成员集群的节点写入被明确拒绝并说明原因（ks-apiserver core 组无成员集群形态），不静默写到主集群。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US9 - 一次给多个节点加同样的污点 (Priority: P2)

作为 **集群管理员**，我希望 **勾选多个节点后一次编辑它们的污点**，以便 **在维护一批机器时不必逐台打开详情页重复操作**。

**Independent Test**：勾选两个节点打开「编辑污点」，在公共污点里加一条并提交，两个节点的 `spec.taints` 都出现该污点；只改其中一个节点的独有污点，另一个节点不被写入。

## 前置与配置

- 已登录 admin；host 集群（成员集群的节点写入被明确拒绝，见 troubleshoot）
- 至少两个节点，且测试前后记录各自的 spec.taints 以便还原

## 测试步骤

1. 打开节点列表，勾选两个节点，断言「编辑污点」按钮由禁用变为可用
2. 点击「编辑污点」，断言弹窗标题为「批量编辑污点」，含「公共污点」与「各节点独有污点」两段
3. 在公共污点里添加一条临时污点（唯一键），提交
4. 以 API 回读两个节点，确认都出现该污点
5. 只修改其中一个节点的独有污点并提交，确认另一个节点的 resourceVersion 未被改动
6. 关闭弹窗，从行操作菜单选择「编辑污点」，确认打开同一弹窗且只含该节点
7. finally 清除本用例添加的污点，核对两个节点的 spec.taints 与初始一致

## 期望结果

- 公共污点写入全部选中节点；只改独有污点时其他节点不被写入
- 未变化的节点不产生 PATCH（不 bump resourceVersion）
- 键为空或键与效果重复时提交被拦截，不产生任何写入
- 冲突（409）与无权限（403）按节点名分别报告，已成功的节点不回滚
- 成员集群点击提交时显示「成员集群的节点无法从控制台写入」，不静默写到 host

## 失败排查

- 提交后全部失败且提示成员集群不支持：后端 core 组没有成员集群形态，改用 host 集群验证或使用 kubectl
- 提交无反应：确认勾选了节点（按钮未禁用）且至少改动了一条污点，未变化时不会写入
- 409：节点被其他管理员修改，关闭弹窗重开以取得新的 resourceVersion

## 产品改版后如何更新自动化

- 句柄：nodes:select、nodes:select:<name>、nodes:bulk-taints、nodes:taints、node-taints-bulk:surface/submit/cancel/result、node-taints:common:editor/add、node-taints:<name>:editor
