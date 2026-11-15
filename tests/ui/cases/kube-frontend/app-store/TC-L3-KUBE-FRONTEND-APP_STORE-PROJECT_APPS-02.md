# TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02 项目内应用 · 安装（目标锁定 + values）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `project-apps`
- **入口**: `{BASE_URL}/kube-frontend/{WORKSPACE}/clusters/{CLUSTER}/projects/default/applications`
- **需求**: `prd/kube-frontend/app-store/project-apps.md`

## 产品功能

项目页安装：选择应用 → 目标锁定的安装弹窗 → 提交后行出现且接口回读一致。

### 关联需求

- `prd/kube-frontend/app-store/project-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/project-apps.md`](../../../../prd/kube-frontend/app-store/project-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-PROJECT_APPS-02** — 当点主操作「安装应用」，则弹出应用选择列表（可按名称搜索，数据来自 `/kapis/openpitrix.io/v1/apps`）；选中一个应用后进入安装弹窗，工作空间与项目两栏预填为当前上下文且**不可修改**，可选择版本、编辑 values、填 release 名称；提交发出 `POST /kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications`（`conf` 为 YAML 字符串），成功后弹窗显示 release 名并提供回本页的链接，列表重新读取后出现该行；名称为空/非法、版本缺失、release 重名时在本地拒绝且不发请求。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/project-apps.md`](../../../../design/kube-frontend/app-store/project-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/project-apps.md`](../../../../prd/kube-frontend/app-store/project-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 从应用商店往本项目安装应用 (Priority: P1)

作为项目使用者，我不离开项目就能挑一个商店应用装到当前项目，安装时能看到并修改 values，安装完成后在本页看到新行。

## 前置与配置

- 商店 /kapis/openpitrix.io/v1/apps 至少有一个带版本的 app

## 测试步骤

1. 打开项目应用页，点 installed-apps:install
2. 在 installed-apps:pick 里搜索并选一个应用
3. 核对安装弹窗的工作空间/项目下拉预填且 disabled
4. 填唯一 release 名并提交；等待行出现；读项目集合核对

## 期望结果

- 安装请求 POST 到项目集合且 body 含 app_id/version_id/name/conf(YAML 字符串)
- 成功后列表出现该行；接口回读同名的 release 且 project=<ns>
- 工作空间/项目下拉为 disabled

## 失败排查

- 弹窗要求再选项目：lockedProject 没生效
- conf 传对象：服务端 unmarshal 报错

## 产品改版后如何更新自动化

- 句柄：installed-apps:install / :pick / :pick-search / :pick-app:<id> / app-detail:install-dialog / :install-workspace / :install-project / :install-submit
