import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useResourceListState } from '@/components/resource/useResourceListState';

afterEach(() => vi.useRealTimers());

describe('resource list page size', () => {
  it('changes size and page atomically while retaining search and sort', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useResourceListState({ defaultSortBy: 'name' }));
    act(() => result.current.setKeyword('  nginx  '));
    act(() => vi.advanceTimersByTime(250));
    act(() => {
      result.current.setPage(4);
      result.current.setSelected(['default/nginx']);
    });
    act(() => result.current.setPageSize(50));
    expect(result.current.pageSize).toBe(50);
    expect(result.current.page).toBe(1);
    expect(result.current.selected).toEqual([]);
    expect(result.current.search).toBe('nginx');
    expect(result.current.keyword).toBe('  nginx  ');
    expect(result.current.sortBy).toBe('name');
    expect(result.current.order).toBe('desc');
  });

  it('accepts an explicit default and ignores invalid sizes', () => {
    const { result } = renderHook(() => useResourceListState({ defaultSortBy: 'name', defaultPageSize: 10 }));
    expect(result.current.pageSize).toBe(10);
    for (const size of [0, -10, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      act(() => result.current.setPageSize(size));
      expect(result.current.pageSize).toBe(10);
    }
  });
});
