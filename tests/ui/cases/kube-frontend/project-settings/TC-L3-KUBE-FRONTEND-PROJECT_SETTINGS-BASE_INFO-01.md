# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01 项目基本信息 · 属性与配额空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `base-info`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/spaces/baseinfo`
- **需求**: `prd/kube-frontend/project-settings/base-info.md`

## 产品功能

基本信息页显示项目六项属性，企业空间与项目列表一致；没有配额时给出明确说明。

### 关联需求

- `prd/kube-frontend/project-settings/base-info.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/base-info.md`](../../../../prd/kube-frontend/project-settings/base-info.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-01** — 已知项目存在，当打开基本信息页，则显示名称、别名、企业空间、描述、创建者、创建时间六项属性，且企业空间与企业空间标签一致。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-BASE_INFO-02** — 已知项目没有 ResourceQuota，当打开基本信息页，则配额区显示「该项目没有设置资源配额」，而不是空白或错误。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/base-info.md`](../../../../design/kube-frontend/project-settings/base-info.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/base-info.md`](../../../../prd/kube-frontend/project-settings/base-info.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认项目的归属与配额 (Priority: P1)

作为 **项目管理员**，我希望 **看到项目属于哪个企业空间、有没有配额**，以便 **判断资源上限从哪来**。

**Independent Test**：打开 `…/projects/spaces/baseinfo`，核对企业空间与项目列表页一致。

## 前置与配置

- 已登录，且在 host 集群的 spaces 项目空间
- 用 API 确认该项目是否存在 ResourceQuota，用例据此断言配额区块的两种形态

## 测试步骤

1. 打开基本信息页
2. 读取属性名序列与企业空间的值
3. 读取配额区的内容

## 期望结果

- 属性名依次为 名称、别名、租户(企业空间)、描述、创建者、创建时间
- 企业空间与 API 的 kubesphere.io/workspace 标签一致
- 有配额时显示三列表；无配额时显示「该项目没有设置资源配额」

## 失败排查

- 企业空间显示成项目名说明取错了标签（kubesphere.io/namespace）
- 整页报错说明配额请求失败被当成了致命错误

## 产品改版后如何更新自动化

- 属性变化时同步改 prd 与 design 的字段表
