# 编辑设置（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

老 console 的「编辑设置」弹窗按资源读取一份页签配置，提交时把整份对象交给现有的 workload `update`。这次补上创建向导里已有、编辑弹窗里没有、且 API 允许更新的页。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-02`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-03`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-04`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-05`

## 设计目标与非目标

- **目标**：编辑页签复用创建组件，字段路径与创建向导相同。
- **非目标**：不重写 kube-frontend 的负载详情，不给 Pod 增加编辑表单，不改 kube-server。

## 关键约束

- Job 的 `spec.template` 在创建后不可变。编辑页若带上节点选择或容器，保存会被 API 拒绝。
- CronJob 的可改内容在 `spec.jobTemplate`，不能沿用 Deployment 的 `spec.template` 前缀。
- 守护进程集的创建向导不提供节点选择，编辑必须同样跳过。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01：编辑复用创建组件，而不是再写一套字段

- **备选**：在编辑弹窗里复制节点选择和元数据表单。把创建向导整页嵌进编辑弹窗。
- **选定**：页签继续用现有编辑弹窗，高级设置、容器组安全上下文和容器组注解直接引用创建用的组件。
- **原因**：两套表单会在 GPU、探针或节点选择改一处时再次分叉。
- **被否方案**：整页嵌入创建向导会带上不可改的名称和另一套提交协议。
- **何时重新考虑**：kube-frontend 接管这些详情页时，把同一份页签配置迁过去，而不是再实现一次。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-02：任务只编辑可变策略

- **备选**：任务编辑与创建向导完全同页。任务不提供编辑设置，只留 YAML。
- **选定**：任务编辑只含重试次数、并行数、完成数、超时和对象级标签、注解。
- **原因**：`spec.template` 不可变，同页编辑会在保存时失败。只留 YAML 又让四个本来能改的数字没有表单入口。
- **被否方案**：与创建完全同页。
- **何时重新考虑**：Kubernetes 允许更新 Job Pod 模板时。

## 系统现状

`workload.template.edit` 打开 `ConfigTemplate` 弹窗，页签来自 `config.js`。部署原先没有「高级设置」。任务和定时任务详情没有这个入口。容器组只有编辑 YAML。

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 页面 | `console` | `src/pages/projects/components/Modals/ConfigTemplate/config.js` | 补页签 |
| 页面 | `console` | `src/pages/projects/containers/Jobs/Detail/index.jsx`、`CronJobs/Detail/index.jsx` | 增加「编辑设置」 |
| 表单 | `console` | `src/components/Forms/Workload/AdvanceSettings/index.jsx`、`src/components/EditForms/Workload/PodTemplate/index.jsx`、`src/components/Forms/Job/JobSettings/index.jsx`、`src/components/Forms/Job/ContainerSettings/index.jsx` | 接上编辑弹窗的变更回调，并补容器组字段 |
| 状态 | `console` | 不改 | 仍用现有 workload store 的 update |
| 文案 | `console` | 不改 | 复用已有 key |
| 接口 | `kube-server` | 不改 | 仍走现有对象更新 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| Deployment / StatefulSet `spec.template.spec.nodeSelector` | Kubernetes 对象 | 编辑高级设置写入的节点选择 | 调度器 |
| Job `spec.backoffLimit` 等四个数字 | Kubernetes 对象 | 任务编辑允许提交的策略 | Job 控制器 |
| CronJob `spec.jobTemplate` | Kubernetes 对象 | 定时任务编辑的策略、容器、存储和高级设置 | CronJob 控制器 |

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01**：任务编辑提交的对象不得改写 `spec.template`。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-02**：守护进程集编辑不渲染节点选择，与创建向导一致。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01** | 编辑弹窗只有收到表单 `onChange` 才会记下「这一页改过」，底部确定按钮才可点 | 节点选择改了却无法提交 | `AdvanceSettings` 把 `formProps` 传给 `Form` |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-02** | 定时任务的 Pod 字段前缀是 `spec.jobTemplate.spec.template`，不是 `spec.template` | 保存进错路径，创建出来的 Job 不带节点选择 | `config.js` 的 cronjobs 页签传入该前缀 |

## 测试与可观测

- **自动化**：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01` 覆盖两条 AC。
- **手动验证**：部署详情「编辑设置」能看到「高级设置 / 选择节点」；任务编辑能看到「最大重试次数」且没有「选择节点」；容器组详情没有「编辑设置」。
- **日志 / 指标**：不适用。保存失败时看浏览器里对象更新请求的响应。

## 后续改进

kube-frontend 的负载详情接管「编辑设置」时，复用这里的页签范围，不要按新页面再裁一版。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-01`


## 资源限额与更新策略的实现决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-03 — 资源与策略在存储对象上就地改写，不重建

**为什么**：提交是整对象 PUT，重建 `resources`/`strategy` 会抹掉表单不展示的键（hugepages、GPU 资源、驱动写入的默认 rollingUpdate 参数）。实现读出现有映射、只覆盖 cpu/memory 与本次涉及的 rollingUpdate 字段，其余原样写回。

**被否方案**：用表单值整体替换 `resources` / `rollingUpdate`。实测会把 `maxUnavailable: 25%` 这类服务端默认值清掉。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-04 — 非滚动策略下删除 rollingUpdate

**为什么**：Recreate/OnDelete 不接受滚动参数；留着是死数据，下一次有人改回滚动时又会悄悄生效。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_SETTINGS-05 — 数量与顺序在本地校验

**为什么**：`requests > limits` 会被 apiserver 拒绝，数量拼错同样；本地拒绝能把「哪一项错了」说清楚，而不是把 422 原文抛给读者。

## 已知坑

- 部署的 `spec.strategy` 与有状态副本集/守护进程集的 `spec.updateStrategy` 是两个不同字段，共用一套表单时必须按 kind 取路径。
- 新建对象时服务端会补 `strategy.rollingUpdate.maxUnavailable: 25%`，所以「没改策略」时 diff 不应出现策略行；只有读者真的改了才提交。
