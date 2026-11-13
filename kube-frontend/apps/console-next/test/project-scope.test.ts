import { describe, expect, it } from 'vitest';
import { selectableProjects, type Project } from '@kube-ai-hub/api-client';

/**
 * The project list is the input to every picker, and the enterprise space is what decides
 * which projects a reader may govern: a project belongs to exactly one workspace, and a
 * workspace only manages its own. Filtering happens in the hook, so this pins the data the
 * hook filters on.
 */
const project = (name: string, workspace: string, phase = 'Active'): Project => ({
  name,
  alias: '',
  phase,
  workspace,
});

describe('project workspace membership', () => {
  it('carries the owning workspace so a picker can filter on it', () => {
    const projects = [project('alpha', 'team-a'), project('beta', 'team-b')];
    expect(projects.filter((item) => item.workspace === 'team-a').map((item) => item.name)).toEqual(['alpha']);
  });

  it('drops terminating projects before the filter sees them', () => {
    // A terminating project cannot accept new objects; offering it in a picker leads to a
    // create that fails for a reason the reader cannot act on.
    const projects = [project('alpha', 'team-a'), project('gone', 'team-a', 'Terminating')];
    expect(selectableProjects(projects).map((item) => item.name)).toEqual(['alpha']);
  });
});
