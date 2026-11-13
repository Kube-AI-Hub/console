# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01 项目成员 · 列表四列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `members`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/spaces/members`
- **需求**: `prd/kube-frontend/project-settings/members.md`

## 产品功能

['成', '员', '列', '表', '显', '示', '名', '称', '、', '状', '态', '、', '角', '色', '、', '最', '近', '活', '动', '，', '角', '色', '与', '注', '解', '一', '致', '。']

### 关联需求

- `prd/kube-frontend/project-settings/members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/members.md`](../../../../prd/kube-frontend/project-settings/members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-01** — 已知项目内有成员，当打开成员列表，则显示名称、状态、角色、最近活动四列。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/members.md`](../../../../design/kube-frontend/project-settings/members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/members.md`](../../../../prd/kube-frontend/project-settings/members.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁在这个项目里、是什么角色 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到每个成员的角色与状态**，以便 **确认访问范围**。

**Independent Test**：打开成员列表，核对列与某个成员的 `iam.kubesphere.io/role` 注解一致。

## 前置与配置

- 已登录，且在 host 集群的 spaces 项目空间（该项目有一个成员）
- 先用 API 确认该项目确实有成员

## 测试步骤

1. 打开项目成员页
2. 核对表头
3. 核对第一行的角色与 API 的 iam.kubesphere.io/role 注解一致

## 期望结果

- 表头依次为 名称、状态、角色、最近活动
- 角色列等于注解值
- 状态为 活跃 或 未激活

## 失败排查

- 没有成员时用例按 skip 处理而不是失败
- 角色为空说明读错了注解位置

## 产品改版后如何更新自动化

- 成员列变化时改 pages/project_settings.py
