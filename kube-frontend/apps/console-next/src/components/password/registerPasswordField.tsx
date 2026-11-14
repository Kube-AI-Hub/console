import { InputPassword, registerFieldType } from '@kube-ai-hub/ui';
import { PasswordStrength } from './PasswordStrength';

/**
 * `password-strength` — a password field with the strength panel under it.
 *
 * Registered once, at module scope, with ai-kit's field registry: the schema layer knows how to
 * lay out a form but not how to render every field a console might need, so a page that wants
 * something the library does not ship teaches it the type. That is why this is not a fork of
 * `ResourceForm` and not a second password section in the form schema.
 *
 * The create-user dialog is the second place a password is chosen, and it has to say the same
 * thing the personal-settings dialog does: the rule, which parts are still missing, and how
 * strong the result is. Reusing the panel is what keeps the two forms from drifting apart —
 * previously this form had only the (stricter) validation and no feedback while typing.
 */
export const PASSWORD_FIELD_TYPE = 'password-strength';

/** Scope of this form's `data-ai-id` handles. */
const SCOPE = 'users';

let registered = false;

export function registerPasswordField(): void {
  // Idempotent by design (the registry replaces on re-register), but the guard keeps this cheap
  // when the dialog module is evaluated again by a hot reload.
  if (registered) return;
  registered = true;

  registerFieldType<string>(PASSWORD_FIELD_TYPE, ({ value, onChange, id, invalid, disabled, placeholder }) => (
    <div className="flex flex-col gap-2">
      <InputPassword
        id={id}
        value={value ?? ''}
        disabled={disabled}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        autoComplete="new-password"
        onChange={(event) => onChange(event.target.value)}
      />
      <PasswordStrength password={value ?? ''} scope={SCOPE} />
    </div>
  ));
}
