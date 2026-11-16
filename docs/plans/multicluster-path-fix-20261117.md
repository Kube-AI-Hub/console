# 多集群：成员集群的路径段位置（2026-11-16/17，A100 环境实测）

> 切换到 A100 环境（两个集群：`host` + `xc`）后发现：**新 UI 对成员集群的每一次集群级读取都 404**。
> 根因是 `clusters/<name>` 段的位置，本轮已修并实测通过。

## 1. 环境

| 项 | 值 |
| --- | --- |
| 访问 | `ssh a100`（ProxyJump `t` → `172.26.1.44`） |
| 控制台 | `https://agentplatform.phanthy.com/dashboard` / `ka.4paradigm.com` |
| 账号 | `admin` / `P@88w0rd`（密码含 `@`，直连 ks-console 会被当密文，故走 ks-console 的加密登录） |
| 集群 | `host`（主，v1.34.4，3 节点）、`xc`（成员，v1.29.15，7 节点） |
| 本地栈 | 隧道 `18091 → 172.26.1.44:30880`（ks-console）→ BFF `8093` → 静态站 `5179` |

## 2. 缺陷

打开 `/kube-frontend/clusters/xc/nodes`：页面 `error`，抓到的请求全部 404：

```
404 /kapis/resources.kubesphere.io/v1alpha3/clusters/xc/nodes?page=1&limit=10…
404 /kapis/resources.kubesphere.io/v1alpha3/clusters/xc/nodes/stats…
```

## 3. 正确的段位置（实测矩阵）

| 路径 | 结果 |
| --- | --- |
| `/apis/clusters/xc/apps/v1/namespaces/default/deployments` | **200** |
| `/apis/apps/v1/clusters/xc/namespaces/default/deployments` | 404 |
| `/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/nodes` | **200** |
| `/kapis/resources.kubesphere.io/v1alpha3/clusters/xc/nodes` | 404 |
| `/api/v1/clusters/xc/nodes`（core 组） | 404（core 无成员集群形态） |

**规则**：`clusters/<name>` 紧跟 API 根（`/kapis`、`/apis`），在 **group/version 之前**。

## 4. 修复

新增 `packages/api-client/src/paths.ts` 的 `clusterScoped(prefix, cluster, rest)`：

```ts
export function clusterScoped(prefix: string, cluster: string | undefined, rest: string): string {
  if (!cluster || cluster === 'host') return `${prefix}/${rest}`;
  const match = /^(\/(?:kapis|apis))\/(.*)$/.exec(prefix);
  if (!match) return `${prefix}/${rest}`;
  return `${match[1]}/clusters/${encodeURIComponent(cluster)}/${match[2]}/${rest}`;
}
```

已接入：`resources.ts`（通用 kapis 资源代理与 core 写路径）、`node-list.ts`（节点列表与统计）。
**`/api/v1` 保持原样**：core 组在本部署没有成员集群形态，硬拼只会得到 404。

## 5. 实测结果

| 页面 | 修复前 | 修复后 |
| --- | --- | --- |
| `host` 节点 | ready / 3 行 | ready / 3 行 |
| **`xc` 节点** | **error / 0 行** | **ready / 7 行**（健康率 42.9%，CPU 节点 6，昆仑芯 1） |
| `host` 概览 | ready | ready |
| `xc` 概览 | ready | ready |

## 6. 一个自己造成的弯路（重要）

第一次修的时候，我把「prefix」当成了 API 根，写出 `${prefix}/clusters/…` —— 结果生成的是
`/kapis/resources.kubesphere.io/v1alpha3/clusters/xc/nodes`，**与旧路径一模一样**，页面依旧 404。

绕了两轮才回到定义：prefix 是 `/kapis/<group>/<version>`，集群段必须插在**第一个路径段之后**。

**教训**：改路径拼接时，先用一条真实请求验证「函数输出 == 期望字符串」，再去看页面——
我在页面上反复看请求，却没打印过 helper 的返回值。

## 7. 剩余

同样的段位置问题还存在于下列模块（尚未修，均自带一份 `clusterSegment`）：

`configmaps.ts`、`devops.ts`、`exec.ts`、`gateways.ts`、`iam.ts`、`logs.ts`、`s2ibuilder.ts`、`storage.ts`（core 节点写路径）、`appstore.ts`（release 资源）。

它们的调用点在 `host` 上正确，只有在成员集群上才暴露；下一轮按同一 helper 逐个替换并复测。
