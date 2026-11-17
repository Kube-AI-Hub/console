# 权限检查后端（ks-apiserver IAM，2026-11-17）

> 非 admin 验收时发现的真实缺陷：控制台用 `/apis/authorization.k8s.io/v1/selfsubjectaccessreviews` 判断按钮权限，而该请求经 ks-apiserver 代理到 kube-apiserver 时以 **ks-apiserver 的 ServiceAccount（cluster-admin）** 身份求值，导致所有 SSAR 都返回 allowed。控制台按钮因此对只读用户也显示可写。

## 1. 复现与证据

- 在 BFF 指向的集群创建临时用户 `e2e-viewer-*`（`spec.password`，项目 default 绑定内置 `viewer`），登录成功。
- 以该用户 POST kube SSAR（create deployments/apps）得到：

`~json
{"status":{"allowed":true,"reason":"RBAC: allowed by ClusterRoleBinding \"kubesphere\" of ClusterRole \"cluster-admin\" to ServiceAccount \"kubesphere/kubesphere-system\""}}
`~

- 对应 UI：`viewer` 打开 default 项目「部署」页，页面 ready、行可读，**「创建」入口仍可见可点**。
- 结论：这不是某个页面的 gating 漏写，而是**检查通道把用户换成了服务账号**；所有依赖 SSAR 的入口都受影响。

## 2. 修复

### 2.1 后端（kube-server）

新增 `POST /kapis/iam.kubesphere.io/v1alpha2/selfsubjectaccessreviews`：

- body：`{verb, group?, resource, subresource?, namespace?, name?}`；
- 用请求上下文里的用户（`request.UserFrom`）构造 `authorizer.AttributesRecord`，调用 ks-apiserver 的 `Authorizer`；
- 返回 `{allowed, reason}`；verb/resource 缺失 → 400；authorizer 错误 → 500。
- 代码：`kube-server/pkg/kapis/iam/v1alpha2/accessreview.go` + `register.go`；测试 2 条（以请求用户求值、缺字段 400）。

### 2.2 控制台（api-client）

`accessReviewApi` 改为：

1. 先调 IAM 路由（host 或成员集群 `/kapis/clusters/<c>/iam...`），body 为上表；
2. 旧后端没有该路由时回退到原 kube SSAR：go-restful 实际返回 **500 "no matches for iam.kubesphere.io..."**（不是 404），所以回退条件覆盖 404/405 与该 500 文案；
3. 缺字段按 false；调用方仍可 fail-open。

`useCreatePermission` 同时扩展到 deployments/statefulsets/daemonsets/jobs/cronjobs（原来只检查 services/ingresses），所以只读用户看到的创建入口应禁用并显示原因。

## 3. 验证

| 项 | 结果 |
| --- | --- |
| Go 单测 `go test ./pkg/kapis/iam/v1alpha2 -run TestSelfSubjectAccessReview` | **2 passed** |
| api-client `permissions.test.ts` | **5 passed**（IAM 契约、group、缺答案、旧后端 404 回退、go-restful 500 "no matches" 回退） |
| 权限相关 E2E 回归 | GRAY_RELEASE-08 + PROJECT_SETTINGS_GATEWAY-03 + ADD_CLUSTER-05 + WORKSPACE_REPOS-04 + ALERTS_WRITE-02 **5 passed / 60.01s**（旧后端回退后 mock 拒绝仍能禁用/隐藏入口） |
| Viewer UI 复现 | 修复前「创建」可见；修复后需新后端部署才能复测（旧后端走回退，仍是 SA 结果） |
| 写身份 | viewer 直写 kube/kapis generic 均 403，未借用 service account |
| 工作负载创建门控 | mock IAM 返回 allowed=false 后，项目「部署」页创建入口带 disabled 属性，title 为「当前账号在该项目没有创建部署的权限」（截图 permission-review-20261117/new/workload-create-denied.png） |
| 清理 | 临时用户与 RoleBinding 已删除 |

## 4. 部署依赖与边界

- **未部署到当前环境**：现有 ks-apiserver 无 IAM 路由，控制台会走回退；所以本轮只完成代码与单测，viewer 复测要在部署后执行。
- 安全口径：本修复让 UI 的「能不能点」和真实授权一致。**写身份已单独审计**：viewer 对 default 命名空间分别向 `/api/v1/namespaces/default/configmaps` 与 `/kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps` POST，均返回 **403**（kube-apiserver 以 `e2e-viewer-…` 求值），说明写入没有走 service account；错的只有 SSAR 代理这条读路径。
- 回退保留一个过渡窗口；等新后端全部上线后可删除 fallback。

## 5. 后续

| 项 | 状态 |
| --- | --- |
| 部署新 ks-apiserver 后以 `viewer` 重跑：创建入口禁用 + 原因 | 待部署 |
| 非 admin 的详情/写入口全量扫一遍 | 待部署 |
| 审计 kapis generic proxy 的写身份 | **已完成**：viewer 直写 kube 与 kapis generic 均 403，以请求用户求值 |
