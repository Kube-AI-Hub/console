# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06 联邦项目 · 单条与批量删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

行操作「删除」输入项目名称确认后删除项目（命名空间）；勾选多行后「批量删除」输入数量确认；成功后列表刷新为实际剩余集合，失败原因保留在确认框。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-06** — 已知存在至少一个联邦项目，当在行操作中删除并输入项目名称确认，则发出命名空间删除请求，成功后列表刷新且该行消失（命名空间 finalizer 完成前可显示为删除中），其它行不受影响；当勾选多行后执行批量删除，则确认框要求输入数量，成功删除所选全部项目，失败时对话框保持打开并显示失败原因，已成功删除的对象不回滚、列表刷新为实际剩余集合；已知当前账号被明确拒绝删除，则操作在打开确认框前提示无权限。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 创建、编辑与删除联邦项目 (Priority: P1)

作为 **企业空间管理员**，我希望 **在列表页直接创建联邦项目（名称/别名/描述/放置集群）、编辑别名与描述、调整部署集群、删除单个或批量删除**，以便 **不必切到联邦控制面命令行就能完成多集群项目的日常维护**。

**Independent Test**：用唯一名称创建联邦项目，确认列表出现该行且详情显示所选集群与传播状态；编辑别名后回读生效；调整部署集群后回读新集合；分别在列表行与批量选择中删除，确认确认框、行消失与命名空间清理。

## 前置与配置

- 已登录，联邦 API 可读写，至少一个就绪集群
- 预置三个唯一名称的联邦项目（宿主编 managed=true，放置 host）

## 测试步骤

1. 用 API 预置三个联邦项目
2. 打开列表，搜索第一个项目的唯一前缀并点行操作的「删除」
3. 在确认框输入项目名称并确认，轮询联邦 API 直到项目不存在
4. 搜索第二个项目的唯一前缀，勾选第二个与第三个项目（同一唯一前缀），点「批量删除」
5. 在确认框输入数量 2 并确认，轮询两个项目都不存在
6. 刷新列表，核对预置对象不再出现
7. 清理：删除所有遗留的、本次唯一前缀的宿主命名空间

## 期望结果

- 单条删除：确认框要求输入完整项目名称；确认后 DELETE /api/v1/namespaces/<name> 发出，项目在 2 分钟内从联邦 API 消失
- 批量删除：确认框要求输入数量；确认后两个项目都从联邦 API 消失
- 删除后列表刷新，不残留已删除对象；其它对象不受影响
- 确认框标题为「删除联邦项目」或「批量删除联邦项目」
- 清理后没有本次前缀的命名空间与联邦对象残留

## 失败排查

- 行没消失：命名空间仍在 Terminating；继续轮询，勿重复点击删除
- 批量删除按钮禁用：列表未勾选或行被判定为 deleting；先搜索到目标行再勾选
- 删除 403：当前账号无删除命名空间权限；用例记录为权限分支而非产品缺陷

## 产品改版后如何更新自动化

- 选择器：federated-projects:delete / :bulk-delete / :select / :delete-input / :delete-confirm
- 删除语义变化（改为删 FederatedNamespace）时同步 federated.ts 与 design DEC-14
