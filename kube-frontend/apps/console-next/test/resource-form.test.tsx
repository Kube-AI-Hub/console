import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ResourceForm, type FormSchema } from '@kube-ai-hub/ui';

/**
 * Form behaviour after a rejected submit.
 *
 * The rules here were the ones a browser check found missing: a rejected submit
 * used to surface only as a console error, and a validation failure left the caret
 * wherever it was even when the offending field was out of view.
 */

const schema: FormSchema = {
  submit: { label: '确 认', cancelLabel: '取 消' },
  fields: [
    { key: 'name', label: '名称', type: 'text', required: true },
    { key: 'image', label: '镜像', type: 'text', required: true },
  ],
};

describe('ResourceForm', () => {
  it('focuses the first invalid field instead of failing silently', async () => {
    const onSubmit = vi.fn();
    render(<ResourceForm schema={schema} onSubmit={onSubmit} />);

    await userEvent.click(screen.getByRole('button', { name: '确 认' }));

    // A rejected submit looks like nothing happened when the message is out of view.
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('#ai-field-name')));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows the reason when the submit rejects and keeps the input', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('deployments.apps "x" already exists'));
    render(<ResourceForm schema={schema} onSubmit={onSubmit} />);

    await userEvent.type(document.querySelector('#ai-field-name') as HTMLElement, 'dup');
    await userEvent.type(document.querySelector('#ai-field-image') as HTMLElement, 'nginx');
    await userEvent.click(screen.getByRole('button', { name: '确 认' }));

    // The message belongs in the dialog: the only other trace was an unhandled
    // rejection in the console.
    await waitFor(() => expect(document.querySelector('[data-ai-id="form:submit-error"]')).toBeTruthy());
    expect(document.querySelector('[data-ai-id="form:submit-error"]')?.textContent).toContain('already exists');
    expect((document.querySelector('#ai-field-name') as HTMLInputElement).value).toBe('dup');
  });

  it('clears a previous submit error when the user retries', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('first failure')).mockResolvedValueOnce(undefined);
    render(<ResourceForm schema={schema} onSubmit={onSubmit} />);

    await userEvent.type(document.querySelector('#ai-field-name') as HTMLElement, 'a');
    await userEvent.type(document.querySelector('#ai-field-image') as HTMLElement, 'b');
    await userEvent.click(screen.getByRole('button', { name: '确 认' }));
    await waitFor(() => expect(document.querySelector('[data-ai-id="form:submit-error"]')).toBeTruthy());

    await userEvent.click(screen.getByRole('button', { name: '确 认' }));
    // A stale message next to a successful retry would be worse than none.
    await waitFor(() => expect(document.querySelector('[data-ai-id="form:submit-error"]')).toBeNull());
  });
});
