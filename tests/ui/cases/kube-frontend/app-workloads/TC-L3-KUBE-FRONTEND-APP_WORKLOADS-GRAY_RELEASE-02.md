# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02 灰度发布 · 最小创建向导（确认后写入、列表可见、finally 清理）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

灰度发布列表提供「创建灰度发布」主操作；向导采集名称、目标 Deployment 与类型，下一步只做本地校验并展示确认摘要，点确认后才 POST Strategy；成功后关闭弹窗、列表出现该行；失败在确认弹窗内显示原因；用例 finally 删除并核对计数回创建前。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** — 已知项目内有至少一个 Deployment，当在灰度发布页点「创建灰度发布」，填写合法名称、选择该 Deployment 与 Canary（或 Bluegreen/Mirror）并点「下一步」，则在点「确认创建」之前不产生任何写请求；确认后项目命名空间下出现对应 `Strategy` 对象，其 `spec.type` 等于所选类型、`spec.selector.matchLabels.app` 与 `spec.template.spec.hosts[0]` 来自所选 Deployment 的 app 标签，列表刷新后出现该行（状态为进行中/未知之一）；创建失败（名称冲突/权限/非法字段）时确认弹窗内显示服务端原因且不关闭；用例 finally 删除该对象，结束后 strategies 计数回到创建前。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 不用写 YAML 就能起一个最小灰度发布 (Priority: P1)

作为 **项目运维**，我希望 **在列表上填写名称、选一个 Deployment 与发布类型，确认后创建 Strategy**，以便 **先让控制器接管这次发布，再在后续能力里补流量比例与匹配规则，而不是从零写 manifest**。

**Independent Test**：点「创建灰度发布」，填名称、选项目内 Deployment 与类型，下一步确认后创建；API 回读到 Strategy（spec.type/selector/template 符合选择），列表刷新出现该行，状态为进行中/未知之一。

## 前置与配置

- 已登录，host 集群 default 项目，servicemesh 已启用
- 项目内至少一个 Deployment；strategies 集合可读可写
- 用例对象使用 tc-e2e-gray-create- 前缀，finally 无条件删除

## 测试步骤

1. 用 API 读取 default 项目的 Deployment 列表与 strategies 当前条数
2. 打开灰度发布页，点「创建灰度发布」
3. 填写唯一名称，选择第一个 Deployment 与类型 Canary，点「下一步」
4. 此时用 API 回读该名称应为 404，且页面尚未发出 POST
5. 在确认面板点「确认创建」，轮询 API 直到对象出现
6. 核对 spec.type/selector.matchLabels.app/template.spec.hosts 与所选 Deployment 一致
7. 核对页面成功提示与列表行（类型显示金丝雀发布）
8. finally 删除对象，轮询到 404，并核对 strategies 计数回到创建前、无本前缀残留

## 期望结果

- 点「下一步」不产生写请求；对象在确认前不存在
- 确认后对象存在且字段与选择一致，列表行可见
- 删除后回读 404，计数回创建前；无残留

## 失败排查

- 创建按钮不可见：列表是否处于 error/loading，或 registry 未 ready
- 确认后 409：名称已被占用（换唯一后缀）
- 回读 selector/hosts 为空：检查 Deployment 是否有 app 标签及向导 manifest
- 列表不出现新行：确认成功后是否 invalidate ['strategies',cluster,namespace]
- 计数未回零：finally 的 DELETE 是否执行/对象名是否一致

## 产品改版后如何更新自动化

- 向导句柄与字段变化时同步本用例
