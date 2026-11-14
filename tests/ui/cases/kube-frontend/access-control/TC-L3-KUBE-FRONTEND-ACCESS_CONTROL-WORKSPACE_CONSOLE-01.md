# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01 企业空间控制台 · 概览、项目与成员

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/overview`
- **需求**: `prd/kube-frontend/access-control/workspace-console.md`

## 产品功能

企业空间独立作用域：概览（基本信息+计数）、项目列表、企业空间成员列表。

### 关联需求

- `prd/kube-frontend/access-control/workspace-console.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-01** — 已知企业空间有 N 个项目与 M 个成员，当打开该空间控制台概览页，则显示基本信息（名称/别名/管理员/创建者/创建时间/部署集群）与项目数 N、成员数 M；侧栏有「概览 / 项目 / 企业空间成员」；项目页列出 N 行且名称链到该项目控制台（URL 含 workspace、cluster、project 段）；成员页列出 M 行，含成员名与角色。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-console.md`](../../../../design/kube-frontend/access-control/workspace-console.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员看自己的空间 (Priority: P1)

作为 **企业空间管理员**，我希望 **在一个地方看到这个空间的概览、项目和成员**，以便 **不必绕到平台访问控制里逐项查**。

**Independent Test**：打开 `/workspaces/<ws>/overview`，核对标题是空间别名或名称、项目数与成员数与接口一致；侧栏出现「概览 / 项目 / 企业空间成员」三项。

## 前置与配置

- 已登录，且能看到至少一个企业空间
- 该企业空间至少有一个项目与一个成员

## 测试步骤

1. 用 API 读空间详情、项目列表与成员列表
2. 打开该空间概览页
3. 核对标题、项目计数与成员计数
4. 核对侧栏三项
5. 打开项目页与成员页，核对行数

## 期望结果

- 计数与接口一致
- 侧栏含 概览/项目/企业空间成员
- 项目行数与成员行数与接口一致

## 失败排查

- 侧栏仍是项目菜单：AreaScope 分支没加或 workspacePath 未识别
- 计数为 0：成员接口用了 tenant 路径（返回 404）
- 项目链接 Not Found：cluster 段缺失（应为 placement 首个集群，缺省 host）

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 pages/workspace/*.tsx
