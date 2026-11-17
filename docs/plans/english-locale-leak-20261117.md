# 英文界面上漏出的两个模块名（2026-11-17）

## 1. 怎么发现的

能力矩阵里「英文页未作为本页主验」这条一直挂着。本轮把语言切到 `en` 走四个页面，扫描「形如 `a.b.c` 的原始标识符」，
在集群概览页抓到两个：

```
| Monitoring | Notification | App store | … | Network | network.ippool | openpitrix.appstore | s3 | …
```

## 2. 根因

概览的「组件」面板把 `configz` 的键映射成标签，但映射表只登记了**一级键**（`network`、`openpitrix`）：

```ts
const localeKey = KNOWN_MODULES[key];      // 'network.ippool' 查不到
return localeKey ? t(localeKey) : key;     // → 原样显示 key
```

而 `configz` 会报**子模块**（`network.ippool`、`openpitrix.appstore`），于是这两个键原样露给了读者。

## 3. 修法

1. 精确匹配 → **退到一级键** → 才用原始键：`KNOWN_MODULES[key] ?? KNOWN_MODULES[key.split('.')[0] ?? '']`；
2. 同时给两个子模块补精确标签（中文「IP 池」/「应用商店」，英文「IP pool」/「App store」）。

## 4. 验证

| 检查 | 修复前 | 修复后 |
| --- | --- | --- |
| `en` 集群概览的原始键 | `network.ippool`、`openpitrix.appstore` | **无** |
| `en` 节点/配置字典/平台信息 | 无 | 无 |

（`configmaps` 页扫出的 `instead.Read` 是假阳性：原文是「use a Secret instead.」+「Read the docs」两句相邻。）

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **回退链要覆盖真实数据的形状**：`configz` 给的是带点的子模块键，只登记一级键必然漏 |
| 2 | **英文走查能发现中文走查看不到的东西**：中文界面上这两个键也会露，但混在中文里不显眼 |
| 3 | 扫「原始标识符」是廉价的 i18n 缺陷检测法：正则匹配 `a.b.c` 形状即可 |
