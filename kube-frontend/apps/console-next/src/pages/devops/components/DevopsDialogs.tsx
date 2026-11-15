import * as React from 'react';
import {
  Alert,
  Button,
  FormField,
  Input,
  Modal,
  Select,
  Textarea,
  type SelectOption,
} from '@kube-ai-hub/ui';
import { actionProps } from '@kube-ai-hub/ai-surface';
import type { CredentialKind, DevopsProjectSummary, PipelineDraft, PipelineRow, RoleRow } from '@kube-ai-hub/api-client';
import { useT } from '@/i18n';

/**
 * The write dialogs of the DevOps area.
 *
 * One file, because they all share the same shape (open/close, submit, pending, inline
 * error) and the same two rules the old console's forms had:
 *
 * 1. The name is the identity and cannot be changed after creation. The devops API
 *    updates by whole-object PUT and has no rename, so an editable name field would
 *    silently create a second object or fail; the field is read-only when editing,
 *    exactly like the old CredentialCreate modal.
 * 2. A failed submit keeps the reader's input. Every dialog reports the server message
 *    inside itself and stays open, so a 409 does not cost the typed Jenkinsfile.
 */

/* ------------------------------------------------------------------ shared -- */

interface DialogFrameProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  pending: boolean;
  error?: string;
  submitLabel: string;
  submitAiId: string;
  onSubmit: () => void;
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

/** Title, body, footer and the error slot every dialog in this file renders. */
function DialogFrame({
  open,
  onOpenChange,
  title,
  description,
  pending,
  error,
  submitLabel,
  submitAiId,
  onSubmit,
  size = 'md',
  children,
}: DialogFrameProps): React.ReactElement {
  const t = useT();
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size={size}
      title={title}
      {...(description ? { description } : {})}
      closeDisabled={pending}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" disabled={pending} loading={pending} {...actionProps(submitAiId)} onClick={onSubmit}>
            {submitLabel}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {children}
        {error ? (
          <Alert tone="danger" data-ai-id={submitAiId + '-error'}>
            {error}
          </Alert>
        ) : null}
      </div>
    </Modal>
  );
}

/** A single-line field with the same label/error treatment everywhere. */
function TextField({
  id,
  label,
  value,
  onChange,
  disabled,
  hint,
  error,
  maxLength,
  autoFocus,
  aiId,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  error?: string;
  maxLength?: number;
  autoFocus?: boolean;
  aiId: string;
  placeholder?: string;
}): React.ReactElement {
  return (
    <FormField htmlFor={id} label={label} {...(hint ? { hint } : {})} {...(error ? { error } : {})}>
      <Input
        id={id}
        value={value}
        {...(disabled !== undefined ? { disabled } : {})}
        {...(maxLength !== undefined ? { maxLength } : {})}
        {...(autoFocus ? { autoFocus } : {})}
        {...(placeholder !== undefined ? { placeholder } : {})}
        {...actionProps(aiId)}
        onChange={(event) => onChange(event.target.value)}
      />
    </FormField>
  );
}

/** Name pattern the devops API accepts (PATTERN_SERVICE_NAME in the old console). */
const NAME_PATTERN = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;

/* -------------------------------------------------------- project create -- */

export interface DevopsProjectCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Workspaces the project can be created in; the first is preselected. */
  workspaces: string[];
  pending: boolean;
  error?: string;
  onSubmit: (draft: { generateName: string; workspace: string; alias: string; description: string }) => void;
}

