# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06 灰度发布 · 暂停/恢复（governor 接管与还原权重）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

暂停发布把流量全部交给参考版本（spec.governor 等于参考版本）并保留权重；恢复发布清空 governor，恢复暂停前的权重比例。按钮文案随 governor 切换，页面给出已暂停/已恢复提示。按内容分流的 Canary 同样支持暂停/恢复且匹配规则不变。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-06** — 已知一个按权重分流的 Canary 详情（权重 65/35、`spec.governor` 为空），当点「暂停发布」，则回读 `spec.governor` 等于参考版本且两条权重仍为 65/35、按钮变为「恢复发布」并显示已暂停说明；当再点「恢复发布」，则回读 `spec.governor` 为空、权重仍为 65/35 且按钮变回「暂停发布」；按内容分流的 Canary 同样支持暂停/恢复，恢复后匹配规则不变。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 调整流量比例，并能暂停/恢复一次发布 (Priority: P1)

作为 **项目运维**，我希望 **在详情里把新版本流量调到指定比例、把某个版本接管为 100%，并在需要时暂停发布（流量全部回到参考版本）后再恢复原来的比例**，以便 **按发布节奏逐步放量、出问题时立刻回退且不丢失原配置**。

**Independent Test**：在流量 20% 的 Canary 详情里调整到 35，保存后 API 回读权重为 65/35 且 `spec.governor` 为空；点「暂停发布」后回读 `spec.governor` 等于参考版本且权重不变；点「恢复发布」后 `spec.governor` 为空、权重仍是 65/35。

## 前置与配置

- 已登录，host 集群 default 项目，servicemesh 可读写
- 用例创建按权重 Canary（65/35、governor 空）与按内容 Canary 各一条
- 用例对象使用 tc-e2e-gray- 前缀，finally 删除

## 测试步骤

1. 打开按权重 Canary 详情，点「暂停发布」，轮询回读 governor 与权重
2. 断言按钮变为「恢复发布」并显示已暂停提示
3. 点「恢复发布」，轮询回读 governor 与权重
4. 打开按内容 Canary 详情，依次暂停与恢复，回读 governor 与匹配规则

## 期望结果

- 暂停后 spec.governor 等于参考版本且两条权重仍为 65/35
- 恢复后 spec.governor 为空且权重仍为 65/35
- 按钮文案在暂停后变为「恢复发布」、恢复后变回「暂停发布」
- 内容分流策略暂停后 governor 等于参考版本、恢复后为空，匹配规则不变

## 失败排查

- 暂停后权重被改成 0/100：暂停写的是权重，不是 governor
- 恢复后权重不是 65/35：暂停时是否覆盖了权重
- 按钮不切换：页面是否在写成功后重新读取对象

## 产品改版后如何更新自动化

- 暂停/恢复见 pausedStrategy/resumedStrategy；按钮句柄见 CanaryDetailPage
