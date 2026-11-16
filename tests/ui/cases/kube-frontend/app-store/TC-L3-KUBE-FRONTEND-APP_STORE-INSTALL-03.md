# TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-03 安装弹窗 · 企业空间与项目的有效组合

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `install`
- **入口**: `{BASE_URL}/kube-frontend/apps/{appId}`
- **需求**: `prd/kube-frontend/app-store/detail.md`

## 产品功能

切换企业空间会立即清空项目并按新空间的项目列表回填首项；没有项目的企业空间保持为空并在提交时本地拦截、提示「请选择项目。」且不发创建请求。

### 关联需求

- `prd/kube-frontend/app-store/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-03** — 已知安装弹窗可切换企业空间，当把企业空间从 A 改为 B，则项目选择立即清空并重新填入 B 的项目列表首项（不会保留 A 的项目）；当 B 没有任何项目时项目选择为空且提交被本地拦截并提示「请选择项目。」，不发出创建请求；当选中的项目不在当前企业空间的项目列表里（例如列表刷新后被移除），同样回落到列表首项而不是带着一个不可安装的组合提交。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/detail.md`](../../../../design/kube-frontend/app-store/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 安装时按 chart 默认值调整配置 (Priority: P1)

作为 **平台用户**，我希望 **在安装弹窗里看到并修改该版本的 values.yaml 再提交**，以便 **不必先装一遍再用别的方式改配置**。
release 的 `spec.values` 解码后与提交内容一致；点「恢复默认」回到 chart 原值；留空提交则 `spec.values` 为空（使用 chart 默认值）。

**Independent Test**：打开任一应用详情的安装弹窗，配置框已预填该版本 chart 的 values.yaml；修改一个键后提交，

## 前置与配置

- 已登录；商店里有带版本的应用；存在一个没有项目的企业空间（本部署为 public）和一个有项目的企业空间

## 测试步骤

1. 打开某应用详情，点安装
2. 若有空间没有项目，选它，核对项目选择为空；填名称后提交
3. 切到有项目的空间，核对项目自动回落到该空间的首个项目
4. 再次切回没有项目的空间，核对项目被清空（不是保留上一个空间的项目）

## 期望结果

- 空间切换后项目立即清空，并在新区间列表就绪后回填首项
- 项目为空时提交被本地拦截，提示「请选择项目。」，且没有任何创建请求
- 项目列表为空的企业空间不会凭空出现项目选项

## 失败排查

- 提交后装进了错误的空间：项目没有随空间重置（保留了上一个空间的项目）
- 提示「请选择项目」但界面上显示有项目：项目不在当前列表里却没有回落

## 产品改版后如何更新自动化

- 句柄：app-detail:install / :install-dialog / :install-workspace / :install-project / :install-name / :install-submit / :install-error