export function DevopsProjectCreateDialog({
  open,
  onOpenChange,
  workspaces,
  pending,
  error,
  onSubmit,
}: DevopsProjectCreateDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [workspace, setWorkspace] = React.useState(workspaces[0] ?? '');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [nameError, setNameError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setAlias('');
    setDescription('');
    setNameError('');
    setWorkspace(workspaces[0] ?? '');
  }, [open, workspaces]);

  const submit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('devops.validate.nameRequired'));
      return;
    }
    if (!NAME_PATTERN.test(trimmed)) {
      setNameError(t('devops.validate.namePattern'));
      return;
    }
    setNameError('');
    onSubmit({ generateName: trimmed, workspace, alias, description });
  };

  const workspaceOptions: SelectOption[] = workspaces.map((entry) => ({ value: entry, label: entry }));

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('devops.create.title')}
      description={t('devops.create.description')}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={t('common.create')}
      submitAiId="devops:create-submit"
      onSubmit={submit}
    >
      <TextField
        id="devops-create-name"
        label={t('devops.field.name')}
        hint={t('devops.create.nameHint')}
        value={name}
        maxLength={58}
        autoFocus
        aiId="devops:create-name"
        onChange={setName}
        {...(nameError ? { error: nameError } : {})}
      />
      <FormField htmlFor="devops-create-workspace" label={t('projectInfo.field.workspace')}>
        <Select
          value={workspace}
          options={workspaceOptions}
          onValueChange={setWorkspace}
          placeholder={t('devops.create.workspacePlaceholder')}
          data-ai-id="devops:create-workspace"
        />
      </FormField>
      <TextField
        id="devops-create-alias"
        label={t('resource.field.alias')}
        value={alias}
        maxLength={63}
        aiId="devops:create-alias"
        onChange={setAlias}
      />
      <FormField htmlFor="devops-create-description" label={t('resource.field.description')}>
        <Textarea
          id="devops-create-description"
          value={description}
          rows={3}
          maxLength={256}
          {...actionProps('devops:create-description')}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>
    </DialogFrame>
  );
}

/* ------------------------------------------------------- pipeline create -- */

export interface PipelineFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null creates a pipeline; a row edits it. */
  editing: PipelineRow | null;
  pending: boolean;
  error?: string;
  /** Credentials the multi-branch form can bind a repository to. */
  credentialOptions: { value: string; label: string }[];
  onSubmit: (draft: PipelineDraft) => void;
}

/** The starter Jenkinsfile the create form prefills (the old console shipped one too). */
const STARTER_JENKINSFILE = [
  'pipeline {',
  '  agent any',
  '  stages {',
  '    stage("build") {',
  '      steps {',
  '        echo "hello from KubeSphere"',
  '      }',
  '    }',
  '  }',
  '}',
].join('\n');

const SCM_OPTIONS: SelectOption[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket' },
  { value: 'gitee', label: 'Gitee' },
  { value: 'svn', label: 'SVN' },
];

