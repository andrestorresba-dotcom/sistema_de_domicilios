import { useState } from 'react';
import { toast } from 'sonner';
import { TrendingUp, Banknote, CreditCard, Smartphone, Receipt, DollarSign, Lock, Unlock, Printer, Plus, Trash2, ShoppingBag, CheckCircle2 } from 'lucide-react';
import { useAuth, authErrorMessage } from '../../lib/auth';
import { getFormattedTime } from '../../lib/orderStore';
import {
  PAYMENT_METHODS,
  addExpense,
  closeCaja,
  deleteExpense,
  formatCajaDate,
  formatMoney,
  reopenCaja,
  setCajaBase,
  summarize,
  todayCajaId,
  useBusinessInfo,
  useCaja,
  useExpenses,
  useSales,
} from '../../lib/posStore';
import { printCajaReport } from '../../lib/posPrint';
import { Card, Modal, PageHeader, ReadOnlyBadge, StatCard, btnDanger, btnPrimary, btnSecondary, inputCls, parseMoney } from './shared';

export function CashClose() {
  const { profile, isAdmin } = useAuth();
  const today = todayCajaId();
  const [cajaId, setCajaId] = useState(today);
  const isToday = cajaId === today;

  const caja = useCaja(cajaId);
  const sales = useSales(cajaId);
  const expenses = useExpenses(cajaId);
  const business = useBusinessInfo();

  const closed = caja?.status === 'cerrada';
  const live = summarize(sales, expenses, caja?.base ?? 0);
  // Si la caja está cerrada, se muestra la foto guardada en el cierre
  const s = closed && caja?.summary ? caja.summary : live;

  const [baseInput, setBaseInput] = useState('');
  const [exp, setExp] = useState({ description: '', amount: '', responsible: '' });
  const [confirmClose, setConfirmClose] = useState(false);

  const canAddExpense = isToday && !closed;

  const saveBase = async () => {
    if (!profile) return;
    const v = parseMoney(baseInput);
    try {
      await setCajaBase(cajaId, v, profile);
      setBaseInput('');
      toast.success(`Base guardada: ${formatMoney(v)}`);
    } catch (e) {
      toast.error(authErrorMessage(e));
    }
  };

  const saveExpense = async () => {
    if (!profile) return;
    const amount = parseMoney(exp.amount);
    if (!exp.description.trim() || amount <= 0) return toast.error('Escribe la descripción y el valor del gasto.');
    try {
      await addExpense(cajaId, { description: exp.description, amount, responsible: exp.responsible }, profile);
      setExp({ description: '', amount: '', responsible: '' });
      toast.success('Gasto registrado');
    } catch (e) {
      toast.error(authErrorMessage(e));
    }
  };

  const removeExpense = async (id: string) => {
    if (!confirm('¿Eliminar este gasto?')) return;
    try {
      await deleteExpense(id);
    } catch (e) {
      toast.error(authErrorMessage(e));
    }
  };

  const reopen = async () => {
    if (!confirm('¿Reabrir la caja? Se podrán registrar ventas y gastos otra vez y habrá que cerrarla de nuevo.')) return;
    try {
      await reopenCaja(cajaId);
      toast.success('Caja reabierta');
    } catch (e) {
      toast.error(authErrorMessage(e));
    }
  };

  const print = () =>
    printCajaReport({
      cajaId,
      business,
      summary: s,
      expenses,
      countedCash: caja?.countedCash,
      closedByName: caja?.closedByName,
      status: caja?.status ?? 'abierta',
    });

  const icons = { efectivo: Banknote, transferencia: CreditCard, nequi: Smartphone, daviplata: Smartphone };
  const tones = { efectivo: 'green', transferencia: 'blue', nequi: 'purple', daviplata: 'red' } as const;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <PageHeader
        title="Cierre de Caja"
        subtitle={formatCajaDate(cajaId)}
        actions={
          <>
            {isAdmin && (
              <input
                type="date"
                className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm"
                value={cajaId}
                max={today}
                onChange={e => e.target.value && setCajaId(e.target.value)}
                aria-label="Ver otro día"
              />
            )}
            {!isAdmin && <ReadOnlyBadge text="Base y cierre: solo administrador" />}
            <button className={btnSecondary} onClick={print}>
              <Printer className="w-4 h-4" /> Imprimir
            </button>
          </>
        }
      />

      {closed && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-green-200 bg-green-50 px-5 py-4 text-green-800">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" /> Caja cerrada{caja?.closedByName ? ` por ${caja.closedByName}` : ''}
            {caja?.closedAt ? ` a las ${getFormattedTime(caja.closedAt)}` : ''}.
          </span>
          {isAdmin && isToday && (
            <button className={btnSecondary} onClick={reopen}>
              <Unlock className="w-4 h-4" /> Reabrir
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard icon={<TrendingUp className="w-5 h-5" />} tone="green" label="Total Vendido" value={formatMoney(s.total)} hint={`${s.salesCount} ventas`} />
        {PAYMENT_METHODS.map(m => {
          const Icon = icons[m.id];
          return <StatCard key={m.id} icon={<Icon className="w-5 h-5" />} tone={tones[m.id]} label={m.label} value={formatMoney(s.byMethod[m.id] ?? 0)} />;
        })}
        <StatCard icon={<Receipt className="w-5 h-5" />} label="Ticket Promedio" value={formatMoney(s.salesCount ? s.total / s.salesCount : 0)} />
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          <Card title="Base de Caja" icon={<DollarSign className="w-5 h-5 text-amber-500" />}>
            {isAdmin && isToday && !closed ? (
              <>
                <label className="text-sm text-gray-700">Valor inicial en caja</label>
                <div className="flex gap-3 mt-1">
                  <input
                    className={inputCls}
                    inputMode="numeric"
                    placeholder="Ej: 200.000"
                    value={baseInput ? parseMoney(baseInput).toLocaleString('es-CO') : ''}
                    onChange={e => setBaseInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveBase()}
                  />
                  <button className={btnPrimary} onClick={saveBase} disabled={!baseInput}>
                    <Lock className="w-4 h-4" /> Guardar
                  </button>
                </div>
              </>
            ) : null}
            <p className="text-sm text-gray-500 mt-2">
              Base actual: <b className="text-gray-900">{formatMoney(s.base)}</b>
              {caja?.baseSetByName && <span> · registrada por {caja.baseSetByName}</span>}
            </p>
          </Card>

          <Card title="Gastos del Día">
            {canAddExpense && (
              <div className="grid sm:grid-cols-[1fr_140px_1fr_auto] gap-3 mb-5">
                <input className={inputCls} placeholder="Descripción" value={exp.description} onChange={e => setExp({ ...exp, description: e.target.value })} />
                <input
                  className={inputCls}
                  inputMode="numeric"
                  placeholder="Valor ($)"
                  value={exp.amount ? parseMoney(exp.amount).toLocaleString('es-CO') : ''}
                  onChange={e => setExp({ ...exp, amount: e.target.value })}
                />
                <input className={inputCls} placeholder={`Responsable (${profile?.name ?? ''})`} value={exp.responsible} onChange={e => setExp({ ...exp, responsible: e.target.value })} />
                <button className={btnPrimary + ' px-3'} onClick={saveExpense} aria-label="Agregar gasto">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            )}
            {expenses.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No hay gastos registrados</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {expenses.map(e => (
                  <li key={e.id} className="flex items-center gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{e.description}</div>
                      <div className="text-xs text-gray-500">
                        {getFormattedTime(e.createdAt)} · {e.responsible}
                        {e.createdByName !== e.responsible && ` · registró ${e.createdByName}`}
                      </div>
                    </div>
                    <div className="font-semibold text-red-600">− {formatMoney(e.amount)}</div>
                    {isAdmin && !closed && (
                      <button className="p-2 rounded-lg hover:bg-red-50 text-red-500" onClick={() => removeExpense(e.id)} title="Eliminar gasto">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Resumen Final" icon={<Receipt className="w-5 h-5 text-gray-500" />}>
            <dl className="divide-y divide-gray-100">
              <div className="flex justify-between py-3">
                <dt className="text-gray-700">Total Vendido Hoy</dt>
                <dd className="font-semibold text-green-600">{formatMoney(s.total)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-700">(+) Base de Caja</dt>
                <dd className="font-semibold text-blue-600">+ {formatMoney(s.base)}</dd>
              </div>
              <div className="flex justify-between py-3">
                <dt className="text-gray-700">(−) Total Gastos</dt>
                <dd className="font-semibold text-red-600">− {formatMoney(s.expenses)}</dd>
              </div>
            </dl>
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="text-sm text-amber-800">Dinero esperado en caja</div>
              <div className="text-3xl font-bold text-amber-900">{formatMoney(s.expectedCash)}</div>
              <div className="text-sm text-amber-700">Solo efectivo + base − gastos</div>
            </div>
            {closed && caja?.countedCash !== undefined && caja?.countedCash !== null && (
              <CountResult expected={s.expectedCash} counted={caja.countedCash} />
            )}
          </Card>

          <Card title="Desglose Ventas" icon={<ShoppingBag className="w-5 h-5 text-gray-500" />}>
            <dl className="divide-y divide-gray-100">
              <div className="flex justify-between py-3">
                <dt className="text-gray-700">N° de Ventas</dt>
                <dd className="font-semibold">{s.salesCount}</dd>
              </div>
              {PAYMENT_METHODS.map(m => (
                <div key={m.id} className="flex justify-between py-3">
                  <dt className="text-gray-700">{m.label}</dt>
                  <dd className="font-semibold">{formatMoney(s.byMethod[m.id] ?? 0)}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {isAdmin && isToday && !closed && (
            <button className={btnDanger + ' w-full py-4 text-base'} onClick={() => setConfirmClose(true)}>
              <Lock className="w-5 h-5" /> Cerrar Caja
            </button>
          )}
        </div>
      </div>

      {confirmClose && <CloseModal cajaId={cajaId} summary={live} onClose={() => setConfirmClose(false)} />}
    </div>
  );
}

function CountResult({ expected, counted }: { expected: number; counted: number }) {
  const diff = counted - expected;
  const cls = diff === 0 ? 'bg-green-50 text-green-800' : diff > 0 ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800';
  return (
    <div className={`mt-3 rounded-xl px-4 py-3 text-sm ${cls}`}>
      Contado: <b>{formatMoney(counted)}</b> ·{' '}
      {diff === 0 ? 'La caja cuadra' : `${diff > 0 ? 'Sobrante' : 'Faltante'} de ${formatMoney(Math.abs(diff))}`}
    </div>
  );
}

function CloseModal({ cajaId, summary, onClose }: { cajaId: string; summary: ReturnType<typeof summarize>; onClose: () => void }) {
  const { profile } = useAuth();
  const [counted, setCounted] = useState('');
  const [busy, setBusy] = useState(false);
  const countedN = counted ? parseMoney(counted) : null;

  const submit = async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await closeCaja(cajaId, summary, countedN, profile);
      toast.success('Caja cerrada');
      onClose();
    } catch (e) {
      toast.error(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Cerrar caja de hoy" onClose={onClose}>
      <p className="text-sm text-gray-600 mb-4">
        Al cerrar, nadie podrá registrar más ventas ni gastos de hoy. Debe haber en caja{' '}
        <b className="text-gray-900">{formatMoney(summary.expectedCash)}</b> en efectivo.
      </p>
      <label className="block">
        <span className="text-sm text-gray-700">Efectivo contado (opcional)</span>
        <input className={inputCls} inputMode="numeric" autoFocus value={countedN !== null ? countedN.toLocaleString('es-CO') : ''} onChange={e => setCounted(e.target.value)} />
      </label>
      {countedN !== null && <CountResult expected={summary.expectedCash} counted={countedN} />}
      <div className="flex gap-3 mt-6">
        <button className={btnSecondary + ' flex-1'} onClick={onClose}>
          Cancelar
        </button>
        <button className={btnDanger + ' flex-1'} onClick={submit} disabled={busy}>
          <Lock className="w-4 h-4" /> Cerrar caja
        </button>
      </div>
    </Modal>
  );
}
