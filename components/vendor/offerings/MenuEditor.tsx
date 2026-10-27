'use client';

import { Plus, Trash2 } from 'lucide-react';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { COURSE_SUGGESTIONS, DIETS, DIET_LABELS, MENU_LIMITS, type Diet } from '@/lib/venue/menu';

// The menu of a "Food & catering" item (Phase 4, lib/venue/menu.ts): its food type, its dishes by course, and the extras the
// business allows on a quotation. Rows are kept as typed (strings); the server cleans and checks them.
export type DishRow = { course: string; name: string };
export type ExtraRow = { name: string; price: string; perPlate: boolean };
export type MenuForm = { diet: Diet | ''; dishes: DishRow[]; extras: ExtraRow[] };

export const emptyMenuForm = (): MenuForm => ({ diet: '', dishes: [{ course: 'Starters', name: '' }], extras: [] });

const DIET_OPTIONS = [{ value: '', label: 'Not said' }, ...DIETS.map((d) => ({ value: d, label: DIET_LABELS[d] }))];
const small = 'flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--color-border-default)] px-3 text-sm font-medium text-[var(--color-text-primary)] disabled:opacity-50';
const remove = 'mt-6 flex min-h-11 min-w-11 items-center justify-center rounded-lg text-[var(--color-text-muted)]';

export default function MenuEditor({ value, onChange, errors }: { value: MenuForm; onChange: (next: MenuForm) => void; errors: Record<string, string | undefined> }) {
  const setDish = (i: number, patch: Partial<DishRow>) => onChange({ ...value, dishes: value.dishes.map((d, n) => (n === i ? { ...d, ...patch } : d)) });
  const setExtra = (i: number, patch: Partial<ExtraRow>) => onChange({ ...value, extras: value.extras.map((x, n) => (n === i ? { ...x, ...patch } : x)) });
  // A new dish starts in the same course as the one above it, so a business types a course's dishes one after another.
  const addDish = () => onChange({ ...value, dishes: [...value.dishes, { course: value.dishes.at(-1)?.course || 'Main course', name: '' }] });

  return (
    <div className="space-y-4 rounded-lg bg-[var(--color-bg-surface-muted)] p-3">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">The menu</p>
      <Select label="Food type" value={value.diet} onChange={(ev) => onChange({ ...value, diet: ev.target.value as MenuForm['diet'] })} error={errors.diet} options={DIET_OPTIONS} className="min-h-12 text-base" />

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text-primary)]">Dishes <span className="font-normal text-[var(--color-text-muted)]">— by course</span></legend>
        <datalist id="menu-courses">{COURSE_SUGGESTIONS.map((c) => <option key={c} value={c} />)}</datalist>
        {value.dishes.map((d, i) => (
          <div key={i} className="grid grid-cols-[8rem_minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto]">
            <Input label={i === 0 ? 'Course' : undefined} aria-label={`Course of dish ${i + 1}`} list="menu-courses" value={d.course} onChange={(ev) => setDish(i, { course: ev.target.value })} error={errors[`menu.dishes.${i}.course`]} maxLength={MENU_LIMITS.courseMax} className="min-h-11 px-2.5 text-sm" />
            <Input label={i === 0 ? 'Dish' : undefined} aria-label={`Dish ${i + 1}`} value={d.name} onChange={(ev) => setDish(i, { name: ev.target.value })} error={errors[`menu.dishes.${i}.name`]} placeholder="Paneer tikka" maxLength={MENU_LIMITS.nameMax} className="min-h-11 text-base" />
            <button type="button" aria-label={`Remove dish ${i + 1}`} onClick={() => onChange({ ...value, dishes: value.dishes.filter((_, n) => n !== i) })} className={i === 0 ? remove : remove.replace('mt-6 ', '')}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        {errors['menu.dishes'] && <p role="alert" className="text-xs text-[var(--color-danger-text)]">{errors['menu.dishes']}</p>}
        {value.dishes.length < MENU_LIMITS.maxDishes && (
          <button type="button" onClick={addDish} className={small}><Plus className="h-4 w-4" aria-hidden /> Add a dish</button>
        )}
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-[var(--color-text-primary)]">Extras you allow <span className="font-normal text-[var(--color-text-muted)]">— the only additions a quotation can make to this menu</span></legend>
        {value.extras.length === 0 && <p className="text-xs text-[var(--color-text-muted)]">For example: Live chaat counter ₹120 per plate · Paan counter ₹5,000</p>}
        {value.extras.map((x, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] p-2.5">
            <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_auto] items-start gap-2">
              <Input label="Extra" value={x.name} onChange={(ev) => setExtra(i, { name: ev.target.value })} error={errors[`menu.extras.${i}.name`]} placeholder="Live chaat counter" maxLength={MENU_LIMITS.nameMax} className="min-h-11 text-base" />
              <Input label="Price (₹)" inputMode="numeric" value={x.price} onChange={(ev) => setExtra(i, { price: ev.target.value })} error={errors[`menu.extras.${i}.price`]} placeholder="120" className="min-h-11 text-base" />
              <button type="button" aria-label={`Remove extra ${i + 1}`} onClick={() => onChange({ ...value, extras: value.extras.filter((_, n) => n !== i) })} className={remove}>
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <label className="flex min-h-11 items-center gap-3 text-sm text-[var(--color-text-primary)]">
              <input type="checkbox" checked={x.perPlate} onChange={(ev) => setExtra(i, { perPlate: ev.target.checked })} className="h-5 w-5" />
              Price is per plate (otherwise one fixed price)
            </label>
          </div>
        ))}
        {errors['menu.extras'] && <p role="alert" className="text-xs text-[var(--color-danger-text)]">{errors['menu.extras']}</p>}
        {value.extras.length < MENU_LIMITS.maxExtras && (
          <button type="button" onClick={() => onChange({ ...value, extras: [...value.extras, { name: '', price: '', perPlate: true }] })} className={small}>
            <Plus className="h-4 w-4" aria-hidden /> Add an extra
          </button>
        )}
      </fieldset>
    </div>
  );
}