export function PipelineFormDialog({
  open,
  onOpenChange,
  editing,
  pending,
  error,
  credentialOptions,
  onSubmit,
}: PipelineFormDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [alias, setAlias] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState<'pipeline' | 'multi-branch-pipeline'>('pipeline');
  const [jenkinsfile, setJenkinsfile] = React.useState(STARTER_JENKINSFILE);
  const [sourceType, setSourceType] = React.useState('github');
  const [repoUrl, setRepoUrl] = React.useState('');
  const [owner, setOwner] = React.useState('');
  const [credentialId, setCredentialId] = React.useState('');
  const [scriptPath, setScriptPath] = React.useState('Jenkinsfile');
  const [nameError, setNameError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setAlias(editing?.alias ?? '');
    setDescription(editing?.description ?? '');
    setType(editing?.type === 'multi-branch-pipeline' ? 'multi-branch-pipeline' : 'pipeline');
    setJenkinsfile(editing?.jenkinsfile || STARTER_JENKINSFILE);
    setSourceType('github');
    setRepoUrl('');
    setOwner('');
    setCredentialId('');
    setScriptPath('Jenkinsfile');
    setNameError('');
  }, [open, editing]);

  const submit = (): void => {
    if (!editing) {
      const trimmed = name.trim();
      if (!trimmed) {
        setNameError(t('devops.validate.nameRequired'));
        return;
      }
      if (!NAME_PATTERN.test(trimmed)) {
        setNameError(t('devops.validate.namePattern'));
        return;
      }
      setNameError('');
    }
    onSubmit({
      name: editing?.name ?? name.trim(),
      alias,
      description,
      type,
      jenkinsfile,
      sourceType: sourceType as PipelineDraft['sourceType'],
      repoUrl,
      owner,
      credentialId,
      scriptPath,
    });
  };

  const typeOptions: SelectOption[] = [
    { value: 'pipeline', label: t('devops.pipeline.kind.pipeline') },
    { value: 'multi-branch-pipeline', label: t('devops.pipeline.kind.multiBranch') },
  ];

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={editing ? t('devops.pipeline.editTitle') : t('devops.pipeline.createTitle')}
      description={t('devops.pipeline.formDescription')}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={editing ? t('common.save') : t('common.create')}
      submitAiId="devops:pipeline-form-submit"
      onSubmit={submit}
    >
      <TextField
        id="devops-pipeline-name"
        label={t('devops.field.name')}
        hint={t('devops.pipeline.nameHint')}
        value={name}
        maxLength={63}
        autoFocus={!editing}
        disabled={Boolean(editing)}
        aiId="devops:pipeline-form-name"
        onChange={setName}
        {...(nameError ? { error: nameError } : {})}
      />
      <FormField htmlFor="devops-pipeline-type" label={t('devops.pipeline.type')}>
        {/*
          The type decides which half of the spec is written and cannot be changed by an
          update (a single-branch pipeline has no multi_branch_pipeline block), so it is
          only editable while creating.
        */}
        <Select
          value={type}
          options={typeOptions}
          onValueChange={(value) => setType(value === 'multi-branch-pipeline' ? 'multi-branch-pipeline' : 'pipeline')}
          disabled={Boolean(editing)}
          data-ai-id="devops:pipeline-form-type"
        />
      </FormField>
      <TextField
        id="devops-pipeline-alias"
        label={t('resource.field.alias')}
        value={alias}
        maxLength={63}
        aiId="devops:pipeline-form-alias"
        onChange={setAlias}
      />
      <FormField htmlFor="devops-pipeline-description" label={t('resource.field.description')}>
        <Textarea
          id="devops-pipeline-description"
          value={description}
          rows={2}
          maxLength={256}
          {...actionProps('devops:pipeline-form-description')}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormField>

      {type === 'pipeline' || editing ? (
        <FormField
          htmlFor="devops-pipeline-jenkinsfile"
          label={t('devops.pipeline.jenkinsfile')}
          hint={t('devops.pipeline.jenkinsfileHint')}
        >
          <Textarea
            id="devops-pipeline-jenkinsfile"
            value={jenkinsfile}
            rows={12}
            className="font-mono text-[11px]"
            {...actionProps('devops:pipeline-form-jenkinsfile')}
            onChange={(event) => setJenkinsfile(event.target.value)}
          />
        </FormField>
      ) : (
        <>
          <FormField htmlFor="devops-pipeline-source" label={t('devops.pipeline.sourceType')}>
            <Select
              value={sourceType}
              options={SCM_OPTIONS}
              onValueChange={setSourceType}
              data-ai-id="devops:pipeline-form-source"
            />
          </FormField>
          <TextField
            id="devops-pipeline-repo"
            label={t('devops.pipeline.repoUrl')}
            value={repoUrl}
            aiId="devops:pipeline-form-repo"
            onChange={setRepoUrl}
          />
          {sourceType === 'svn' ? null : (
            <TextField
              id="devops-pipeline-owner"
              label={t('devops.pipeline.repoOwner')}
              value={owner}
              aiId="devops:pipeline-form-owner"
              onChange={setOwner}
            />
          )}
          <FormField htmlFor="devops-pipeline-credential" label={t('devops.pipeline.credential')}>
            <Select
              value={credentialId}
              options={[{ value: '', label: t('devops.pipeline.noCredential') }, ...credentialOptions]}
              onValueChange={setCredentialId}
              data-ai-id="devops:pipeline-form-credential"
            />
          </FormField>
          <TextField
            id="devops-pipeline-script-path"
            label={t('devops.pipeline.scriptPath')}
            value={scriptPath}
            aiId="devops:pipeline-form-script-path"
            onChange={setScriptPath}
          />
        </>
      )}
    </DialogFrame>
  );
}

/* ----------------------------------------------------- credential create -- */

export interface CredentialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null creates a credential; a row edits its data. */
  editing: { name: string; kind: CredentialKind; description: string; username: string } | null;
  pending: boolean;
  error?: string;
  onSubmit: (draft: { name: string; kind: CredentialKind; description: string; fields: Record<string, string> }) => void;
}

const CREDENTIAL_KIND_OPTIONS: { value: CredentialKind; labelKey: string }[] = [
  { value: 'username_password', labelKey: 'devops.credential.kind.usernamePassword' },
  { value: 'ssh', labelKey: 'devops.credential.kind.ssh' },
  { value: 'secret_text', labelKey: 'devops.credential.kind.secretText' },
  { value: 'kubeconfig', labelKey: 'devops.credential.kind.kubeconfig' },
];

