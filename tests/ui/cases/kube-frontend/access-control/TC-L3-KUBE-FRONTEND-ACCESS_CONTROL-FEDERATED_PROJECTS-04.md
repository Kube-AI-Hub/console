# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04 联邦项目 · 创建（校验、两步写入、回读与清理）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

列表页的「创建联邦项目」打开名称/别名/描述/企业空间/部署集群表单；校验在提交前生效，合法提交先创建带 kubefed.io/managed=true 的宿主命名空间再创建 FederatedNamespace，成功后列表出现新行且详情回读放置与传播状态；失败保留输入。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-04** — 已知当前账号被允许创建联邦项目，当打开列表页，则「创建联邦项目」可用；当提交空名称、大写/非法名称、超过 63 字符的名称或未选任何集群，则在对话框内显示对应的校验说明且不发出创建请求；当名称与企业空间中已存在的命名空间同名，则提示名称已存在且不创建；当填写合法名称、别名、描述并选择集群后提交，则先创建带 `kubesphere.io/workspace` 与 `kubefed.io/managed=true` 标签的命名空间，再在该命名空间创建 FederatedNamespace（`spec.placement.clusters` 为所选集群、模板只带标签、别名/描述通过 `spec.overrides` 传播），成功后对话框关闭、列表刷新并出现新行，详情显示该行；已知第二步写入失败，则删除刚创建的命名空间并保留对话框内的输入与失败说明；已知当前账号被明确拒绝创建，则「创建联邦项目」禁用并在旁显示原因。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建、编辑与删除联邦项目 (Priority: P1)

作为 **企业空间管理员**，我希望 **在列表页直接创建联邦项目（名称/别名/描述/放置集群）、编辑别名与描述、调整部署集群、删除单个或批量删除**，以便 **不必切到联邦控制面命令行就能完成多集群项目的日常维护**。

**Independent Test**：用唯一名称创建联邦项目，确认列表出现该行且详情显示所选集群与传播状态；编辑别名后回读生效；调整部署集群后回读新集合；分别在列表行与批量选择中删除，确认确认框、行消失与命名空间清理。

## 前置与配置

- 已登录，联邦 API 可读写，至少一个就绪集群（host）
- 当前账号有创建命名空间与 FederatedNamespace 的权限

## 测试步骤

1. 打开企业空间联邦项目列表，记录列表行数
2. 点「创建联邦项目」，不填任何内容直接提交，核对名称必填错误
3. 填非法名称（大写/下划线）提交，核对格式错误；填 64 个字符的名称，核对输入被限制为 63 字符
4. 填合法唯一名称，清空已选集群后提交，核对放置集群必填错误
5. 重新选择 host 集群，填写别名与描述后提交
6. 等待对话框关闭与列表出现该行；用联邦 API 回读对象
7. 打开详情，核对部署集群、别名与传播状态
8. 清理：删除宿主命名空间并轮询到 404

## 期望结果

- 空名称与非法名称显示对应错误且不发出创建请求；名称输入最多 63 字符（前端阻止超长输入）
- 未选集群时显示「请至少选择一个部署集群。」
- 创建成功后列表出现该行，详情标题为别名或名称
- FederatedNamespace 的 metadata.labels 含 kubesphere.io/workspace；spec.template.metadata 只有标签、没有 annotations
- spec.placement.clusters 为所选集群；spec.overrides 每个集群带 /metadata/annotations 且值为对象注解（creator/alias/description）
- 宿主命名空间 labels 含 kubefed.io/managed=true，控制面回报 Propagation=True（允许先 False 再转 True）
- 详情「部署集群」含 host，「传播状态」为已传播或控制面未回报时显示 -
- 创建按钮存在且未被禁用（有权限时）
- 清理后联邦 API 与命名空间都不存在

## 失败排查

- 列表没有新行：列表按 template 的 workspace 标签过滤，检查创建体是否写入该标签
- Propagation 恒为 False：宿主命名空间标签写成了 kubefed.io/managed=false；见 design DEC-10
- 详情无别名：别名写进了 spec.template.metadata.annotations（控制面拒绝）而不是对象注解 + overrides
- 创建报 409：名称与既有命名空间冲突；用例必须用唯一前缀

## 产品改版后如何更新自动化

- 选择器：federated-projects:create / :create-name / :create-alias / :create-description / :create-clusters / :create-submit
- 创建体字段变化时同步改 packages/api-client/src/federated.ts 与本用例的回读断言
