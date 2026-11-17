# 空列表里也应该有「创建」（2026-11-17）

## 1. 缺口

`ResourceList` 的空态只给两个出口：「清空搜索与筛选」和「刷新」。对一个**还没建过任何对象**的读者来说，
这两个都没用——他要的是「创建」。页头的创建按钮一直在，但表格体才是眼睛落下的地方。

## 2. 修法：共享层补一个主操作

空态现在会渲染 `schema.primaryAction`（与页头同一个按钮、同一个 `onAction(key)` 回调），
`data-ai-id="empty-state:primary"`；被禁用时**不渲染**（禁用按钮配不上「开始」这个位置）。

```tsx
{primaryAction && !primaryAction.disabled ? (
  <Button size="sm" variant="primary" data-ai-id="empty-state:primary"
    onClick={() => onAction?.(primaryAction.key, undefined as unknown as TRow)}>
    {primaryAction.label}
  </Button>
) : null}
```

一处改动，**61 个列表**全部受益。

## 3. 验证

| 页面 | 场景 | 空态主按钮 |
| --- | --- | --- |
| `xc` 守护进程集 | 列表本来就是空的（0 行） | **创建** |
| `xc` 配置字典 | 7 行，搜 `zzz-none` 搜空 | **创建** |

| 检查 | 结果 |
| --- | --- |
| `tsc` | 0 |
| 契约套件 | 18 文件 / 1566 passed |

## 4. 契约：空态要有「下一步」，且说明不能退化

`config/empty-state-contract.test.ts` 加两条：

```ts
// 空态必须渲染主操作，且禁用的主操作不渲染
expect(shared).toMatch(/data-ai-id="empty-state:primary"/);
expect(shared).toMatch(/primaryAction && !primaryAction\.disabled/);

// 带说明文字的空态数量只能涨（今天 43/61）
expect(withDescription.length).toBeGreaterThanOrEqual(43);
```

**棘轮而不是墙**：现有的 18 个只有标题的空态不强制补，但新增列表必须带说明，补掉旧的随时欢迎。

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **空态要给「下一步」**，而不是只给「撤销」：清空筛选解决的是读者的误操作，创建解决的是他的目的 |
| 2 | 空态与页头复用**同一个** action 定义，避免两处按钮行为漂移 |