export function CredentialFormDialog({
  open,
  onOpenChange,
  editing,
  pending,
  error,
  onSubmit,
}: CredentialFormDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [kind, setKind] = React.useState<CredentialKind>('username_password');
  const [description, setDescription] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [privateKey, setPrivateKey] = React.useState('');
  const [passphrase, setPassphrase] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [kubeconfig, setKubeconfig] = React.useState('');
  const [nameError, setNameError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? '');
    setKind(editing?.kind ?? 'username_password');
    setDescription(editing?.description ?? '');
    setUsername(editing?.username ?? '');
    setPassword('');
    setPrivateKey('');
    setPassphrase('');
    setSecret('');
    setKubeconfig('');
    setNameError('');
  }, [open, editing]);

  const submit = (): void => {
    if (!editing) {
      const trimmed = name.trim();
      if (!trimmed) {
        setNameError(t('devops.validate.nameRequired'));
        return;
      }
      if (!NAME_PATTERN.test(trimmed)) {
        setNameError(t('devops.validate.namePattern'));
        return;
      }
      setNameError('');
    }
    const fields: Record<string, string> = {};
    if (kind === 'username_password') {
      fields.username = username;
      fields.password = password;
    } else if (kind === 'ssh') {
      fields.username = username;
      fields.private_key = privateKey;
      fields.passphrase = passphrase;
    } else if (kind === 'secret_text') {
      fields.secret = secret;
    } else {
      fields.content = kubeconfig;
    }
    onSubmit({ name: editing?.name ?? name.trim(), kind, description, fields });
  };

  const kindOptions: SelectOption[] = CREDENTIAL_KIND_OPTIONS.map((option) => ({
    value: option.value,
    label: t(option.labelKey as 'devops.credential.kind.usernamePassword'),
  }));

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? t('devops.credential.editTitle') : t('devops.credential.createTitle')}
      description={t('devops.credential.formDescription')}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={editing ? t('common.save') : t('common.create')}
      submitAiId="devops:credential-form-submit"
      onSubmit={submit}
    >
      <TextField
        id="devops-credential-name"
        label={t('devops.field.name')}
        value={name}
        maxLength={63}
        autoFocus={!editing}
        disabled={Boolean(editing)}
        aiId="devops:credential-form-name"
        onChange={setName}
        {...(nameError ? { error: nameError } : {})}
      />
      <FormField htmlFor="devops-credential-kind" label={t('devops.credential.kind.label')}>
        <Select
          value={kind}
          options={kindOptions}
          onValueChange={(value) => setKind(value as CredentialKind)}
          disabled={Boolean(editing)}
          data-ai-id="devops:credential-form-kind"
        />
      </FormField>

      {kind === 'username_password' ? (
        <>
          <TextField id="devops-credential-username" label={t('devops.credential.username')} value={username} aiId="devops:credential-form-username" onChange={setUsername} />
          <TextField id="devops-credential-password" label={t('devops.credential.password')} value={password} aiId="devops:credential-form-password" onChange={setPassword} />
        </>
      ) : null}
      {kind === 'ssh' ? (
        <>
          <TextField id="devops-credential-ssh-user" label={t('devops.credential.username')} value={username} aiId="devops:credential-form-username" onChange={setUsername} />
          <FormField htmlFor="devops-credential-private-key" label={t('devops.credential.privateKey')}>
            <Textarea id="devops-credential-private-key" value={privateKey} rows={5} className="font-mono text-[11px]" {...actionProps('devops:credential-form-private-key')} onChange={(event) => setPrivateKey(event.target.value)} />
          </FormField>
          <TextField id="devops-credential-passphrase" label={t('devops.credential.passphrase')} value={passphrase} aiId="devops:credential-form-passphrase" onChange={setPassphrase} />
        </>
      ) : null}
      {kind === 'secret_text' ? (
        <FormField htmlFor="devops-credential-secret" label={t('devops.credential.secret')}>
          <Textarea id="devops-credential-secret" value={secret} rows={4} {...actionProps('devops:credential-form-secret')} onChange={(event) => setSecret(event.target.value)} />
        </FormField>
      ) : null}
      {kind === 'kubeconfig' ? (
        <FormField htmlFor="devops-credential-kubeconfig" label={t('devops.credential.kubeconfig')} hint={t('devops.credential.kubeconfigHint')}>
          <Textarea id="devops-credential-kubeconfig" value={kubeconfig} rows={8} className="font-mono text-[11px]" {...actionProps('devops:credential-form-kubeconfig')} onChange={(event) => setKubeconfig(event.target.value)} />
        </FormField>
      ) : null}

      <FormField htmlFor="devops-credential-description" label={t('resource.field.description')}>
        <Textarea id="devops-credential-description" value={description} rows={2} maxLength={256} {...actionProps('devops:credential-form-description')} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
    </DialogFrame>
  );
}

