import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  type ButtonHTMLAttributes,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Athlete, Dance, EventStatus } from '../types';
import {
  athleteDisplayName,
  athleteSubLabel,
  DANCE_INFO,
  STATUS_INFO,
} from '../lib/constants';
import { cn, formatNumber, plural } from '../lib/utils';
import {
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  InfoIcon,
  SearchIcon,
  XIcon,
} from './icons';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'success';

export function Button({
  variant = 'secondary',
  size = 'md',
  className,
  type = 'button',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
}) {
  return (
    <button
      type={type}
      className={cn(
        variant === 'primary' && 'btn-primary',
        variant === 'secondary' && 'btn-secondary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'danger' && 'btn-danger',
        variant === 'warning' && 'btn-warning',
        variant === 'success' && 'btn-success',
        size === 'sm' && 'btn-sm',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function IconButton({
  label,
  variant = 'ghost',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: 'ghost' | 'secondary' | 'danger';
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors',
        variant === 'ghost' && 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        variant === 'secondary' && 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
        variant === 'danger' && 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------

export type BadgeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'dark';

export function Badge({
  tone = 'gray',
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        tone === 'gray' && 'badge-gray',
        tone === 'blue' && 'badge-blue',
        tone === 'green' && 'badge-green',
        tone === 'amber' && 'badge-amber',
        tone === 'red' && 'badge-red',
        tone === 'dark' && 'badge-dark',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EventStatusBadge({ status }: { status: EventStatus }) {
  const info = STATUS_INFO[status];
  return <Badge tone={info.tone}>{info.label}</Badge>;
}

export function DanceTags({
  dances,
  active,
  onSelect,
  size = 'md',
}: {
  dances: Dance[];
  active?: Dance;
  onSelect?: (dance: Dance) => void;
  size?: 'md' | 'sm';
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {dances.map((dance) => {
        const isActive = active === dance;
        const content = (
          <>
            <span className="font-extrabold">{DANCE_INFO[dance].short}</span>
            <span className={cn('hidden sm:inline', isActive ? 'text-white' : 'text-slate-500')}>
              {DANCE_INFO[dance].name}
            </span>
          </>
        );
        if (!onSelect) {
          return (
            <span
              key={dance}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-700',
                size === 'sm' ? 'text-xs' : 'text-sm',
              )}
              title={DANCE_INFO[dance].name}
            >
              {content}
            </span>
          );
        }
        return (
          <button
            key={dance}
            type="button"
            onClick={() => onSelect(dance)}
            aria-pressed={isActive}
            className={cn(
              'inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors',
              size === 'sm' ? 'text-xs' : 'text-sm',
              isActive
                ? 'border-brand-700 bg-brand-700 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50',
            )}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header / layout helpers
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  badge,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold leading-tight sm:text-3xl">{title}</h1>
          {badge}
        </div>
        {description && (
          <div className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate-600">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'blue' | 'green' | 'amber' | 'gray';
}) {
  return (
    <div
      className={cn(
        'stat-card',
        tone === 'blue' && 'border-blue-200 bg-blue-50/60',
        tone === 'green' && 'border-emerald-200 bg-emerald-50/60',
        tone === 'amber' && 'border-amber-300 bg-amber-50/70',
        tone === 'gray' && 'bg-slate-50',
      )}
    >
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="mt-1 text-xs leading-snug text-slate-600">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-500">{icon}</div>}
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      {description && (
        <div className="mt-1 max-w-lg text-sm leading-relaxed text-slate-500">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Callout({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const Icon =
    tone === 'warning' ? AlertTriangleIcon : tone === 'success' ? CheckIcon : InfoIcon;
  return (
    <div
      className={cn(
        'flex gap-3 rounded-xl border p-4 text-sm',
        tone === 'info' && 'border-blue-200 bg-blue-50 text-blue-900',
        tone === 'warning' && 'border-amber-300 bg-amber-50 text-amber-900',
        tone === 'danger' && 'border-red-200 bg-red-50 text-red-900',
        tone === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-900',
      )}
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <div className="font-bold">{title}</div>}
        {children && <div className={cn('leading-relaxed', title ? 'mt-0.5' : '')}>{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}

export function ProgressBar({
  value,
  total,
  tone = 'blue',
}: {
  value: number;
  total: number;
  tone?: 'blue' | 'green' | 'amber';
}) {
  const percent = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            tone === 'blue' && 'bg-brand-600',
            tone === 'green' && 'bg-emerald-600',
            tone === 'amber' && 'bg-amber-500',
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-500">
        <span>
          {value}/{total}
        </span>
        <span>{percent}%</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({
  label,
  hint,
  error,
  required,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  htmlFor?: string;
}) {
  const generatedId = useId();
  const controlId = htmlFor ?? generatedId;
  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<{ id?: string }>, {
        id:
          (children as ReactElement<{ id?: string }>).props.id ?? controlId,
      })
    : children;
  return (
    <div>
      <label className="label" htmlFor={controlId}>
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {control}
      {error ? (
        <div className="mt-1 text-xs font-semibold text-red-700">{error}</div>
      ) : hint ? (
        <div className="hint">{hint}</div>
      ) : null}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Tìm kiếm…',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon
        size={18}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
      />
      <input
        type="search"
        className="input pl-10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white p-3',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : 'Bật/tắt'}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full border transition-colors',
          checked ? 'border-brand-700 bg-brand-700' : 'border-slate-300 bg-slate-200',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5',
          )}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{hint}</span>}
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        className={cn(
          'my-4 w-full rounded-2xl border border-slate-200 bg-white shadow-2xl sm:my-8',
          size === 'sm' && 'max-w-md',
          size === 'md' && 'max-w-2xl',
          size === 'lg' && 'max-w-4xl',
          size === 'xl' && 'max-w-6xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={id} className="text-lg font-bold leading-snug">
              {title}
            </h2>
            {description && (
              <div className="mt-1 text-sm leading-relaxed text-slate-500">{description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            <XIcon size={22} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/70 px-5 py-4 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Xác nhận',
  cancelLabel = 'Hủy',
  tone = 'danger',
  onConfirm,
  onCancel,
  children,
  busy,
}: {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary' | 'warning' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button
            variant={tone}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Athlete / numbers
// ---------------------------------------------------------------------------

export function Bib({ children, tone = 'dark' }: { children: ReactNode; tone?: 'dark' | 'light' }) {
  return (
    <span
      className={cn(
        'tabular inline-flex h-7 min-w-[42px] shrink-0 items-center justify-center rounded-md px-1.5 text-xs font-extrabold',
        tone === 'dark' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-slate-100 text-slate-700',
      )}
    >
      {children}
    </span>
  );
}

export function AthleteLabel({
  athlete,
  showSub = true,
  compact = false,
}: {
  athlete: Athlete | undefined;
  showSub?: boolean;
  compact?: boolean;
}) {
  if (!athlete) {
    return <span className="text-sm italic text-slate-500">Không tìm thấy VĐV</span>;
  }
  const sub = athleteSubLabel(athlete);
  return (
    <div className={cn('flex min-w-0 items-center gap-2.5', compact && 'gap-2')}>
      <Bib>{athlete.bib}</Bib>
      <div className="min-w-0">
        <div className={cn('truncate font-semibold text-slate-900', compact ? 'text-sm' : 'text-[15px]')}>
          {athleteDisplayName(athlete)}
        </div>
        {showSub && sub && <div className="truncate text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

export function PlaceNumber({
  place,
  tied,
  size = 'md',
}: {
  place: number;
  tied?: boolean;
  size?: 'md' | 'lg';
}) {
  return (
    <span
      className={cn(
        'tabular inline-flex items-center justify-center rounded-lg font-extrabold',
        size === 'lg' ? 'h-10 min-w-10 text-lg' : 'h-8 min-w-8 text-sm',
        tied ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-400' : 'bg-slate-100 text-slate-800',
      )}
      title={tied ? 'Hòa – cần Chủ tịch HĐ phân định' : undefined}
    >
      {place}
      {tied ? '*' : ''}
    </span>
  );
}

export function Points({ value, digits = 1 }: { value: number; digits?: number }) {
  return <span className="tabular font-bold text-slate-900">{formatNumber(value, digits)}</span>;
}

export function CountPill({
  count,
  label,
}: {
  count: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
      <span className="tabular text-sm font-extrabold text-slate-900">{count}</span>
      {label}
    </span>
  );
}

export function JudgeTick({ complete, label }: { complete: boolean; label?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 text-xs font-bold',
        complete ? 'text-emerald-700' : 'text-slate-500',
      )}
      title={complete ? 'Đã nhập đủ' : 'Chưa nhập đủ'}
    >
      <span
        className={cn(
          'inline-flex h-5 w-5 items-center justify-center rounded-full border',
          complete
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : 'border-slate-300 bg-white text-slate-500',
        )}
      >
        <CheckIcon size={12} />
      </span>
      {label}
    </span>
  );
}

export function SplitBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">{children}</div>;
}

export function Dot({ tone = 'gray' }: { tone?: 'gray' | 'blue' | 'green' | 'amber' }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        tone === 'gray' && 'bg-slate-400',
        tone === 'blue' && 'bg-brand-600',
        tone === 'green' && 'bg-emerald-600',
        tone === 'amber' && 'bg-amber-500',
      )}
    />
  );
}

export function ResultMeta({
  total,
  label,
}: {
  total: number;
  label: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <Points value={total} digits={total % 1 === 0 ? 0 : 1} />
      <span className="text-xs font-medium text-slate-500">{label}</span>
    </span>
  );
}

export function pluralText(count: number, one: string, many: string): string {
  return `${count} ${plural(count, one, many)}`;
}

export function Section({
  title,
  description,
  actions,
  children,
  className,
  id,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn('app-card', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            {title && <h2 className="text-base font-bold sm:text-lg">{title}</h2>}
            {description && <div className="mt-1 text-sm text-slate-500">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className="card-pad">{children}</div>
    </section>
  );
}

export function SelectChevron() {
  return <ChevronDownIcon size={16} />;
}
