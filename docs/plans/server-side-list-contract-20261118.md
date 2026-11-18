# 列表的服务端排序、分页与筛选：对真实集群验过（2026-11-18）

列表实现有三个**服务端**假设：排序由服务端做、分页由服务端切、搜索按 `name` 传给服务端。
界面验收被登录卡住时，这三条可以**直接对 API 验**——不需要浏览器。

## 方式

拿 A100 的 token（走仍在运行的 BFF `8093` 的旧登录路由），然后直接打 kapis：

```
GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/default/configmaps?page=&limit=&sortBy=&ascending=&name=
```

## 实测

```
totalItems: 4
desc page1: ['istio-ca-root-cert', 'istio-ca-crl', 'hello']
desc page2: ['kube-root-ca.crt']
asc  page1: ['kube-root-ca.crt', 'hello', 'istio-ca-crl']
filter name=hello -> ['hello']  totalItems: 1
limit=100 -> 4 items（不足一页时如实返回全部）
```

| 假设 | 结论 |
| --- | --- |
| `sortBy=createTime&ascending=false` 按创建时间倒序 | ✓ |
| `ascending=true` 恰好是反向 | ✓（三条顺序完全反转） |
| `page=2` 由服务端切出下一页 | ✓（返回剩下的第 4 条） |
| `totalItems` 给出总数而非当前页条数 | ✓（4，不是 3） |
| `name=` 服务端过滤 | ✓ |

### 规模下的分页（427 条的真实集合）

```
GET /kapis/resources.kubesphere.io/v1alpha3/pods?page=1&limit=5  -> 5 items, totalItems: 427
GET …/pods?page=2&limit=5                                        -> 5 items
GET …/nodes?limit=-1                                             -> 3 items（全部）
```

**`totalItems` 是 427 而不是 5**——分页器显示「第 1-5 条，共 427 条」时读的就是这个数。
`limit=-1` 在集群级集合上表示「全要」，与旧 console 的用法一致。

## 这证明了什么、没证明什么

- **证明**：列表页把 `page/limit/sortBy/ascending/name` 交给服务端之后，服务端确实按约定执行；
- **没证明**：界面是否把这些参数**正确地**传出去（那部分由 api-client 单测与页面用例覆盖）。

两层分开之后，「排序不生效」这类问题可以立刻定位到是「没传」还是「服务端没做」。

---

## 顺带发现：缺失对象返回 **500 纯文本**

```
GET …/namespaces/default/configmaps/does-not-exist-xyz
→ 500
→ configmap "does-not-exist-xyz" not found     ← 纯文本，不是 kube Status JSON
```

`codeForStatus(500)` 会把它归成 `upstream_error`，于是**指向已删除对象的深链会显示「服务异常」**，
而真相是「对象不存在」。JSON 解析失败后走的那条分支（`codeForReason`）根本没机会执行。

**已修**：在解析纯文本的入口识别 `not found`，归成 `not_found`（`client.ts`）。
单测新增一条：500 + `configmap "gone" not found` → `code: 'not_found'`。api-client 50 文件 / **481 条**全过。

> 这条也说明：**服务端契约要实测**。文档里写「404 表示不存在」是对的，但这个聚合端点用的是 500 + 纯文本。