/* ------------------------------------------------------------- member add -- */

export interface MemberInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleRow[];
  pending: boolean;
  error?: string;
  onSubmit: (draft: { username: string; roleRef: string }) => void;
}

export function MemberInviteDialog({
  open,
  onOpenChange,
  roles,
  pending,
  error,
  onSubmit,
}: MemberInviteDialogProps): React.ReactElement {
  const t = useT();
  const [username, setUsername] = React.useState('');
  const roleOptions: SelectOption[] = roles
    .filter((role) => role.preset)
    .map((role) => ({ value: role.name, label: role.alias || role.name }));
  const [roleRef, setRoleRef] = React.useState(roleOptions[0]?.value ?? 'viewer');
  const [usernameError, setUsernameError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setUsername('');
    setUsernameError('');
    setRoleRef(roleOptions[0]?.value ?? 'viewer');
    // roleOptions is derived from roles; roles is the stable input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, roles]);

  const submit = (): void => {
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameError(t('devops.member.usernameRequired'));
      return;
    }
    setUsernameError('');
    onSubmit({ username: trimmed, roleRef });
  };

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('devops.member.inviteTitle')}
      description={t('devops.member.inviteDescription')}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={t('devops.member.invite')}
      submitAiId="devops:member-invite-submit"
      onSubmit={submit}
    >
      <TextField
        id="devops-member-username"
        label={t('devops.member.username')}
        hint={t('devops.member.usernameHint')}
        value={username}
        autoFocus
        aiId="devops:member-invite-username"
        onChange={setUsername}
        {...(usernameError ? { error: usernameError } : {})}
      />
      <FormField htmlFor="devops-member-role" label={t('devops.member.role')}>
        <Select value={roleRef} options={roleOptions} onValueChange={setRoleRef} data-ai-id="devops:member-invite-role" />
      </FormField>
    </DialogFrame>
  );
}

/* --------------------------------------------------------- member role -- */

export interface MemberRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: string;
  currentRole: string;
  roles: RoleRow[];
  pending: boolean;
  error?: string;
  onSubmit: (roleRef: string) => void;
}

export function MemberRoleDialog({
  open,
  onOpenChange,
  member,
  currentRole,
  roles,
  pending,
  error,
  onSubmit,
}: MemberRoleDialogProps): React.ReactElement {
  const t = useT();
  const roleOptions: SelectOption[] = roles
    .filter((role) => role.preset)
    .map((role) => ({ value: role.name, label: role.alias || role.name }));
  const [roleRef, setRoleRef] = React.useState(currentRole);

  React.useEffect(() => {
    if (open) setRoleRef(currentRole);
  }, [open, currentRole]);

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('devops.member.changeRoleTitle')}
      description={t('devops.member.changeRoleDescription', { name: member })}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={t('common.save')}
      submitAiId="devops:member-role-submit"
      onSubmit={() => onSubmit(roleRef)}
    >
      <FormField htmlFor="devops-member-role-change" label={t('devops.member.role')}>
        <Select value={roleRef} options={roleOptions} onValueChange={setRoleRef} data-ai-id="devops:member-role-select" />
      </FormField>
    </DialogFrame>
  );
}

/* ------------------------------------------------------- code repository -- */

export interface CodeRepoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
  error?: string;
  onSubmit: (draft: { name: string; provider: string; url: string; secretName: string; description: string }) => void;
}

const PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket' },
  { value: 'gitee', label: 'Gitee' },
  { value: 'svn', label: 'SVN' },
];

