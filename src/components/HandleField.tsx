import { HANDLE_MAX, HANDLE_MIN, normalizeHandleInput } from "@/lib/auth/profile";

export function HandleField({
  value,
  onChange,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  hint: string;
}) {
  return (
    <label className="block">
      <span className="field-label">Handle</span>
      <span className="field mt-2 flex items-center gap-1">
        <span className="select-none text-muted" aria-hidden="true">
          @
        </span>
        <input
          name="handle"
          type="text"
          autoComplete="username"
          required
          minLength={HANDLE_MIN}
          maxLength={HANDLE_MAX}
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(normalizeHandleInput(event.target.value))}
          className="min-w-0 flex-1 bg-transparent p-0 text-[0.9rem] text-paper outline-none"
          placeholder="ada"
        />
      </span>
      <span className="mt-1.5 block text-xs text-muted">{hint}</span>
    </label>
  );
}
