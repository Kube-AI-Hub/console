# 定制编辑表单（L3）

[子模块需求](./_index.md)

## 概述

部署、有状态副本集、守护进程集的详情提供「编辑设置」，直接修改最常见的几项：**每个容器的镜像**、**副本数**（部署与有状态副本集）、**环境变量的增删改**、**镜像拉取策略**。定时任务的同一入口改 `spec.jobTemplate.spec.template` 下的同样字段。

这是对老 console「编辑设置」（`workload.template.edit` 的六页签弹窗）的收窄实现：老 console 还能改更新策略、存储、亲和性、优雅终止等，本功能只覆盖最常改、且 API 允许在运行中更新的字段，其余字段仍走「编辑 YAML」。收窄的理由写进 design 的 DEC 与被否方案，不悄悄丢能力。

没有这个入口时，改镜像必须先学会整份 YAML：这是新 UI 相对老 console 最直接的编辑能力退化，也是本功能存在的理由。

## 用户故事

### US1 - 不打开 YAML 就换镜像 (Priority: P1)

作为 **项目运维**，我希望 **在部署详情里给某个容器换镜像并保存**，以便 **不必编辑整份对象 YAML，也不怕改坏别的字段**。

**Independent Test**：打开一个部署详情，用「编辑设置」把镜像改成带唯一后缀的 tag，保存后回读 `spec.template.spec.containers[].image` 与所填一致，其他字段未变。

### US2 - 增删改环境变量并在提交前确认影响 (Priority: P1)

作为 **项目运维**，我希望 **在同一个弹窗里新增一个环境变量，并在提交前看到「将要修改的字段」**，以便 **知道这次保存到底会改什么**。

**Independent Test**：在「编辑设置」里新增一个环境变量，弹窗的变更列表出现该变量，保存后回读 `env` 出现该项；删除该行再保存后回读不再出现。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01** — 已知一个部署已存在，当打开其详情并进入「编辑设置」，则弹窗按容器列出镜像与环境变量、并给出副本数与拉取策略；改镜像或新增环境变量后，变更列表逐项列出将改的字段与新旧值；保存后回读 `spec.template.spec.containers[].image` 与 `env` 与填写内容一致，未编辑的字段（如副本数、对象注解）保持不变；保存被拒绝时弹窗不关闭并显示错误，资源版本冲突（409）时提示刷新后重试。

## 设计目标

1. **只改该改的字段**：提交是一次整对象 PUT，其余字段必须原样保留。
2. **提交前可读**：保存按钮只在有变更、且校验通过时可用，并列出将改字段。
3. **失败可解释**：API 拒绝与 409 冲突在弹窗内显示，不关闭、不丢输入。

## 约束与边界

- 可改：三种控制器与定时任务的 Pod 模板中每个容器的 `image`、`env`、`imagePullPolicy`；部署与有状态副本集的 `spec.replicas`。
- 不可改：容器名、对象名、任务（Job）的 `spec.template`（创建后不可变；入口不对 Job 显示）、别名与描述（仍走「编辑信息」）、其余 Pod 模板字段（仍走「编辑 YAML」）。
- 写路径：`PUT /apis/apps/v1/namespaces/<ns>/{deployments,statefulsets,daemonsets}/<name>`，带当前 `resourceVersion`；定时任务写 `batch/v1`。
- 环境变量的引用型条目（`valueFrom` ConfigMap/Secret）原样保留、不在此表单编辑。

## UI 交互设计

- 入口：详情页头部「编辑设置」，部署/有状态副本集/守护进程集/定时任务可见。
- 弹窗自上而下：说明 → 副本数（仅两种控制器）→ 每个容器一组（镜像、拉取策略、环境变量行 + 「新增环境变量」）→ 「将要修改的字段」列表 → 错误提示。
- 环境变量每行：变量名、值、删除按钮；引用型行只读并给出提示。
- 保存成功后关闭并刷新详情；失败保持打开。

## 文案与校验

- 镜像是必填项，空值不能提交。
- 副本数必须是不小于 0 的整数；设为 0 会停止工作负载但保留对象。
- 环境变量名不能为空，同一容器内不能重名；值可以为空字符串。
- 拉取策略可选「跟随集群默认」、`Always`、`IfNotPresent`、`Never`。
- 没有改动时保存按钮禁用，变更列表显示「还没有改动任何字段」。

| key | 中文 | 英文 |
| --- | --- | --- |
| `workloads.editSettings.title` | 编辑设置 | Edit settings |
| `workloads.editSettings.image` | 镜像 | Image |
| `workloads.editSettings.pullPolicy` | 镜像拉取策略 | Image pull policy |
| `workloads.editSettings.env` | 环境变量 | Environment variables |
| `workloads.editSettings.envAdd` | 新增环境变量 | Add environment variable |
| `workloads.editSettings.changes` | 将要修改的字段 | Fields that will change |
| `workloads.editSettings.conflict` | 对象已被其他操作更新（资源版本冲突），请关闭弹窗刷新后重试。 | The object changed elsewhere (resource version conflict). Close the dialog, reload, and try again. |

## 边界情况

- 多容器对象：按容器分组，句柄带容器名，避免同名控件无法区分。
- 环境变量引用了 ConfigMap/Secret：显示当前来源名称，行只读；保存时原对象原样写回。
- 对象在弹窗打开期间被别处改动：保存得到 409，弹窗保留输入并提示刷新。
- 定时任务：字段落在 `spec.jobTemplate.spec.template`，不出现副本数。
- 对象没有容器（异常输入）：不渲染容器分组，保存禁用。

## 明确不做

- 不复刻老 console 的六页签（更新策略、存储、亲和性、优雅终止、高级设置）；这些仍走「编辑 YAML」。
- 不给任务（Job）提供该入口：`spec.template` 创建后不可变，保存必然被 API 拒绝。
- 不在表单里改容器名或对象名；改名不是 Kubernetes 支持的操作。
- 不做实时 diff 预览之外的保存预览/干跑。
- 不改服务的端口与路由规则编辑入口（各自已有弹窗）。

## 假设

- 操作者已登录，且对目标项目有更新工作负载的权限。
- kapis 返回的对象带有 `resourceVersion` 或写入前能读到；写接口是幂等的整对象 PUT。
- 镜像名与 tag 的合法性由镜像仓库与集群校验，表单只拦空值。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01**：系统必须在部署、有状态副本集、守护进程集与定时任务的详情提供「编辑设置」，支持每个容器的镜像、环境变量增删改、镜像拉取策略，以及部署与有状态副本集的副本数，并在提交前列出将改字段。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01**：改镜像或环境变量并保存后，回读对象与填写内容一致，且未编辑字段（副本数、注解、其余容器字段）保持不变；409 时弹窗保持打开并给出刷新提示。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01`
