# 多集群（第三轮）：成员集群页面 404 归零（2026-11-17）

> 上一轮结束时，`xc` 的配置字典/保密字典/部署三页各剩 **2 条 404**。本轮定位并修掉，现在五页全部 **0 条 404**。

## 1. 剩下的 404 是什么

```
404 /kapis/resources.kubesphere.io/v1alpha3/clusters/xc/namespaces?page=1&limit=50
```

`limit=50` 是线索：`projectsApi.list` 的默认 `pageSize` 就是 50，而它内部有一份自己的
`namespacesPath()`（`packages/api-client/src/projects.ts`），仍把 `clusters/<id>` 拼在 group 之后。

项目选择器（`useProjectOptions`）与集群级列表页的项目列都走它，所以每个用到项目的集群页都会带上两条
（一页 + 一次重试/统计）。

## 2. 本轮修的

| 模块 | 改动 |
| --- | --- |
| `projects.ts` | `namespacesPath` 改用 `clusterScoped` |
| `kubectl.ts` | `target()` 与 `kubeconfig()` 都改用它（前者原先漏了） |
| `exec.ts` | 加注释说明 core 组的 exec 子资源没有成员集群形态，成员 exec 仍走 host 路径（不假装支持） |

## 3. 又有两条单测把旧位置写成了期望

`overview-completion.test.ts`（kubeconfig）与 `kubectl.test.ts`（target）断言 `…/v1alpha2/clusters/member/…`。
与上一轮同因：**host 上永远绿**。已改为正确位置并注明依据。

## 4. A100 `xc` 实测（本轮结束时）

| 页面 | 结果 | 404 |
| --- | --- | --- |
| 配置字典 | ready / 4 行 | **0** |
| 保密字典 | ready / 8 行 | **0** |
| 部署 | ready / 2 行 | **0** |
| 网关 | ready / 1 行 | **0** |
| DevOps | empty（该集群无工程） | **0** |
| 节点 | ready / 7 行 | — |
| 概览（host 与 xc） | ready | — |

## 5. 反思（已写入流程台账）

| # | 规则 |
| --- | --- |
| 1 | **扫尾要按「症状」找，不按「文件」找**：上一轮按文件列了一遍，漏掉了 `projects.ts` 里另一份 helper；本轮从 404 的 URL 反查（`limit=50` → `projectsApi`）一次命中 |
| 2 | **同一个 helper 会在多个模块里被复制**：`namespacesPath`、`clusterSegment` 各有若干份，收敛到 `paths.ts` 才算完 |
| 3 | **测试里的旧路径断言是最难发现的残留**：它们不报错，只是把缺陷固定下来 |
