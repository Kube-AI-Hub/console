# TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01 项目设置 · 角色与成员切换不刷新

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `project-settings` `page`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/_index.md`

## 产品功能

['项', '目', '角', '色', '与', '项', '目', '成', '员', '在', '同', '一', '个', '功', '能', '区', '，', '切', '换', '是', '客', '户', '端', '跳', '转', '。']

### 关联需求

- `prd/kube-frontend/project-settings/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/_index.md`](../../../../prd/kube-frontend/project-settings/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-PROJECT_SETTINGS-01** — 已知已登录且有项目权限，当在六个页签之间切换，则每次都显示对应页面或其空态，页签高亮跟随，且切换不产生文档请求。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/_index.md`](../../../../design/kube-frontend/project-settings/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/_index.md`](../../../../prd/kube-frontend/project-settings/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在一个功能区里完成项目配置 (Priority: P1)

作为 **项目管理员**，我希望 **项目的权限与运行配置都在同一排页签里**，以便 **不必为了开个日志收集去另一个菜单找**。

**Independent Test**：在六个页签之间依次切换，每次显示对应页面（或空态），页签高亮跟随，切换不产生文档请求。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开项目角色页
2. 切到项目成员页签
3. 再切回项目角色
4. 统计切换期间的文档请求

## 期望结果

- 两个页面各自出现列表或空态
- 切换后对应页签高亮
- 切换期间文档请求为 0

## 失败排查

- 出现文档请求说明页签退化成整页跳转

## 产品改版后如何更新自动化

- 页签结构变化时改 pages/project_settings.py