export function CodeRepoFormDialog({
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: CodeRepoFormDialogProps): React.ReactElement {
  const t = useT();
  const [name, setName] = React.useState('');
  const [provider, setProvider] = React.useState('github');
  const [url, setUrl] = React.useState('');
  const [secretName, setSecretName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [nameError, setNameError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setName('');
    setProvider('github');
    setUrl('');
    setSecretName('');
    setDescription('');
    setNameError('');
  }, [open]);

  const submit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) {
      setNameError(t('devops.validate.nameRequired'));
      return;
    }
    if (!NAME_PATTERN.test(trimmed)) {
      setNameError(t('devops.validate.namePattern'));
      return;
    }
    setNameError('');
    onSubmit({ name: trimmed, provider, url: url.trim(), secretName: secretName.trim(), description });
  };

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('devops.codeRepo.createTitle')}
      description={t('devops.codeRepo.createDescription')}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={t('common.create')}
      submitAiId="devops:coderepo-form-submit"
      onSubmit={submit}
    >
      <TextField
        id="devops-coderepo-name"
        label={t('devops.field.name')}
        value={name}
        maxLength={63}
        autoFocus
        aiId="devops:coderepo-form-name"
        onChange={setName}
        {...(nameError ? { error: nameError } : {})}
      />
      <FormField htmlFor="devops-coderepo-provider" label={t('devops.detail.repoProvider')}>
        <Select value={provider} options={PROVIDER_OPTIONS} onValueChange={setProvider} data-ai-id="devops:coderepo-form-provider" />
      </FormField>
      <TextField id="devops-coderepo-url" label={t('devops.detail.repoURL')} value={url} aiId="devops:coderepo-form-url" onChange={setUrl} />
      <TextField
        id="devops-coderepo-secret"
        label={t('devops.codeRepo.secret')}
        hint={t('devops.codeRepo.secretHint')}
        value={secretName}
        aiId="devops:coderepo-form-secret"
        onChange={setSecretName}
      />
      <FormField htmlFor="devops-coderepo-description" label={t('resource.field.description')}>
        <Textarea id="devops-coderepo-description" value={description} rows={2} maxLength={256} {...actionProps('devops:coderepo-form-description')} onChange={(event) => setDescription(event.target.value)} />
      </FormField>
    </DialogFrame>
  );
}

/* --------------------------------------------------------------- CD list -- */

export interface CdAllowlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: DevopsProjectSummary;
  pending: boolean;
  error?: string;
  onSubmit: (next: { sourceRepos: string[]; destinations: { name: string; namespace: string; server: string }[] }) => void;
}

/**
 * The CD allow-list editor.
 *
 * The old console's dialog picked repositories and clusters from live lists; this one
 * edits the same two spec.argo arrays as text, because the cluster it runs against has no
 * code repositories to pick from yet and a picker over an empty list would make the
 * capability look unavailable. The wildcard keeps its meaning: the whole set.
 */
export function CdAllowlistDialog({
  open,
  onOpenChange,
  project,
  pending,
  error,
  onSubmit,
}: CdAllowlistDialogProps): React.ReactElement {
  const t = useT();
  const [repos, setRepos] = React.useState('');
  const [destinations, setDestinations] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setRepos(project.sourceRepos.join('\n'));
    setDestinations(project.destinations.map((entry) => entry.name + '/' + entry.namespace).join('\n'));
  }, [open, project]);

  const submit = (): void => {
    const sourceRepos = repos
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    const nextDestinations = destinations
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, namespace] = line.split('/');
        return { name: name ?? '', namespace: namespace ?? '', server: '' };
      });
    onSubmit({ sourceRepos, destinations: nextDestinations });
  };

  return (
    <DialogFrame
      open={open}
      onOpenChange={onOpenChange}
      title={t('devops.cd.allowlistTitle')}
      description={t('devops.cd.allowlistDescription')}
      pending={pending}
      {...(error ? { error } : {})}
      submitLabel={t('common.save')}
      submitAiId="devops:cd-allowlist-submit"
      onSubmit={submit}
    >
      <FormField htmlFor="devops-cd-repos" label={t('devops.cd.sourceRepos')} hint={t('devops.cd.onePerLine')}>
        <Textarea id="devops-cd-repos" value={repos} rows={4} {...actionProps('devops:cd-allowlist-repos')} onChange={(event) => setRepos(event.target.value)} />
      </FormField>
      <FormField htmlFor="devops-cd-destinations" label={t('devops.cd.destinations')} hint={t('devops.cd.destinationsHint')}>
        <Textarea id="devops-cd-destinations" value={destinations} rows={4} {...actionProps('devops:cd-allowlist-destinations')} onChange={(event) => setDestinations(event.target.value)} />
      </FormField>
    </DialogFrame>
  );
}
