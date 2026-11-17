# A100 的成员集群 `xc` 已经不在了（2026-11-18 01:40）

## 现象

A100 八段式基线突然大量 **400**：

```
400 /kapis/clusters/xc/resources.kubesphere.io/v1alpha3/namespaces?page=1&limit=50
     {"ErrStatus": {"message": "cluster xc not exists", "reason": "BadRequest"}}
```

直接查集群列表：

```
GET /kapis/resources.kubesphere.io/v1alpha3/clusters?limit=-1   ->  ['host']
```

**A100 现在只有 `host`**，成员集群 `xc` 被移除了。

## 影响

| 项 | 状态 |
| --- | --- |
| 多集群基线（`--clusters host,xc`） | **无法再跑**，会得到一串 400 |
| 之前的多集群结论（路径段、写入落点、24 个 Tab 等） | 在**测量当时**成立；现在无法复验 |
| 单集群基线（`--clusters host`） | **正常**：393 秒八段全绿、0 失败请求 |

## 重新具备多集群条件后要做的

1. 用 `--clusters host,<成员>` 重跑八段式基线，确认路径与写入落点结论仍成立；
2. 重跑 `--probes`，对比成员集群的能力指纹；
3. 只有到那时，才可以把多集群相关行标回「已验证」。

## 顺带修掉的一处工具问题

四个记录失败请求的地方只有一处应用了「预期内失败」过滤，于是 IAM 权限探测的那条 500 在 Tab / 交互 / 详情段
仍被算成缺陷。现在四处都过滤；A100 单集群基线因此从「有失败请求」回到 **0 失败请求**。
