# 节点加入后端（ks-apiserver / kube-server，2026-11-17）

> N-10 的后端前置与控制台接入。老 console 编辑 KubeKey Cluster CR；本仓库（kube-server）没有 KubeKey 集成，改为在 ks-apiserver 新增 kubeadm join 命令接口。控制台弹窗已接入；当前 B200 后端未部署该接口，E2E 只验证 404/405 的升级提示分支。

## 1. 探测结论

| 探测 | 结果 |
| --- | --- |
| `apis/kubekey.kubesphere.io/v1alpha1`（B200） | 404 |
| 同一组（mlu370） | 404 |
| kube-server 源码 `grep kubekey` | 无任何引用/CRD/控制器 |
| 结论 | 老 KubeKey 向导无法按原样迁移；节点添加需要新的后端契约 |

## 2. 新增接口

```http
POST /kapis/resources.kubesphere.io/v1alpha3/nodes/join-command?ttlHours=24
```

- 权限：按 `create nodes`（`resources.kubesphere.io`）授权，和手工加节点所需权限一致；普通用户 403。
- 参数：`ttlHours` 可选，1–168，默认 24。
- 行为：
  1. 读 `kube-public/cluster-info` 的 kubeconfig → server + CA。
  2. 计算 kubeadm discovery hash：`sha256` over CA DER，格式 `sha256:<hex>`。
  3. 在 `kube-system` 创建 `bootstrap-token-<id>` Secret（type `bootstrap.kubernetes.io/token`，含 token-id/token-secret/expiration/usage-bootstrap-* /auth-extra-groups）。
  4. 返回 `{command, token, server, caCertHash, expiresAt}`，command 形如 `kubeadm join <server> --token <id>.<secret> --discovery-token-ca-cert-hash sha256:<hash>`。
- 失败：cluster-info 缺失/非法、创建 token 失败 → 500 并带原因；ttl 越界 → 400。

## 3. 验证

| 项 | 结果 |
| --- | --- |
| `go test ./pkg/kapis/resources/v1alpha3/ -run TestNodeJoin -count=1` | **3 passed**（签发 token+命令、ttl 越界不建 token、缺 cluster-info 报错） |
| **真实集群集成** `KS_JOIN_REAL=1 KUBECONFIG=~/.kube/config go test -tags=integration ...` | **PASS（4.94s）**：对 B200 真实 cluster-info 签发 token（server `https://lb.kubesphere.local:6443`），断言命令/到期，测试结束删除 token |
| `go build ./pkg/kapis/resources/v1alpha3 ./pkg/apiserver` | 通过（GOCACHE 指到 /tmp） |
| 部署 | **未部署到 B200/mlu370**：现有 ks-apiserver 无此路由；控制台会显式提示需要升级后端 |

## 3.1 控制台接入

- `apps/console-next/src/pages/cluster/NodeJoinDialog.tsx`：打开时请求 join-command；成功显示命令/CA hash/到期/复制；404/405 → 「当前 ks-apiserver 版本不支持节点加入」+ 升级提示；403 → 无权限；命令只在内存。
- `NodesPage.tsx`：标题区「添加节点」（`nodes:add`）；先按 IAM 权限检查 create nodes，明确 false 隐藏，失败 fail-open。
- `packages/api-client/src/storage.ts`：`nodesWriteApi.joinCommand`（成员集群走 `/kapis/clusters/<c>/...`）。
- E2E：`TC-…-NODES-12` 在 B200 旧后端验证升级提示分支，并通过 Playwright 拦截同一路径返回文档化响应，验证命令/到期/复制渲染；真实后端部署后再跑一次正向端到端。

## 4. 代码位置

- `kube-server/pkg/kapis/resources/v1alpha3/node_join.go`（handler、token/CA 逻辑）
- `kube-server/pkg/kapis/resources/v1alpha3/node_join_test.go`（fake clientset）
- `kube-server/pkg/kapis/resources/v1alpha3/node_join_integration_test.go`（真实集群，`integration` tag + `KS_JOIN_REAL=1`）
- `kube-server/pkg/kapis/resources/v1alpha3/register.go`（路由 + AddToContainer 增加 kube client）
- `kube-server/pkg/apiserver/apiserver.go`（注入 kube client）

## 4.1 真实集群发现的问题

- B200 的 `kube-public/cluster-info` kubeconfig **没有 current-context**；原实现按 current-context 取 cluster 会返回 500 “kubeconfig has no current context”。真实集成测试暴露后改为：有 current-context 用其 cluster，否则取第一个 cluster。这也说明「fake client 单测全绿」不能替代一次真实对象读取。

## 5. 安全与边界

- token 默认 24h、最长 168h；只在响应中返回一次，控制台只放内存、不写 URL/日志。
- 需要 kube-apiserver 存在 kubeadm 默认 node bootstrap RBAC（kubeadm 集群自带）；缺失时节点加入会被 apiserver 拒绝，接口本身不建 RBAC。
- 不创建/编辑主机清单，不调用远程执行；管理员在目标主机执行命令。
- 不支持非 kubeadm 集群（如托管控制面）：仍可签发 token，但 join 命令是否适用由集群形态决定，后续在 UI 说明。

## 6. 后续

| 项 | 状态 |
| --- | --- |
| 控制台「添加节点」弹窗 + 复制/到期/404/405 分类 + 权限隐藏 | 已交付；E2E TC-…-NODES-12 在旧后端验证升级提示与 mock 拒绝隐藏（6.93s） |
| 弹窗正向渲染（命令/到期/复制） | 已用「接口契约 mock」在 E2E 中验证，与真实后端解耦 |
| 新后端部署到 B200/mlu370 后跑真实正向 E2E | 等部署 |
| 改动后批量回归（网关 5 + 节点 1 + 自制应用 9） | **15 passed / 64.38s**（一次进程，含登录与浏览器复用） |
| KubeKey 集群（若未来恢复） | 用同一接口即可，不需要改 UI |
