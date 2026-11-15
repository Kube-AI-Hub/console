# TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01 应用安装 · 企业空间/项目/版本/名称 → 创建 release（结果清理）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `install`
- **入口**: `{BASE_URL}/kube-frontend/apps`
- **需求**: `prd/kube-frontend/app-store/detail.md`

## 产品功能

应用详情页的安装入口：弹窗选择企业空间（tenant workspaces）、项目（该空间的 namespace）、版本与安装名称，POST 项目级 applications 创建 openpitrix release；成功显示已提交与跳转入口；同名在客户端拦截；失败显示服务端原因。用例结束必须按 release id 删除，环境无 tc-e2e 残留。

### 关联需求

- `prd/kube-frontend/app-store/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-INSTALL-01** — 已知商店里有带版本的应用、且目标企业空间有项目，当在详情点安装，则弹窗提供企业空间（tenant workspaces）、项目（该空间的命名空间）、版本（该应用的版本）、安装名称与 values 配置；提交合法值时向 `/kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications` 发送 `{app_id, version_id, name, conf}`（`conf` 为 **YAML 字符串**），成功后弹窗显示「已提交安装：<name>」与跳转该企业空间已安装应用列表的入口；提交同名（项目内已有该 release 名）时不发请求并提示「该项目内已有同名安装」；服务端失败时弹窗显示服务端原因（错误文案，不伪造成功）；名称为空/非法、项目或版本缺失时不发请求并提示对应字段。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/detail.md`](../../../../design/kube-frontend/app-store/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 从详情把应用安装到企业空间的项目 (Priority: P1)

作为 **企业空间用户**，我希望 **在详情里选择企业空间、项目、版本与安装名称，然后提交安装**，以便 **不用切换旧控制台就能把商店应用装进项目并看到结果**。

**Independent Test**：打开任一应用详情，点安装，选择企业空间与项目、版本，填写名称并提交；确认接口返回成功、弹窗显示安装已提交与查看入口；再次提交同名会得到「同名」提示；失败（如版本不存在/权限不足）时弹窗显示服务端原因。

## 前置与配置

- 已登录；B200 组件开启、写接口可用（ks-controller-manager Ready）
- 商店至少一个带 active 版本的应用；至少一个企业空间含项目
- 用例自行创建 release 并在 finally 删除，不使用固定名称

## 测试步骤

1. 用 API 读 tenant workspaces 与每个空间的 namespaces，选一组（企业空间，项目）
2. 用 API 读商店应用与版本，选一个带 active 版本的应用
3. 打开 /kube-frontend/apps/<app_id>，等详情 ready
4. 点安装（app-detail:install），等弹窗出现
5. 选择企业空间与项目（下拉），确认版本已默认最新，填写唯一安装名称 tc-e2e-install-<rand>
6. 点确认（app-detail:install-submit），等成功块或错误块
7. 断言成功文案含安装名称；API 轮询该项目 applications，找到 cluster.name = 安装名称的 release
8. 再次打开安装弹窗，填同名并提交，断言出现「同名」错误且未新增第二个 release
9. finally：按 release 的 cluster_id DELETE，轮询直到列表无该名字；再断言该项目无 tc-e2e-install- 前缀残留

## 期望结果

- 弹窗包含企业空间/项目/版本/安装名称四个控件，确认按钮可用
- 提交后 app-detail:install-success 可见，文案含安装名称；页面对 openpitrix 只有一次 POST（创建）
- 项目 applications 列表出现 cluster.name 等于安装名称的行（状态可能是 active/failed，属异步结果，不影响「已创建」断言）
- 第二次同名提交显示同名提示且不产生第二个 release
- 清理后该项目 applications 中不存在该 release，也无 tc-e2e-install- 前缀残留

## 失败排查

- 弹窗里项目为空：该企业空间没有项目；换一个有项目的空间（public/spaces 当前可用）
- 提交 500：看弹窗错误文案；常见是版本 id 失效（重新取版本）或 release 名重复（客户端应已拦截）
- 成功后查不到 release：确认用的是项目级 applications 路径，且按 cluster.name 而不是 item.name 匹配（item.name 是 chart 名）
- 清理不干净：DELETE 必须用 cluster.cluster_id；按 release 名删除返回 200 但不生效
- chart 最终 failed：不算安装接口失败；本用例只断言 release 行存在，最终状态由异步 chart 决定

## 产品改版后如何更新自动化

- 选择器：app-detail:install、install-dialog、install-workspace/project/version/name、install-submit、install-cancel、install-success、install-success-link、install-error；API：/kapis/openpitrix.io/v1/workspaces/<ws>/namespaces/<ns>/applications
- 清理：DELETE .../applications/<cluster_id>（finally 必须执行）
