# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01 编辑设置 · 改镜像、增删环境变量并在提交前看到变更

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `edit-form`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/edit-form.md`

## 产品功能

部署详情的「编辑设置」按容器列出镜像与环境变量；把镜像改成唯一 tag、新增一个环境变量后保存，回读对象的 Pod 模板与填写一致；弹窗在提交前列出将改字段，其余字段保持不变，最后还原。

### 关联需求

- `prd/kube-frontend/app-workloads/edit-form.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/edit-form.md`](../../../../prd/kube-frontend/app-workloads/edit-form.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-EDIT_FORM-01** — 已知一个部署已存在，当打开其详情并进入「编辑设置」，则弹窗按容器列出镜像与环境变量、并给出副本数与拉取策略；改镜像或新增环境变量后，变更列表逐项列出将改的字段与新旧值；保存后回读 `spec.template.spec.containers[].image` 与 `env` 与填写内容一致，未编辑的字段（如副本数、对象注解）保持不变；保存被拒绝时弹窗不关闭并显示错误，资源版本冲突（409）时提示刷新后重试。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/edit-form.md`](../../../../design/kube-frontend/app-workloads/edit-form.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/edit-form.md`](../../../../prd/kube-frontend/app-workloads/edit-form.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 不打开 YAML 就换镜像 (Priority: P1)

作为 **项目运维**，我希望 **在部署详情里给某个容器换镜像并保存**，以便 **不必编辑整份对象 YAML，也不怕改坏别的字段**。

**Independent Test**：打开一个部署详情，用「编辑设置」把镜像改成带唯一后缀的 tag，保存后回读 `spec.template.spec.containers[].image` 与所填一致，其他字段未变。

### US2 - 增删改环境变量并在提交前确认影响 (Priority: P1)

作为 **项目运维**，我希望 **在同一个弹窗里新增一个环境变量，并在提交前看到「将要修改的字段」**，以便 **知道这次保存到底会改什么**。

**Independent Test**：在「编辑设置」里新增一个环境变量，弹窗的变更列表出现该变量，保存后回读 `env` 出现该项；删除该行再保存后回读不再出现。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该部署的详情，点「编辑设置」
2. 把镜像改成带唯一后缀的 tag，读取「将要修改的字段」，保存
3. 回读该部署的 spec 确认镜像、副本数与容器名
4. 重新打开弹窗，新增一个环境变量，保存并回读 env
5. 重新打开弹窗，把镜像改回原值、删除该环境变量，保存并回读

## 期望结果

- 弹窗出现镜像、拉取策略、环境变量与副本数控件
- 变更列表出现 spec.template.spec.containers.main.image 与新的 tag
- 保存后回读 spec.template.spec.containers[0].image 与新 tag 一致，spec.replicas 仍为 1，容器名未变
- 保存后回读 env 出现新增项（名称与值一致），镜像仍是上一步的 tag
- 还原后镜像回到原值、env 中不再有该变量

## 失败排查

- 弹窗没有出现时先确认详情页已加载且部署种类为 deployments
- 保存失败时看 PUT 是否打到 /apis/apps/v1 且带 resourceVersion
- 找不到环境变量输入行时用 data-ai-id 前缀 deployments-edit:env-key 匹配

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts 的 workloads.editSettings.*
- 弹窗结构变化时改 pages/app_workloads.py 的编辑设置辅助方法
