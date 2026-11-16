# 多集群（第二轮）：其余模块的成员集群路径（2026-11-17）

> 上一轮修好了 `resources.ts` 与 `node-list.ts`。本轮把剩下自带 `clusterSegment` 的模块统一到同一个 helper，
> 并在 A100 的成员集群 `xc` 上逐页复测。

## 1. 统一到 `clusterScoped`

| 模块 | 原写法 | 现在 |
| --- | --- | --- |
| `configmaps.ts` | `${prefix}/${clusters/…}/…` | `clusterScoped(prefix, cluster, …)`（cluster 作用域不拼段） |
| `devops.ts` | `/apis/<group>/<version>/clusters/…` | `clusterScoped('/apis/<group>/<version>', …)` |
| `iam.ts` | `${KAPIS_IAM}/clusters/…` | `clusterScoped(KAPIS_IAM, …)` |
| `gateways.ts` | 两个自建 helper | 同上 |
| `s2ibuilder.ts` | 自建 helper + 多处手拼 | 同上；core 组改走 `corePath` |
| `gpu.ts` | 手拼 pods 路径（还特判了 `default`） | `clusterScoped` |

## 2. 新增 `corePath`：core 组没有成员集群形态

实测 `/api/v1/clusters/xc/nodes` → **404**；但通用 kapis 代理接受同样的形状：
`/kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces/default/secrets` → **200**。

所以 core 资源在成员集群上**改走 kapis 代理**，而不是拼一个不存在的路径：

```ts
export function corePath(cluster: string | undefined, rest: string): string {
  if (!cluster || cluster === 'host') return `/api/v1/${rest}`;
  return clusterScoped('/kapis/resources.kubesphere.io/v1alpha3', cluster, rest);
}
```

## 3. 单测里有两处**把 bug 写成了期望**

`devops.test.ts` 与 `configmaps.test.ts` 断言的是旧位置（`…/v1alpha3/clusters/member/…`）。
这两条测试在 `host` 上永远绿，只有成员集群才暴露——**测试固化了缺陷**。已改成正确位置并加注释说明依据。

## 4. A100 成员集群 `xc` 实测

| 页面 | 结果 | 剩余 404 |
| --- | --- | --- |
| `xc` 配置字典 | ready / 4 行 | 2 |
| `xc` 保密字典 | ready / 8 行 | 2 |
| `xc` 部署 | ready / 2 行 | 2 |
| `xc` 网关 | ready / 1 行 | **0** |
| `xc` DevOps | empty（该集群无工程） | **0** |

上一轮 `xc` 节点页是 error/0 行，本轮已 ready/7 行。

**未完成**：前三页各剩 2 条 404，最后一次抓取因 BFF 503 中断，尚未定位（上一次抓到的形状是
`/kapis/resources.kubesphere.io/v1alpha3/clusters/xc/namespaces?page=1&limit=50`，即旧位置）。
下一轮第一件事就是抓这两条并把它们修掉。

## 5. 反思

| # | 规则 | 触发事故 |
| --- | --- | --- |
| 1 | **测试也可能固化缺陷**：只在 host 上跑的断言，会把错误路径写成「期望」 | 两条单测断言旧位置，长期绿 |
| 2 | **同一根因要一次查完**（上一轮只修了两个模块，剩下 7 个照旧） | 本轮才把其余模块统一 |
| 3 | **改完立刻在成员集群上复测**，host 通过不代表成员通过 | 见上 |
