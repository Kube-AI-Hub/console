# TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02 应用详情 · 安装弹窗的 values 配置

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `detail`
- **入口**: `{BASE_URL}/kube-frontend/apps`
- **需求**: `prd/kube-frontend/app-store/detail.md`

## 产品功能

安装弹窗按所选版本的 values.yaml 预填配置，conf 以 YAML 文本提交，可恢复默认、可留空用 chart 默认值。

### 关联需求

- `prd/kube-frontend/app-store/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-02** — 已知某版本 chart 带 values.yaml，当打开安装弹窗，则 values 编辑框预填该文件内容（`GET …/versions/<versionId>/files` 的 `values.yaml` 解码）；点「恢复默认」把编辑框还原为该文件内容；清空编辑框后提交，请求体不含 `conf`（使用 chart 默认值）；修改后提交，请求体的 `conf` 是编辑框里的 YAML 文本（不是对象）；读取 values.yaml 失败时提示「读取 values.yaml 失败，可手工填写或留空使用默认值」但仍可提交；切换版本后编辑框回到新版本的 values.yaml（不保留上一个版本的编辑）。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/detail.md`](../../../../design/kube-frontend/app-store/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 安装时按 chart 默认值调整配置 (Priority: P1)

作为 **平台用户**，我希望 **在安装弹窗里看到并修改该版本的 values.yaml 再提交**，以便 **不必先装一遍再用别的方式改配置**。
release 的 `spec.values` 解码后与提交内容一致；点「恢复默认」回到 chart 原值；留空提交则 `spec.values` 为空（使用 chart 默认值）。

**Independent Test**：打开任一应用详情的安装弹窗，配置框已预填该版本 chart 的 values.yaml；修改一个键后提交，

## 前置与配置

- 已登录；商店有带版本的应用（GET /kapis/openpitrix.io/v1/apps）
- 只读用例：打开与取消不产生写请求（真实安装见 INSTALLED_APPS-02）

## 测试步骤

1. 打开一个应用详情，点安装
2. 读取配置框内容，与 GET …/versions/<versionId>/files 的 values.yaml 解码结果比对
3. 修改配置框中的一个键，点「恢复默认」，核对内容回到 values.yaml
4. 清空配置框，核对提示与确认按钮仍可用（不提交）
5. 关闭弹窗

## 期望结果

- 配置框预填该版本 values.yaml（含 chart 注释与键）
- 「恢复默认」把编辑框还原为 values.yaml
- 清空后提示使用 chart 默认值；弹窗不因配置为空而禁用确认
- 打开/取消全程无 POST 写请求

## 失败排查

- 配置框为空：files 端点失败或版本 id 为空；核对 GET …/versions/<id>/files
- conf 提交成对象会 400：conf 必须是 YAML 字符串

## 产品改版后如何更新自动化

- 句柄：app-detail:install / :install-values / :install-values-reset / :install-version
