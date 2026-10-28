import type { ReactNode } from 'react';
import { Lock, X } from 'lucide-react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">{title}</h2>
        {subtitle && <p className="text-gray-500 mt-1 first-letter:uppercase">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  amber: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  gray: 'bg-gray-100 text-gray-500',
  purple: 'bg-purple-50 text-purple-600',
};

export function StatCard({
  icon,
  label,
  value,
  hint,
  tone = 'amber',
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: keyof typeof TONES;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${TONES[tone]}`}>{icon}</div>
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-2xl font-bold text-gray-900 mt-0.5">{value}</div>
      {hint && <div className="text-sm text-gray-400 mt-0.5">{hint}</div>}
    </div>
  );
}

export function Card({ title, icon, children, actions }: { title?: string; icon?: ReactNode; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {title && (
        <div className="flex items-center justify-between gap-2 mb-4">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            {icon}
            {title}
          </h3>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function ReadOnlyBadge({ text = 'Solo el administrador puede modificar' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
      <Lock className="w-4 h-4" />
      {text}
    </span>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto p-6`}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Cerrar">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white disabled:opacity-60';
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-500 text-white font-semibold px-4 py-2.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium px-4 py-2.5 transition-colors disabled:opacity-50';
export const btnDanger =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2.5 transition-colors disabled:opacity-50';

/** Convierte "12.000" o "12000" en 12000 */
export const parseMoney = (v: string) => Number(v.replace(/[^\d]/g, '')) || 0;
