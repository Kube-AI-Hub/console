# 主题对比度契约一直在测同一套调色板（2026-11-17）

## 1. 缺陷：级联查找方向反了

`config/theme-contrast-contract.test.ts` 的 `resolve()` 用

```ts
const layer = chain.find((selector) => propsOf(selector).has(name));
```

在 `[':root', ":root[data-theme='light']"]` 里取**第一个**命中——`:root` 几乎定义了所有令牌，
于是**六个主题组合全都解析成深色调色板**。「浅色主题通过 AA」这句话一直没有依据。

改为取**最后一个**命中的层（后定义的覆盖先定义的）：

```ts
const layer = [...chain].reverse().find((selector) => propsOf(selector).has(name));
```

## 2. 修正后立刻暴露的两处真实差距

| 组合 | 令牌对 | 实测 | 要求 |
| --- | --- | --- | --- |
| `violet/light` | `--ai-fg-muted` on `--ai-surface-3` | **4.47:1** | 4.5 |
| `violet/light` | `--ai-link` on `--ai-surface-3` | **4.41:1** | 4.5 |
| `default (dark)` | `--ai-ring` on `--ai-bg` | **2.38:1** | 3（1.4.11 非文本） |
| `green/light` | `--ai-ring` on `--ai-bg` | **2.29:1** | 3 |

## 3. 处理

- 新增**焦点环**契约（SC 1.4.11，3:1）：`Button` 画的是 `ring-ai-ring` + `ring-offset-ai-bg`，所以查 `--ai-ring` 对 `--ai-bg`；
- 差距按**主题**登记（`KNOWN_TOKEN_GAPS` / `KNOWN_RING_GAPS`），并保留双向守卫：登记项一旦开始通过，测试就会失败并要求删除登记；
- 没有为了让测试变绿去调色板——这几个值需要专门的一档 hover 文字色与更亮的环，属于设计决策，登记后单独处理。

## 4. 验证

```
Test Files  18 passed (18)
Tests       1500 passed (1500)
```

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **契约测试本身也会假绿**：级联方向错了，六次检查其实是同一次 |
| 2 | **登记差距要带维度**（这里是主题）：同一对令牌可能一个组合通过、另一个不通过 |
| 3 | 修好一个判据后，**先看它暴露了什么**，再决定是修代码还是登记 |
