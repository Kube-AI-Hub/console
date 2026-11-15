# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02 灰度发布 · 创建向导（初始流量与三种类型的 manifest、确认后写入、finally 清理）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

创建向导采集名称、目标 Deployment、类型与初始流量；点下一步只做本地校验并展示确认摘要（含初始流量），点确认后才 POST Strategy。Canary 按 100-w/w 写两条权重与 governor；Bluegreen 写 100/0 且 governor 为参考版本；Mirror 写参考版本 100% 加 mirror 到新版本。成功后关闭弹窗、列表出现该行；finally 删除并核对计数回创建前。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-02** — 已知项目内有至少一个 Deployment，当在灰度发布页点「创建灰度发布」，填写合法名称、选择该 Deployment、类型 Canary 与初始流量 25 并点「下一步」，则在点「确认创建」之前不产生任何写请求；确认后项目命名空间下出现对应 `Strategy`，其 `spec.type`、`spec.selector.matchLabels.app`、`spec.template.spec.hosts[0]` 与所选 Deployment 一致，两条路由权重为 75/25 且 `spec.governor` 为空；类型 Bluegreen 创建出 100/0 权重且 governor 为参考版本，Mirror 创建出参考版本 100% 加 `mirror` 到新版本；列表刷新后出现该行（状态为进行中/未知之一）；创建失败（名称冲突/权限/非法字段）时确认弹窗内显示服务端原因且不关闭；用例 finally 删除该对象。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 不用写 YAML 就能起一个灰度发布并指定初始流量 (Priority: P1)

作为 **项目运维**，我希望 **在列表上填写名称、选一个 Deployment、选择发布类型并给出初始流量比例，确认后创建 Strategy**，以便 **创建出的策略一开始就按我指定的比例分流，而不是先创建再改一次**。

**Independent Test**：点「创建灰度发布」，填名称、选项目内 Deployment、类型 Canary、初始流量 25，下一步确认后创建；API 回读到两版本权重 75/25、`spec.governor` 为空，列表刷新出现该行。

## 前置与配置

- 已登录，host 集群 default 项目，servicemesh 已启用
- 项目内至少一个 Deployment；strategies 集合可读可写
- 用例对象使用 tc-e2e-gray-create- 前缀，finally 无条件删除

## 测试步骤

1. 用 API 读取 default 项目的 Deployment 列表与 strategies 当前条数
2. 打开灰度发布页，点「创建灰度发布」
3. 填唯一名称、选择第一个 Deployment、类型 Canary、初始流量 25，点「下一步」
4. 此时用 API 回读该名称应为 404，且页面尚未发出 POST
5. 点「确认创建」，轮询 API 直到对象出现，核对类型/选择器/host/权重 75/25/governor 为空
6. 再次创建 Bluegreen 与 Mirror，核对权重 100/0 与 mirror 字段、governor 为参考版本
7. 核对页面成功提示与列表行；finally 删除三个对象并核对计数回创建前

## 期望结果

- 点「下一步」不产生写请求；对象在确认前不存在
- Canary 对象两条路由权重为 75/25 且 spec.governor 为空
- Bluegreen 对象权重为 100/0 且 spec.governor 等于参考版本
- Mirror 对象第一条路由为参考版本 100% 且存在 mirror 目标
- 列表出现对应的行；删除后回读 404、计数回创建前、无本前缀残留

## 失败排查

- 创建按钮不可见：列表是否处于 error/loading，或权限检查明确拒绝
- 确认后 409：名称已被占用（换唯一后缀）
- 权重不是 75/25：检查向导是否把初始流量写进 manifest
- 计数未回零：finally 的 DELETE 是否执行/对象名是否一致

## 产品改版后如何更新自动化

- 向导句柄与初始流量字段变化时同步本用例
