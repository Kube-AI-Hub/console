# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02 项目基本信息 · 成员/角色/服务账号统计

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `baseinfo`
- **入口**: `{BASE_URL}/kube-frontend/public/clusters/host/projects/default/baseinfo`
- **需求**: `prd/kube-frontend/project-settings/baseinfo-stats.md`

## 产品功能

项目基本信息页新增统计区：成员数/角色数/服务账号数三张卡，数字来自对应列表接口的 totalItems。

### 关联需求

- `prd/kube-frontend/project-settings/baseinfo-stats.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/baseinfo-stats.md`](../../../../prd/kube-frontend/project-settings/baseinfo-stats.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASEINFO-02** — 已知项目 `<ns>` 的成员/角色/服务账号列表总数为 M/R/S（可能为 0），当打开项目基本信息页，则统计区三张卡分别显示 M/R/S；任一接口失败时该卡显示 `-` 而不是 0；加载中显示占位而不是数字。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/baseinfo-stats.md`](../../../../design/kube-frontend/project-settings/baseinfo-stats.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/baseinfo-stats.md`](../../../../prd/kube-frontend/project-settings/baseinfo-stats.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 项目管理员一眼看到项目规模 (Priority: P1)

作为 **项目管理员**，我希望 **在基本信息页看到成员/角色/服务账号数量**，以便 **快速判断项目的人员与权限对象规模**。

**Independent Test**：打开项目基本信息页，三个数字与对应列表接口的 `totalItems` 一致；接口失败时显示 `-`。

## 前置与配置

- 已登录，且能看到 default 项目
- 项目成员/角色/服务账号列表接口可读

## 测试步骤

1. 用 API 读 /kapis/iam.kubesphere.io/v1alpha2/namespaces/default/members?limit=1 的 totalItems
2. 用 API 读同前缀 roles?limit=1 的 totalItems
3. 用 API 读 /kapis/resources.kubesphere.io/v1alpha3/namespaces/default/serviceaccounts?limit=1 的 totalItems
4. 打开 default 项目基本信息页，等待 surface 离开 loading
5. 核对统计区三张卡的数字

## 期望结果

- settings-baseinfo:stats 区块可见
- settings-baseinfo:stat:members/roles/serviceaccounts 三卡分别显示接口 totalItems
- 失败时该卡显示 -（正常环境不触发，作为契约记录）

## 失败排查

- 卡片数字恒 0：用了 items.length（pageSize=1）而不是 totalItems
- 页面 dt 列表变化：统计卡误用了 <dt>，会破坏既有 base-info 属性断言
- 服务账号卡读不到：该资源走资源代理而不是 IAM

## 产品改版后如何更新自动化

- 选择器：settings-baseinfo:stats / :stat:members|roles|serviceaccounts
