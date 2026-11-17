import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { ResourceForm, type FormSchema } from '../src/schema/ResourceForm';
import { focusFirstInvalidField } from '../src/utils/focusFirstInvalid';

/**
 * A rejected submit must reveal the field that failed.
 *
 * The defect this prevents is the one every tall form hits: the dialog body scrolls,
 * the offending field is below the fold, and pressing 提交 renders the message where
 * nobody sees it — so the button reads as "nothing happened". Measured on 添加集群
 * (2026-11-17): with only the name filled in, the kubeconfig error sat 443px below the
 * visible area.
 *
 * jsdom does not scroll, so what is asserted here is the contract the helper owns:
 * it finds the wrapper for a field, prefers the wrapper over the control, and never
 * throws when the browser lacks `scrollIntoView`. The scroll offset itself was verified
 * in a real browser and recorded in `docs/plans/cluster-add-dialog-20261117.md`.
 */

const SCHEMA: FormSchema = {
  fields: [
    { key: 'name', label: '名称', type: 'text', required: true },
    { key: 'spec.connection.kubeconfig', label: 'kubeconfig', type: 'text', required: true },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('focusFirstInvalidField', () => {
  it('finds a field by its schema key and prefers the wrapper', () => {
    const { container } = render(
      <ResourceForm
        schema={SCHEMA}
        onSubmit={() => undefined}
        defaultValues={{ name: 'ok', 'spec.connection.kubeconfig': '' }}
      />,
    );
    const scrolled: Element[] = [];
    // jsdom has no layout, so record what the helper asked to scroll.
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as unknown as typeof Element.prototype.scrollIntoView;

    const found = focusFirstInvalidField(container as HTMLElement, 'spec.connection.kubeconfig');
    expect(found).toBe(true);
    // Synchronously it schedules a frame; the assertion runs after it fires.
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(scrolled).toHaveLength(1);
        expect(scrolled[0]?.getAttribute('data-field-key')).toBe('spec.connection.kubeconfig');
        resolve();
      });
    });
  });

  it('returns false for a field that is not rendered', () => {
    const { container } = render(
      <ResourceForm schema={SCHEMA} onSubmit={() => undefined} defaultValues={{ name: 'ok' }} />,
    );
    expect(focusFirstInvalidField(container as HTMLElement, 'no.such.field')).toBe(false);
  });

  it('does not throw when the browser cannot scroll', () => {
    const { container } = render(
      <ResourceForm schema={SCHEMA} onSubmit={() => undefined} defaultValues={{ name: 'ok' }} />,
    );
    // @ts-expect-error deliberately removing the method: jsdom lacks it, and an
    // exception inside a submit handler would surface as an unhandled rejection.
    Element.prototype.scrollIntoView = undefined;
    expect(() => focusFirstInvalidField(container as HTMLElement, 'name')).not.toThrow();
  });
});

describe('ResourceForm submit', () => {
  it('reveals the first invalid field instead of silently doing nothing', async () => {
    const onSubmit = vi.fn();
    const scrolled: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function (this: Element) {
      scrolled.push(this);
    }) as unknown as typeof Element.prototype.scrollIntoView;

    render(<ResourceForm schema={SCHEMA} onSubmit={onSubmit} defaultValues={{ name: '', 'spec.connection.kubeconfig': '' }} />);
    await userEvent.click(screen.getByRole('button', { name: '提交' }));

    // Both fields are invalid; the first one in schema order is the one revealed.
    await waitFor(() => expect(scrolled.length).toBeGreaterThan(0));
    expect(scrolled[0]?.getAttribute('data-field-key')).toBe('name');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('leaves the values in place when the request fails', async () => {
    // A failed write must not clear the form: retyping a whole dialog because the
    // server rejected one field is the failure this guards.
    render(
      <ResourceForm
        schema={SCHEMA}
        // A dotted key reads a nested value: `getByPath` walks the object, so a flat
        // `'spec.connection.kubeconfig'` key would leave the field empty and fail
        // validation before the request is ever made.
        defaultValues={{ name: 'taken', spec: { connection: { kubeconfig: 'apiVersion: v1' } } }}
        onSubmit={async () => {
          throw new Error('conflict');
        }}
        describeError={() => '名称已被占用'}
      />,
    );
    // The rejection is caught inside the submit handler and rendered above the submit
    // row; `waitFor` because it lands a microtask later.
    await userEvent.click(screen.getByRole('button', { name: '提交' }));
    await waitFor(() => expect(document.querySelector('[data-ai-id="form:submit-error"]')?.textContent).toBe('名称已被占用'));
    expect(screen.getByDisplayValue('taken')).toBeInTheDocument();
  });
});
