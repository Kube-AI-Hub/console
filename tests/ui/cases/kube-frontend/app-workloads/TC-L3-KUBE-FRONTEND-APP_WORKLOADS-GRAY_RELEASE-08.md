# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08 灰度发布 · 权限门控（SSAR 允许/拒绝与 fail-open）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `gray-release`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/grayrelease`
- **需求**: `prd/kube-frontend/app-workloads/gray-release.md`

## 产品功能

创建与删除入口由 SelfSubjectAccessReview 决定：页面为 servicemesh.kubesphere.io 组 strategies 资源发出 create/delete 检查；当前 admin 身份下创建按钮可用、详情删除入口可见；拦截检查返回 allowed=false 时创建按钮禁用并显示原因、删除入口不渲染；解除拦截后恢复可用（fail-open）。

### 关联需求

- `prd/kube-frontend/app-workloads/gray-release.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-08** — 已知当前身份对 strategies 有 create/delete 权限，则列表创建入口与详情删除入口可见可用，且页面发出对 `servicemesh.kubesphere.io` 组 `strategies` 资源的权限检查（ks-apiserver IAM，以请求用户求值；旧后端回退 `SelfSubjectAccessReview`；create/delete）；当权限检查明确返回 `allowed=false` 时，创建按钮禁用并显示「没有创建灰度发布的权限」、删除入口不渲染；当权限检查失败或未返回时保持可用（fail-open），不因检查失败禁用写入口。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/gray-release.md`](../../../../design/kube-frontend/app-workloads/gray-release.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/gray-release.md`](../../../../prd/kube-frontend/app-workloads/gray-release.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 没有写权限时不被给出无效入口 (Priority: P2)

作为 **受限项目成员**，我希望 **没有创建/删除灰度发布权限时，创建按钮禁用并说明原因、删除入口不出现**，以便 **不会点开一个必然失败的写操作**。

**Independent Test**：拦截权限检查返回 `allowed=false` 时，列表创建按钮禁用并显示原因、详情删除入口不出现；权限检查失败时保持可用（fail-open），不因为一次检查错误拿走已有权限。

## 前置与配置

- 已登录且当前身份对 default 项目的 strategies 有 create/delete 权限（B200 admin）
- 项目内存在一条 tc-e2e-gray- 前缀的 Canary 策略
- 用例对象 finally 删除

## 测试步骤

1. 监听页面请求，打开灰度发布页，断言发生 selfsubjectaccessreviews 调用
2. 断言创建按钮可用
3. 进入策略详情，断言删除入口可见
4. 用 page.route 拦截 selfsubjectaccessreviews 返回 status.allowed=false，重新打开列表
5. 断言创建按钮禁用并显示权限原因；进入详情断言删除入口不出现
6. 解除拦截，重新打开列表与详情，断言入口恢复

## 期望结果

- 页面发出 POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews（verb create 与 delete）
- 允许时 grayrelease:create 可用、grayrelease-detail:delete 可见
- 拒绝时创建按钮 disabled 且页面出现「没有创建灰度发布的权限」，详情没有 grayrelease-detail:delete
- 解除拦截后两个入口恢复可用

## 失败排查

- 没有 SSAR 请求：页面是否在加载后立即渲染权限查询（enabled 依赖 cluster/namespace）
- 拦截不生效：请求会经 BFF 转发，page.route 需匹配 **/selfsubjectaccessreviews
- 按钮仍可见：确认返回体是 {status:{allowed:false}} 形状

## 产品改版后如何更新自动化

- 权限 hook 见 pages/app-workloads/canary/useStrategyPermission.ts
