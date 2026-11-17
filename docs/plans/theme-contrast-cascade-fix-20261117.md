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

## 3. 处理：四处差距**全部修掉**（不是登记了事）

新增**焦点环**契约（SC 1.4.11，3:1）：`Button` 画的是 `ring-ai-ring` + `ring-offset-ai-bg`，所以查 `--ai-ring` 对 `--ai-bg`。

| 差距 | 修法 | 结果 |
| --- | --- | --- |
| 深色主题环 2.38:1 | `--ai-ring` 从最深的一档 violet-100 换成 violet-400（与 accent 块一致） | 通过 |
| 浅色主题环 1.89:1（改深色后暴露） | 纯浅色块补上自己的 `--ai-ring`（violet-100），不再继承深色页那一档 | 通过 |
| `green/light` 环 2.29:1 | 换成 mint-700（调色板里「在浅底上仍可读」的那一档） | 通过 |
| `violet/light` hover 面文字 4.47 / 4.41 | 把 hover 面 `--ai-surface-3` 调深一档（violet-lite-400 → 500） | 4.76 起，通过 |

`KNOWN_TOKEN_GAPS` 与 `KNOWN_RING_GAPS` **现在都是空的**——契约从「登记差距」回到「零容忍」。
双向守卫保留：以后若有人把某一档改回去，测试会立刻失败。

## 4. 验证

```
Test Files  18 passed (18)
Tests       1500 passed (1500)
```

## 5. 加一条守卫：主题必须真的不同

```ts
it('resolves a different palette for each theme', () => { … expect(distinct.size).toBeGreaterThanOrEqual(5); });
```

**负向验证**：把 `[...chain].reverse().find` 改回 `chain.find`，这条立刻失败并打印：

```
六个主题只解析出 1 种背景色：default (dark)=20,33,90 | light=20,33,90 | … 全部相同
```

恢复后 4 条全过。以后谁把级联方向改回去，第一条守卫就会喊。

## 6. 反思

| # | 规则 |
| --- | --- |
| 1 | **契约测试本身也会假绿**：级联方向错了，六次检查其实是同一次 |
| 2 | **登记差距要带维度**（这里是主题）：同一对令牌可能一个组合通过、另一个不通过 |
| 3 | 修好一个判据后，**先看它暴露了什么**，再决定是修代码还是登记 |
