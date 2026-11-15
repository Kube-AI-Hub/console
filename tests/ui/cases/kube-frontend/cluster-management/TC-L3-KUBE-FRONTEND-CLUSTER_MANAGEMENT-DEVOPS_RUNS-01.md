# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01 流水线运行 · 请求链路、运行记录、运行详情与日志错误

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `devops-runs`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/devops`
- **需求**: `prd/kube-frontend/cluster-management/devops-projects.md`

## 产品功能

触发运行后 PipelineRun 对象创建（label/pipelineRef/generateName）、页面提示与刷新、运行记录列与「未运行」如实展示、运行详情字段、日志 404 的错误+重试、重放与失败注入；运行成功与日志正文受 Jenkins 通道阻塞不在本用例通过范围。

### 关联需求

- `prd/kube-frontend/cluster-management/devops-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-01** — Given 流水线列表有行或已打开流水线详情，When 点运行（多分支先选分支、带参数先填参数）提交，Then 发出 POST `/apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns`，body 含 `metadata.generateName=<pipeline>-`、label `devops.kubesphere.io/pipeline=<pipeline>`、`spec.pipelineRef.name=<pipeline>`，有分支时含 `spec.scm.refName`；成功后显示「已提交运行请求：<name>」并刷新运行记录；失败显示服务端消息；页面不承诺运行成功。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-DEVOPS_RUNS-02** — Given 打开流水线详情的运行记录，Then 表格列为 状态 / 编号 / 提交 / 分支（仅多分支）/ 最近消息 / 耗时 / 开始时间 / 操作，按开始时间（缺失时创建时间）倒序；状态按注解 `devops.kubesphere.io/jenkins-pipelinerun-status` 的 state / result 映射为 排队中 / 运行中 / 成功 / 失败 / 已中止 / 已暂停 / 不稳定 / 未运行；无注解的运行仍出现在表格（编号回退对象名、状态「未运行」、开始时间回退创建时间、耗时按对象缺省显示 `0s`），不得消失；空集合显示「该流水线还没有运行记录。」；点编号打开运行详情，显示编号 / 状态 / 控制器阶段 / 开始时间 / 耗时 / 提交与状态消息；日志接口失败显示失败原因与重试；重放按钮再次提交同一运行；运行记录读取失败显示失败原因与重试。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/devops-projects.md`](../../../../design/kube-frontend/cluster-management/devops-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/devops-projects.md`](../../../../prd/kube-frontend/cluster-management/devops-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US9 - 触发运行并如实查看运行记录 (Priority: P1)

作为 **DevOps 使用者**，我希望 **在流水线列表行或详情页触发一次运行，并在运行记录里看到新建的 PipelineRun 及其编号 / 状态 / 开始时间 / 耗时 / 提交 / 分支 / 消息，以及失败原因与日志错误**，以便 **确认请求链路真的创建了运行对象，而不是被一句「已运行成功」误导**。

**Independent Test**：在流水线行点运行（或详情页运行，多分支先选分支、带参数先填参数），页面提示「已提交运行请求」并刷新运行记录；用接口核对新 PipelineRun 的 label 与 pipelineRef 指向该流水线；运行记录出现该对象，无 Jenkins 状态注解时状态为「未运行」；点编号打开运行详情，显示状态 / 控制器阶段 / 开始时间 / 耗时 / 提交与状态消息；日志接口不可用时显示失败原因与重试。

## 前置与配置

- 已登录且存在含命名空间的 DevOps 工程；不存在时 skip
- 用接口创建一条流水线（唯一前缀），finally 删除本用例创建的运行与流水线
- 不删除非本用例创建的运行；不修改他人工件

## 测试步骤

1. 接口创建流水线 pwspec-run-<sfx>
2. 打开其详情，点 pipeline-detail:run 打开运行表单，再点 run-submit
3. 核对页面提示「已提交运行请求」并刷新运行记录
4. 用接口按 label 读取本流水线的运行并核对 label/pipelineRef/generateName
5. 核对运行表格的列、该运行的状态「未运行」、编号回退对象名、耗时 -
6. 点编号链接打开运行详情，核对编号/状态/阶段/开始/耗时/提交字段与日志失败原因+重试
7. 点重放，核对第二次提示与新运行对象；最后注入 POST pipelineruns 422 核对失败提示

## 期望结果

- POST /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/pipelineruns 返回 201，对象 metadata.generateName 以流水线名 + - 开头、label devops.kubesphere.io/pipeline 与 spec.pipelineRef.name 均为流水线名
- 成功后 pipeline-detail:notice 含「已提交运行请求」且包含新运行对象名
- 运行表头为 状态/编号/提交/最近消息/耗时/开始时间/更多操作（多分支才有 分支 列）
- 无 jenkins-pipelinerun-status 注解的运行显示「未运行」，编号列显示对象名，耗时按对象缺省显示 0s（mapper 缺省 0）
- 运行详情显示编号/状态/控制器阶段/开始时间/耗时/提交；日志 404 时 run-log-error 可见并可重试
- 重放创建新运行对象；注入 422 后 notice 显示拦截消息，页面不显示运行成功

## 失败排查

- 运行记录为空但对象存在：确认 labelSelector 过滤与 spec.pipelineRef.name 兜底匹配
- 日志 404 被当成空日志：必须显示 run-log-error
- 状态注入失败：确认注解键为 devops.kubesphere.io/jenkins-pipelinerun-status

## 产品改版后如何更新自动化

- 选择器：pipeline-detail:run/run-form/run-branch/run-param:<name>/run-submit/notice/runs/runs-table/runs-empty/runs-error/runs-retry、run-link/run-status/run-replay:<name>、run-detail/run-id/run-status/run-phase/run-start/run-duration/run-commit/run-message/run-log/run-log-error/run-log-retry
- 运行状态映射变化时同步 format.ts 断言与 pages/devops_page.py
