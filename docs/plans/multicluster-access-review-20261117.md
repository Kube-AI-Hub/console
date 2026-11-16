# 成员集群的权限自检落在哪个集群（2026-11-17）

## 1. 发现

`packages/api-client/src/permissions.ts` 的 `accessReviewApi.allowed()` 把
`SelfSubjectAccessReview` POST 到写死的 `/apis/authorization.k8s.io/v1/selfsubjectaccessreviews`——
**没有集群段**。也就是说：在成员集群的页面上，权限问题的答案来自**主集群**。

后果：控制台可能显示一个在 `xc` 上根本不允许的「创建」按钮（或反过来隐藏一个允许的），
读者点下去才被 apiserver 拒绝。这类「先给希望再拒绝」比直接不显示更糟。

## 2. 实测（A100）

| 路径 | 结果 |
| --- | --- |
| `/apis/authorization.k8s.io/v1/selfsubjectaccessreviews`（host） | **201**，`allowed=true` |
| `/apis/clusters/xc/authorization.k8s.io/v1/selfsubjectaccessreviews` | **201**，`allowed=true` |
| `/apis/authorization.k8s.io/v1/clusters/xc/selfsubjectaccessreviews`（错误位置） | 404 |

成员集群**支持**自检，位置与其它分组资源一致（`clusters/<id>` 在 group 之前）。

## 3. 修复

`AccessQuery` 增加可选 `cluster`，路径改用 `clusterScoped`；两个调用方（`GatewayPage`、`ClusterGatewaysPage`）
把当前集群传进去。

```ts
clusterScoped('/apis/authorization.k8s.io/v1', params.cluster, 'selfsubjectaccessreviews')
```

不传 `cluster` 时行为与原来一致（host 路径），所以其它尚未接入的调用方不会突然坏掉。

验证：api-client **37 文件 / 384 passed**；`tsc` 在这两个文件上 0 错误。

## 4. 未完成的验证（重要）

修完之后**无法在 UI 上复验**：本轮末尾 A100 与 B200 两套本地栈的所有列表页都返回 `error`，
且**没有任何失败请求**、没有 pageerror —— 是前端在渲染阶段抛错。

| 页面 | 状态 |
| --- | --- |
| `/clusters/host/pods` | error |
| `/clusters/xc/pods` | error |
| `/public/clusters/xc/projects/spaces/configmaps` | error |
| `/clusters/xc/nodes` | error |
| `/clusters/xc/overview` | 无 surface（整页未渲染） |

两个集群同时坏、且与接口无关，说明是**并行线正在改的共享组件**（本轮其提交 `a512e708c` 动了集群概览与 kubectl），
不是多集群路径问题。**等并行线收敛后再复验**，届时用 `--baseline` 一次跑完即可。

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **权限自检也是集群相关的**：写死的 host 路径会让按钮与真实权限不一致 |
| 2 | **全部页面同时坏、且无失败请求 = 前端渲染阶段抛错**，先查共享组件，别查接口 |
| 3 | 并行线正在大改时，**验证要挑不依赖它的目标**（本轮改为先修并单测权限路径） |
