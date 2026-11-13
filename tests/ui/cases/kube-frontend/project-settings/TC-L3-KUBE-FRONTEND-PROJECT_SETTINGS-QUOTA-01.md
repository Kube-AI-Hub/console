# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-QUOTA-01 项目配额 · 编辑写入 ResourceQuota

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-QUOTA-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `quota`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/baseinfo`
- **需求**: `prd/kube-frontend/project-settings/base-info.md`

## 产品功能

基本信息页的「编辑配额」写入 ResourceQuota；留空的项不产生限制，非法数量被拦下。

### 关联需求

- `prd/kube-frontend/project-settings/base-info.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/base-info.md`](../../../../prd/kube-frontend/project-settings/base-info.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-03** — 已知项目配额可编辑，当点「编辑配额」填写 requests.cpu=2 与 requests.memory=4Gi 后确认，则存在一个 ResourceQuota，其 `spec.hard` 含这两项，且未填写的项不出现在 `spec.hard` 中。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/base-info.md`](../../../../design/kube-frontend/project-settings/base-info.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/base-info.md`](../../../../prd/kube-frontend/project-settings/base-info.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认项目的归属与配额 (Priority: P1)

作为 **项目管理员**，我希望 **看到项目属于哪个企业空间、有没有配额**，以便 **判断资源上限从哪来**。

**Independent Test**：打开 `…/projects/spaces/baseinfo`，核对企业空间与项目列表页一致。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例结束时删除自己创建的配额对象，恢复原状

## 测试步骤

1. 打开基本信息页并点「编辑配额」
2. 填写非法数量（abc），点确认
3. 改为 requests.cpu=2、requests.memory=4Gi，点确认
4. 用 API 读取 ResourceQuota

## 期望结果

- 非法数量时提交被拦下并提示
- 提交后存在一个 ResourceQuota，其 spec.hard 含 requests.cpu=2 与 requests.memory=4Gi
- 未填写的项不出现在 spec.hard 中（表示不限制）

## 失败排查

- hard 为空时检查表单键是否含点号（会被当成嵌套路径）
- 出现两个配额对象时检查是否复用了已有对象名

## 产品改版后如何更新自动化

- 配额资源增减时改 api-client 的 QUOTA_RESOURCES
