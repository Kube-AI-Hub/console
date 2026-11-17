# 集群删除卡在 Terminating：webhook 在校验前先连成员集群

- 发现日期：2026-11-18
- 环境：mlu370（`ssh cam`），`ks-controller-manager:develop`
- 影响：成员集群不可达时无法删除该集群，对象永久停在 `Terminating`；编辑别名/描述同样失败
- 修复提交：`kube-server` `febf48362`（webhook）+ `936e7083c`（envtest 套件 teardown）

## 现象

```bash
DELETE /apis/cluster.kubesphere.io/v1alpha1/clusters/4paradigm
→ 200，返回 Cluster 本体，metadata 里已有 deletionTimestamp
```

但对象不消失：

```
metadata.deletionTimestamp: 2026-11-17T16:01:59Z
metadata.finalizers: ["finalizer.cluster.kubesphere.io"]
metadata.resourceVersion: 192040758   # 之后不再变化
```

API 返回 200 让人以为删掉了。成员集群 `4paradigm` 的 API `10.233.13.179:6443` 已经失联
（`no route to host`），agent 不在。

## 根因

`validating-cluster.kubesphere.io` 只拦截 `clusters` 的 **UPDATE**，且 `failurePolicy: Fail`。
它的 `Handle` 对每一次 Update 都去读成员集群的 `kube-system` namespace：

```go
// pkg/controller/cluster/cluster_webhook.go（修复前）
if req.Operation != v1.Update { return admission.Allowed("") }
...
kubeSystem, err := clusterClient.CoreV1().Namespaces().Get(ctx, metav1.NamespaceSystem, metav1.GetOptions{})
if err != nil {
    return admission.Denied(err.Error())
}
```

删除流程里控制器摘 finalizer 的那一步就是一次 Update。成员集群不可达 → 校验失败 → finalizer 摘不掉：

```
DELETE（不被拦截）→ 打上 deletionTimestamp，返回 200
  控制器 unJoinFederation          ✅（KubeFedCluster 已删除）
  控制器 Update 摘 finalizer
    → webhook 去连 10.233.13.179:6443
    → no route to host
    → 拒绝 → finalizer 保留 → 永久 Terminating
```

`unJoinFederation` 内部重试 5 次，外层 `handleErr` 在 `maxRetries=15` 后 `Forget(key)` 丢弃该 key；
对象不再变化，informer 不再触发，于是不会再有任何重试。

同类后果：编辑集群别名/描述（也是 Update）、成员集群掉线后想通过 UI 修复，都会被同一个校验阻断。

## 修复

校验的本意是「换 kubeconfig 时不能换成另一台集群」。只有当 kubeconfig **确实变化**时这个判断才有意义，
因此先比较新旧 kubeconfig，未变则直接放行：

```go
if bytes.Equal(oldCluster.Spec.Connection.KubeConfig, newCluster.Spec.Connection.KubeConfig) {
    return admission.Allowed("")
}
```

摘 finalizer、改别名、写 status 都不动连接信息，不再需要成员集群可达；换 kubeconfig 的校验完整保留。

## 验证

新增 `pkg/controller/cluster/cluster_webhook_test.go`，5 个用例：

| 用例 | 断言 |
| --- | --- |
| 摘 finalizer（kubeconfig 未变） | 放行，不连成员集群 |
| 只改 metadata | 放行 |
| 换 kubeconfig 且连不上 | 拒绝（保留原校验） |
| Create / Delete | 放行 |
| 首次写 status | 放行 |

回归确认：把修复临时回退后，前两个用例以
`Get "https://127.0.0.1:1/api/v1/namespaces/kube-system": connection refused` 失败——
与线上 `no route to host` 同一形态，证明测试确实锁住了这个缺陷。

```bash
cd kube-server && go test ./pkg/controller/cluster/...
```

## 顺带修掉的测试基建

跑上面这条命令时发现所有 envtest 套件都在**全部 spec 通过之后**报
`timeout waiting for process kube-apiserver to stop`。两个独立原因，都在清理顺序上：

1. 9 个套件用 `ctrl.SetupSignalHandler()` 起 manager 却从不停止它。`envtest.Stop()`
   要等 kube-apiserver 退出，而被 manager 持续写入的 apiserver 超过默认 20s 才退。
   改为可取消 context，`AfterSuite` 先 cancel 并等待，再停环境。
   `workspacerolebinding` 从 67.8s（还是靠把 stop timeout 提到 90s 才通过）降到 9.1s。
2. `pkg/controller/application` 每个 spec 用 `context.Background()` 起 manager，永不取消，
   于是每个用例泄漏一个 manager。改为每个 spec 自持可停止的 manager。

`hack/setup-kubebuilder-env.sh` 也失效了：它拉 controller-runtime v0.8.3 的脚本去下载
kubebuilder-tools 1.19.2，该 URL 已不返回 tar 包（`Unrecognized archive format`），
而套件只显示「envtest 起不来」这个后果。改为 `setup-envtest` + `1.26.x`（对齐
`k8s.io/client-go v0.26.1`），并显式指定宿主架构——Apple Silicon 上原本会解析成
`darwin-amd64` 而依赖 Rosetta。Makefile 的 `KUBEBUILDER_ASSETS` 指向 `testbin/bin`，
`setup-envtest` 从不创建该目录，一并修正。

验证：`go test ./pkg/controller/...` —— **24 个包通过，0 失败**。

## 遗留

- 已卡住的对象需要一次性人工解卡（摘 finalizer 或临时把 `failurePolicy` 改为 `Ignore`），
  修复本身只保证之后不再发生。
- 若将来需要「换 kubeconfig 时必须能连通」的更严校验，应改为只在 `spec.connection.kubeconfig`
  变化时校验，而不是对所有 Update 校验；这也是本次采用的判据。
