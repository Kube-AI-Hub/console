# 事故核查：B200 的 csghub 命名空间是否被删除（2026-11-16）

## 问题

用户反馈 B200 环境 `csghub` namespace 被删除。以下是可复现的核查记录与结论。

## 结论（截至 2026-11-16 09:50）

**`csghub` 命名空间当前存在且正常**：

| 检查 | 结果 |
| --- | --- |
| `GET /api/v1/namespaces/csghub` | **200**（连续 3 次一致） |
| `GET /api/v1/namespaces` | 200，**25 个**，含 `csghub` 与 `spaces` |
| `csghub` 内 Pod | **26 个**（含 `csghub-server-migrate` Job 起的 Pod） |
| `csghub` 内 PVC | **10 个，全部 Bound** |
| `kube_namespace_labels{namespace="csghub"}` | 存在（kube-state-metrics 实时上报） |

## 审计证据：没有任何删除 csghub 的记录

KubeSphere 审计日志可查（`/kapis/tenant.kubesphere.io/v1alpha2/auditing/events`，7 天窗口共 47 427 条），逐项核对：

| 查询 | 结果 |
| --- | --- |
| 7 天内 `delete namespaces` 操作 | **161 条**，全部是 E2E 生成的唯一名（`pwfed*`、`e2e-gw-*`）加两条本项目探针名（`probe-fed-1115`、`tc-shot-devops-67psx`），**没有 `csghub`** |
| 7 天内 `delete workspaces` 操作 | **260 条**，全部是 `tc-e2e-ws*`，**没有 `csghub`** |
| 按命名空间检索 `csghub` | **0 条** |
| 最近 14 小时全量审计（10 384 条）逐条搜 `csghub` 字符串 | **0 条** |

即：**集群审计里不存在任何针对 csghub 的删除动作**。

## 但读到的状态会抖（这是真实存在的现象）

核查开始时，同一条 `GET /api/v1/namespaces/csghub` **返回过 404**，且命名空间列表只有 **23 个**（缺的恰好是 `csghub` 与 `spaces` 两个项目命名空间）；几分钟后同样的请求连续三次返回 200 / 25 个。

这与本项目昨晚量化到的上游问题一致：BFF 到 B200 的链路会**偶发卡死数分钟**（旁路采样：中位数 387 ms，但单次最长 925 846 ms），期间读到的可能是过期响应。所以「刚才还在、再看没了」很可能是一次过期读，而不是删除。

## 另一个真实的变化：csghub 的存储在 01:25 被重建过

`csghub` 的 8 个数据 PV（`pvc-*` 命名）创建时间都是 **2026-11-16T01:25**，而两个老的 juicefs PV（`kubeaihub-public-models`、`kubeaihub-request-log-content`，创建于 10 月）仍在且当前 **Bound**。这说明 csghub 应用在 **01:25 前后被重新部署/重装过一次**（PVC 被重建），而不是被删除。

核查中这两个老 PV 曾读到 `Released`，随后又读到 `Bound`——同样是过期读的表现（Released→Bound 需要新 PVC 重新绑定，不可能在几分钟内自发发生）。

## 谁在 01:25 重装了 csghub？

本机可见的范围内**无法确定**：

- ArgoCD 的 Application 数量为 **0**（`/apis/argoproj.io/v1alpha1/applications`），排除 GitOps 同步；
- 审计中没有该命名空间的写操作记录（该命名空间似乎不在审计索引范围内），因此无法据此定位操作者；
- 本项目自身的用例/脚本只删除自己创建的唯一命名空间，与审计里那 161 条记录完全对应。

建议由有集群权限的人核查：01:25 前后是否有 CI/运维/他人重装 csghub，以及 `kubectl get ns csghub` 的直连结果。
