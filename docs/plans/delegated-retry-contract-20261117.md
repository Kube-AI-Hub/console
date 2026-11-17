# 契约套件回到全绿：委托型页面的 retry 断言（2026-11-17）

## 1. 背景

连续几轮 `config/vitest.config.ts` 都有一条失败：

```
× page AI surface > …/cluster/KubectlPage.tsx exposes a retry path on failure
```

断言规则是「页面源码里出现 `'error'` 就必须出现 `retry` 或 `refetch`」——**这条规则本身是对的**：
失败页面没有恢复入口，对自动化就是死路。

## 2. 为什么它会失败

并行线把 `KubectlPage.tsx` 重写成了 25 行的外壳，真正的错误面板与重试按钮搬进了
`components/resource/KubectlConsoleDialog.tsx`：

```tsx
{target.isError ? <ResourceErrorPanel error={target.error} onRetry={() => void target.refetch()}
                     retryAiId="kubectl:retry" /> : …}
```

页面仍有 `'error'`（phase 联合类型），但 `retry` 在子组件里 → 单文件扫描看不到。

## 3. 处理：加一条**指名道姓**的豁免，而不是放宽断言

```ts
const DELEGATED_RETRY: Record<string, string> = {
  'apps/console-next/src/pages/cluster/KubectlPage.tsx':
    'the error panel and its kubectl:retry button live in components/resource/KubectlConsoleDialog.tsx',
};
```

豁免必须写明**哪个文件承载了 retry**，可被复核；其余页面仍受原断言约束。
没有改成「有 `<AiSurface` 就跳过」之类宽泛规则——那等于关掉守卫。

## 4. 结果

```
Test Files  18 passed (18)
Tests       1484 passed (1484)
```

**连续多轮之后第一次全绿。**

## 5. 反思

| # | 规则 |
| --- | --- |
| 1 | **断言失败时先问「规则错还是代码错」**：这次是规则的适用范围不够（跨文件），不是代码缺 retry |
| 2 | **豁免要指名承载者**，不能只写「已委托」 |
| 3 | 不要为了让测试变绿去改并行线正在编辑的页面 |
