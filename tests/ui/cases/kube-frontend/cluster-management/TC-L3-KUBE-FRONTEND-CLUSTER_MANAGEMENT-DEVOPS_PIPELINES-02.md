# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02 DevOps 流水线 · 创建（单分支/多分支）、编辑、复制、删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-pipelines`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

通过创建对话框分别创建单分支（Jenkinsfile）与多分支（SCM 发现配置）流水线，校验提交 body；编辑时名称与类型只读、别名/描述可改；复制预填源内容但名称留空；删除需输入名称确认。测试对象唯一前缀并在 finally 删除。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-03** — Given 打开流水线页签，When 点创建并填名称、类型、别名、描述后提交，Then 单分支提交 `spec.type=pipeline` 且 `spec.pipeline.jenkinsfile` 为编辑器内容（默认预填 starter Jenkinsfile），多分支提交 `spec.type=multi-branch-pipeline` 且 `spec.multi_branch_pipeline` 含 source_type、仓库地址、属主、凭证与脚本路径（默认 Jenkinsfile，未选凭证时 `credential_id` 为空串）；名称为空或非法时提示且不提交；成功后按名称搜索可见新行；失败时对话框保持打开、保留输入并显示服务端消息。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_PIPELINES-04** — Given 流水线列表有行，When 点编辑 / 复制 / 删除，Then 编辑对话框的名称与类型只读、别名 / 描述 / Jenkinsfile 可改，保存走整对象 PUT 且保留 spec 其他字段；复制对话框名称留空、类型与 Jenkinsfile 沿用源；删除需在对话框输入流水线名确认，成功后行消失；取消不写；失败时显示服务端消息。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US7 - 创建、编辑、复制、删除流水线 (Priority: P1)

作为 **DevOps 使用者**，我希望 **创建单分支（直接写 Jenkinsfile）或多分支（SCM 发现配置）流水线，编辑别名 / 描述 / Jenkinsfile，复制已有流水线，并删除不需要的流水线**，以便 **在流水线页签完成从创建到清理的全部维护**。

**Independent Test**：在流水线页签点创建，单分支填唯一名称与 Jenkinsfile，多分支填代码源 / 仓库地址 / 属主 / 脚本路径并提交，列表按名称搜索可见新行；编辑别名与描述保存后回显；复制时名称留空而类型与 Jenkinsfile 沿用源，提交后出现第二条；删除时在对话框输入流水线名确认，行消失。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 每步创建的对象名唯一（pwspec-pipe-/pwspec-mb-/pwspec-copy-），finally 全部删除
- 不删除非本用例创建的流水线

## 测试步骤

1. 打开流水线页签，点创建，核对对话框默认值（名称空、类型单分支、Jenkinsfile 预填 starter）
2. 名称留空提交，核对校验提示
3. 填唯一名称/别名/描述/Jenkinsfile 提交，按名称搜索核对新行与接口 body
4. 再创建多分支：类型切多分支，核对凭证下拉显示「不使用凭证」，填代码源/仓库/属主/脚本路径提交并核对接口 body
5. 对单分支点编辑，核对名称与类型 disabled，修改别名与描述保存并核对接口注解
6. 对单分支点复制，核对名称空、类型与 Jenkinsfile 沿用源；填新名称提交并核对新对象
7. 删除复制出的流水线与两条原流水线，核对对话框中输入名称后行消失

## 期望结果

- 名称留空提交显示「请输入名称。」且不发请求
- 单分支创建后接口 spec.type=pipeline 且 spec.pipeline.jenkinsfile 等于编辑器内容（默认 starter Jenkinsfile）
- 多分支创建后接口 spec.type=multi-branch-pipeline，spec.multi_branch_pipeline.source_type=github、repo 等于提交地址、script_path 默认 Jenkinsfile，未选凭证时 credential_id 为空串
- 编辑对话框中名称输入框与类型下拉为 disabled；保存后别名/描述注解更新且 spec.pipeline.parameters 等其他字段仍在
- 复制对话框标题为「复制流水线」、名称可输入且为空、Jenkinsfile 等于源；提交后新对象 Jenkinsfile 等于源
- 删除对话框必须输入完整名称才可点删除；删除后按名称搜索无结果、接口 GET 404

## 失败排查

- 创建 400 createItem：Jenkins 通道不可用时的错误原样显示，不要改成「创建成功」
- 编辑 Jenkinsfile 不落库：编辑对话框保存的是元数据，Jenkinsfile 持久化见 PIPELINES-03
- 多分支凭证下拉空：确认使用哨兵值 none 且提交 credential_id 为空串

## 产品改版后如何更新自动化

- 选择器：devops-detail:pipelines-create、devops:pipeline-form-name/-type/-alias/-description/-jenkinsfile/-source/-repo/-owner/-credential/-script-path/-submit、行 pipeline-edit/copy/delete:<name>、devops-detail:delete-input/-delete-confirm
- 表单字段变化时同步 pages/devops_page.py 与断言
