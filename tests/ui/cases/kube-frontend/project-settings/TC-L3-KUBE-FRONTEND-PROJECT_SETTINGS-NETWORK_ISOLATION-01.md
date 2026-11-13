# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01 网络隔离 · 策略列表与隔离开关

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `network-isolation`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/spaces/networkpolicies`
- **需求**: `prd/kube-frontend/project-settings/network-isolation.md`

## 产品功能

网络隔离页显示策略四列与项目级开关；开关写入命名空间注解并可还原。

### 关联需求

- `prd/kube-frontend/project-settings/network-isolation.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-01** — 已知项目内有多条网络策略，当打开网络隔离页，则显示名称（副行为 Pod 选择器）、策略类型、规则数、创建时间四列，且行数与 API 返回一致。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-NETWORK_ISOLATION-02** — 已知开关处于关闭状态，当打开开关，则命名空间的 `kubesphere.io/network-isolate` 注解变为 `true`；当再次关闭，则变回 `false`。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/network-isolation.md`](../../../../design/kube-frontend/project-settings/network-isolation.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/network-isolation.md`](../../../../prd/kube-frontend/project-settings/network-isolation.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认项目流量是否被限制、被什么限制 (Priority: P1)

作为 **项目管理员**，我希望 **在一个页面看到隔离开关和具体策略**，以便 **判断某条流量为什么通或不通**。

**Independent Test**：打开网络隔离页，核对开关状态与命名空间注解一致，策略数与 API 一致。

## 前置与配置

- 已登录，且在 host 集群的 spaces 项目空间（该项目有多条网络策略）
- 用例结束时把隔离开关恢复为用例开始前的状态

## 测试步骤

1. 用 API 读取策略数量与隔离开关初值
2. 打开网络隔离页，核对列与行数
3. 打开或关闭开关，用 API 核对注解
4. 还原开关

## 期望结果

- 表头依次为 名称、策略类型、规则数、创建时间
- 列表行数与 API 返回一致
- 开关状态与 kubesphere.io/network-isolate 注解一致

## 失败排查

- 行数不符时看是否有分页（每页 10 条）
- 注解未变化时确认写的是 merge patch 到核心组

## 产品改版后如何更新自动化

- 列变化时改 pages/project_settings.py
