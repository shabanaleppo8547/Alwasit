import { SelectField } from './forms';

export type TargetOption = { yearName: string; subjects: { id: string; title: string; bundles: { id: string; title: string }[] }[] };

/** قائمة اختيار هدف الاشتراك: مادة كاملة أو حزمة من مادة. */
export function TargetSelect({ options, label = 'المادة أو الحزمة', id }: { options: TargetOption[]; label?: string; id?: string }) {
  return (
    <SelectField name="target" label={label} defaultValue="" id={id}>
      <option value="" disabled>
        اختر…
      </option>
      {options.map((y) => (
        <optgroup key={y.yearName} label={y.yearName}>
          {y.subjects.flatMap((s) => [
            <option key={s.id} value={`subject:${s.id}`}>
              {s.title} (كاملة)
            </option>,
            ...s.bundles.map((b) => (
              <option key={b.id} value={`bundle:${b.id}`}>
                ↳ {s.title}: {b.title}
              </option>
            )),
          ])}
        </optgroup>
      ))}
    </SelectField>
  );
}
