# 编辑设置（定制编辑表单）（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

在负载详情上新增「编辑设置」弹窗：修改每个容器的镜像、环境变量与镜像拉取策略，以及部署与有状态副本集的副本数。弹窗在提交前列出将改字段，提交复用现有的整对象 PUT（`resourceApi.update`），对象在弹窗打开期间被改动时以 409 冲突提示刷新。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01`
- `prd/kube-frontend/app-workloads/edit-form.md`

## 设计目标与非目标

- **目标**：用一屏表单关掉「改镜像必须编辑整份 YAML」这个缺口；提交前后都不碰用户没编辑的字段。
- **非目标**：不复刻老 console 的六个页签，不接管更新策略、存储、亲和性、优雅终止；不给 Job 开入口；不改写 YAML 编辑器。

## 关键约束

- 三种控制器与 CronJob 的 Pod 模板路径不同：控制器是 `spec.template`，CronJob 是 `spec.jobTemplate.spec.template`。
- Job 的 `spec.template` 创建后不可变，因此不显示入口。
- 写是整对象 PUT，必须带 `resourceVersion`；`resourceApi.update` 先读当前对象再合并提交。
- 环境变量的 `valueFrom` 引用不能在表单里编辑，保存时必须原样保留。
- 页面契约：不允许裸 `<button>`，每个动作有字面量 `data-ai-id`（`actionProps` 或 `data-ai-id`）。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01 — 只做最常改的字段，其余留给 YAML

**为什么**：老 console 的六页签（更新策略、容器模板、存储、亲和性、优雅终止、高级设置）是一整套创建向导的复制。整份复刻会让同一个字段有两套实现（创建与编辑），改一处必须同时改两处；而实际编辑请求集中在镜像、副本数、环境变量、拉取策略四项。其余字段的编辑路径已经存在（「编辑 YAML」），能力没有丢，只是入口不同。

**被否方案**：把创建向导整页塞进编辑弹窗。它会带上不可改的名称、另一套校验与提交协议，并且让「编辑」与「创建」的字段差异无处安放。

**何时重新考虑**：当「编辑 YAML」的使用数据表明某类字段频繁被手改（例如 resources/limits），再按字段补进表单，而不是按页签整块搬。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-02 — 提交搞对象 PUT，而不是 merge patch

**为什么**：`resourceApi.update` 已经实现了「先读 `resourceVersion`、与存储对象合并、再 PUT」的整套逻辑，且「编辑信息」「编辑 YAML」都在用它。改镜像只发 `spec.template.spec.containers[0].image` 的 merge patch 看似更小，但删除环境变量在 patch 语义下要发 `null`，与整表重写相比更容易出现「删了但没删掉」。复用同一写路径意味着 409 处理、错误形状与既有页面一致。

**被否方案**：`PATCH application/merge-patch+json` 只发 diff。省流量，但删除数组元素的语义与表单的「提交整份 env 列表」不一致，且需要第二套写路径的测试。

**何时重新考虑**：如果负载对象大到 PUT 明显变慢，或 apiserver 对并发 PUT 的拒绝率成为问题。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-03 — 提交前列出将改字段

**为什么**：整对象 PUT 让「这次保存会改什么」不可见，而用户的恐惧正是「点一下把别的字段改没了」。表单实时把差异算成字段路径 + 旧值 → 新值，保存按钮在无变更或校验失败时禁用。这样错误在提交前暴露，而不是在 409 或校验拒绝之后。

**被否方案**：提交后展示服务端 diff。服务端的对象已经变了，再展示等于事后解释；而且失败时没有 diff 可看。

**何时重新考虑**：需要「保存并对比前后版本」时，作为独立的版本对比功能，而不是塞进这个弹窗。

## 系统现状

老 console 的「编辑设置」是 `workload.template.edit` action 打开的 `ConfigTemplate` 弹窗，页签由 `src/pages/projects/components/Modals/ConfigTemplate/config.js` 配置，按 module 取不同组件（`PodTemplate`、`VolumeSettings`、`Affinity`、`UpdateStrategy`、`TerminationSeconds`、`AdvanceSettings`），提交走 workload store 的 update。新 UI 之前只有「扩缩容」（一个数字）与「编辑 YAML」；改镜像只能改 YAML。

## 仓库落点

| 层 | 路径 | 改动 |
| --- | --- | --- |
| 页面 | `kube-frontend/apps/console-next/src/pages/app-workloads/WorkloadDetailPage.tsx` | 头部「编辑设置」入口与弹窗挂载 |
| 组件 | `kube-frontend/apps/console-next/src/pages/app-workloads/EditWorkloadDialog.tsx` | 新增：表单、校验、变更列表、错误处理 |
| 描述符 | `kube-frontend/apps/console-next/src/pages/app-workloads/queries.ts` | `allowEditSettings` 标记四个种类 |
| 写接口 | `kube-frontend/packages/api-client/src/resources.ts` | 复用 `resourceApi.update`；无新增端点 |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | `workloads.editSettings.*` 中英成对新增 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `PUT /apis/apps/v1/namespaces/<ns>/deployments/<name>` | Kubernetes 对象 | 带 `resourceVersion` 的整对象 PUT；`statefulsets`/`daemonsets` 同形 | apiserver |
| `PUT /apis/batch/v1/namespaces/<ns>/cronjobs/<name>` | Kubernetes 对象 | 字段路径为 `spec.jobTemplate.spec.template.spec.containers` | apiserver |
| `<kind>-edit:image` / `:env` / `:env-add` / `:env-key:*` / `:env-remove:*` / `:pull-policy` / `:replicas` / `:submit` / `:diff` / `:error` | `data-ai-id` | 弹窗内的稳定句柄；多容器时在基本句柄后追加 `:容器名` | 自动化与智能体 |

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01**：提交对象中，用户未编辑的字段与打开弹窗时读取的对象逐字段相等（包括副本数、注解、其他容器、探针、存储）。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-02**：环境变量引用型条目（`valueFrom`）保存后与保存前完全一致，表单不能把它降级成字面值。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-03**：变更列表中的每一行都对应实际提交产生的变化；没有变化时保存不可用。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01** | 控制器与 CronJob 的 Pod 模板路径不同：`spec.template` 与 `spec.jobTemplate.spec.template` | 定时任务保存进错路径，镜像没变或对象被写坏 | `templateOf` 按 kind 分支，提交也在同一函数上走 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-02** | 环境变量是可以带 `valueFrom` 的联合类型；把它当 `value` 字符串写回会丢掉来源引用 | 保存后变量变成空值，容器启动即失败 | 引用型条目只读，提交时把原对象原样放回 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-03** | `resourceApi.update` 先读 kapis 再 PUT；读到的对象才是合并的基底 | 只用表单字段拼 PUT 体会把探针、资源限额、存储全部抹掉 | 提交基于 `detail.raw` 的深拷贝改字段，再由 update 合并 |
| **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-04** | 对象在弹窗打开期间被别处更新时，PUT 返回 409 | 关闭弹窗会让人以为保存成功；重试同一份旧对象会一直 409 | 弹窗捕获冲突、保持打开、提示刷新 |

## 测试与可观测

- **单元**：表单纯函数（`toDrafts`、差异计算、提交对象构造）由页面测试覆盖；组件在 `test/areas-page.test.tsx` 之外按需补。
- **端到端**：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01` 用 fixture 部署走「改镜像 → 回读 → 新增环境变量 → 回读 → 还原 → 删除」。
- **手动验证**：多容器部署打开弹窗，确认句柄带容器名、变更列表逐项列出；启动两个会话同时保存，确认后一个得到 409 提示。
- **日志 / 指标**：不适用；失败时看 PUT 响应与弹窗内错误文本。

## 后续改进

- 把 `resources/limits`、更新策略等字段按使用数据逐项补进表单，而不是复刻页签。
- 若表单字段继续增长，抽出「字段 → 差异行」的共享 hook，避免每个新字段都要手写一遍 diff。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01`
