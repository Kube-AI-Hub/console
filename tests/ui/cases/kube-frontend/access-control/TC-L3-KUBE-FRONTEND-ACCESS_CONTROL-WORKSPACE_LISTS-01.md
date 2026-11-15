# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01 企业空间控制台列表刷新与空态出口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-lists`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/projects`
- **需求**: `prd/kube-frontend/access-control/workspace-lists.md`

## 产品功能

企业空间控制台的角色、项目、配额三个列表都提供刷新按钮与空态出口。

### 关联需求

- `prd/kube-frontend/access-control/workspace-lists.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-lists.md`](../../../../prd/kube-frontend/access-control/workspace-lists.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_LISTS-01** — 已知企业空间控制台的角色、项目、配额三个列表均已加载，则每个列表都显示「刷新」按钮且空闲时可用；当点击项目列表的「刷新」，则重新发起该项目集合请求（请求带 `labelSelector` 的命名空间列表）；刷新期间按钮显示忙碌状态并在请求返回后恢复可用；三个列表的刷新句柄分别为 `workspace-roles:refresh`、`workspace-projects:refresh`、`workspace-quota:refresh`。这三个列表没有搜索框，因此其空态只提供「刷新」出口（带搜索的列表另由所属页族的用例覆盖「清空搜索与筛选」）。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-lists.md`](../../../../design/kube-frontend/access-control/workspace-lists.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-lists.md`](../../../../prd/kube-frontend/access-control/workspace-lists.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 主动重读当前列表 (Priority: P1)

作为 **企业空间管理员**，我希望 **在角色/项目/配额列表上直接刷新**，以便 **不必关掉页面重进才知道刚刚的变更是否生效**。

**Independent Test**：打开企业空间的项目列表，在别处新建一个项目后点击列表上的「刷新」，新行出现；搜索一个不存在的名称使列表进入空态，空态给出「清空搜索与筛选」与「刷新」两个出口。

## 前置与配置

- 已登录且有企业空间管理员权限

## 测试步骤

1. 打开企业空间的项目列表，确认「刷新」按钮
2. 在别处（API）新建一个项目，点击刷新
3. 观察刷新期间按钮的忙碌状态
4. 依次打开角色与配额列表，确认各自的刷新句柄

## 期望结果

- 刷新只重发当前查询，保留搜索与页码

## 失败排查

- 按钮不出现：schema.refresh 或 onRefresh 缺一
- 刷新后仍看不到：dist 未重新构建

## 产品改版后如何更新自动化

- 选择器：workspace-roles:refresh / workspace-projects:refresh / workspace-quota:refresh
