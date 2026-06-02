import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createOrder } from '../lib/orderStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Trash2, Plus, MapPin, CreditCard, ShoppingBasket, MessageSquare } from 'lucide-react';

const ZONAS = [
  { id: 'vecinos', nombre: 'Vecinos', precio: 3000 },
  { id: 'vecinos', nombre: 'Vecinos', precio: 4000 },
  { id: 'centro', nombre: 'Centro', precio: 5000 },
  { id: 'centro lejos', nombre: 'Centro lejos', precio: 6000 },
  { id: 'sur lejos', nombre: 'Sur lejos', precio: 6000 },
  { id: 'sur cerca', nombre: 'Sur cerca', precio: 5000 },
  { id: 'norte', nombre: 'Norte', precio: 7000 },
  { id: 'norte cerca', nombre: 'Norte cerca', precio: 6000 },
  { id: 'norte lejos', nombre: 'Norte lejos', precio: 8000 },
  { id: 'oriente', nombre: 'Oriente', precio: 6000 },
  { id: 'oriente lejos', nombre: 'Oriente lejos', precio: 8000 },
  { id: 'palermo', nombre: 'Palermo', precio: 10000 },
  { id: 'domicilio', nombre: 'domicilio 0 ', precio: 0 },
];

export function NewOrder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // ESTADOS: La clave del tiempo real
  const [zona, setZona] = useState(ZONAS[0]);
  const [metodoPago, setMetodoPago] = useState<'cash' | 'transfer'>('cash');
  const [items, setItems] = useState([{ name: '', quantity: 1, price: 0 }]);
  const [cliente, setCliente] = useState({ nombre: '', direccion: '', tel: '', notas: '' });

  // CÁLCULO EN TIEMPO REAL (useMemo para eficiencia)
  const { subtotal, total } = useMemo(() => {
    const sub = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
    return { subtotal: sub, total: sub + zona.precio };
  }, [items, zona]);

  const updateItem = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleQuickAdd = (name: string, price: number) => {
    setItems([...items, { name, quantity: 1, price }]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (subtotal === 0) return alert("Agrega al menos un producto");
    setLoading(true);
    try {
      await createOrder({
        customerName: cliente.nombre,
        address: cliente.direccion,
        phone: cliente.tel,
        items,
        zone: zona.nombre,
        deliveryFee: zona.precio,
        total,
        paymentMethod: metodoPago,
        observations: cliente.notas,
        status: 'pending'
      });
      navigate('/');
    } catch (error) {
      console.error(error);
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-8 bg-slate-50 min-h-screen">
      
      {/* 1. INFO CLIENTE */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
          <MapPin className="text-amber-500 w-5 h-5" /> Datos de Envío
        </h2>
        <Card className="p-5 border-none shadow-sm space-y-3">
          <Input placeholder="Nombre del cliente" value={cliente.nombre} onChange={e => setCliente({...cliente, nombre: e.target.value})} className="bg-slate-50 border-none h-12 text-lg" />
          <Input placeholder="Dirección completa" value={cliente.direccion} onChange={e => setCliente({...cliente, direccion: e.target.value})} className="bg-slate-50 border-none h-12" />
          <Input placeholder="Teléfono" type="tel" value={cliente.tel} onChange={e => setCliente({...cliente, tel: e.target.value})} className="bg-slate-50 border-none h-12" />
        </Card>
      </section>

      {/* 2. PRODUCTOS ELEGANTES */}
      <section className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            <ShoppingBasket className="text-amber-500 w-5 h-5" /> Pedido
          </h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => handleQuickAdd('Pollo Entero', 32000)} className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">+ Pollo Entero Asado</button>
            <button type="button" onClick={() => handleQuickAdd('Medio Pollo', 18000)} className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">+ Medio Pollo Asado</button>
            <button type="button" onClick={() => handleQuickAdd('Promoción', 42000)} className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">+ Promoción</button>
            <button type="button" onClick={() => handleQuickAdd('1/4 Pollo', 12000)} className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">+ 1/4 Pollo Asado</button>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => (
            <Card key={idx} className="p-4 border-none shadow-sm flex items-center gap-3">
              <div className="flex-1 space-y-1">
                <input value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} placeholder="Producto" className="w-full font-bold bg-transparent outline-none" />
                <div className="flex text-sm text-slate-400 gap-2">
                  <span>Cant:</span>
                  <input type="number" value={item.quantity} onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value))} className="w-12 bg-slate-100 rounded px-1 text-slate-900" />
                  <span>Precio:</span>
                  <input type="number" value={item.price} onChange={e => updateItem(idx, 'price', parseFloat(e.target.value))} className="w-20 bg-slate-100 rounded px-1 text-slate-900" />
                </div>
              </div>
              <button type="button" onClick={() => setItems(items.filter((_, i) => i !== idx))} className="text-slate-300 hover:text-red-500 transition-colors">
                <Trash2 size={18} />
              </button>
            </Card>
          ))}
          <Button type="button" variant="ghost" onClick={() => handleQuickAdd('', 0)} className="w-full border-2 border-dashed border-slate-200 text-slate-400 h-14">
            + Agregar otro producto
          </Button>
        </div>
      </section>

      {/* 3. ZONAS (BOTONES GRANDES) */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Zona de Domicilio</h2>
        <div className="grid grid-cols-2 gap-3">
          {ZONAS.map(z => (
            <button
              key={z.id}
              type="button"
              onClick={() => setZona(z)}
              className={`p-4 rounded-2xl border-2 text-left transition-all ${zona.id === z.id ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100' : 'border-white bg-white text-slate-400 shadow-sm'}`}
            >
              <div className={`font-bold ${zona.id === z.id ? 'text-amber-900' : 'text-slate-600'}`}>{z.nombre}</div>
              <div className="text-xs opacity-60">${z.precio.toLocaleString()}</div>
            </button>
          ))}
        </div>
      </section>

      {/* 4. MÉTODO DE PAGO */}
      <section className="space-y-4">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Método de Pago</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setMetodoPago('cash')}
            className={`p-4 rounded-2xl border-2 transition-all ${metodoPago === 'cash' ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100 text-amber-900' : 'border-white bg-white text-slate-500 shadow-sm'}`}
          >
            Efectivo
          </button>
          <button
            type="button"
            onClick={() => setMetodoPago('transfer')}
            className={`p-4 rounded-2xl border-2 transition-all ${metodoPago === 'transfer' ? 'border-amber-500 bg-amber-50 shadow-md shadow-amber-100 text-amber-900' : 'border-white bg-white text-slate-500 shadow-sm'}`}
          >
            Transferencia
          </button>
        </div>
      </section>

      {/* 4. TOTAL FLOTANTE / RESUMEN */}
      <section className="bg-slate-900 text-white p-6 rounded-[2rem] shadow-xl space-y-4">
        <div className="flex justify-between text-slate-400 text-sm">
          <span>Subtotal</span>
          <span>${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex justify-between text-slate-400 text-sm">
          <span>Domicilio ({zona.nombre})</span>
          <span>${zona.precio.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center pt-2">
          <span className="text-xl font-bold">Total a Cobrar</span>
          <span className="text-3xl font-black text-amber-400">${total.toLocaleString()}</span>
        </div>
        
        <Button 
          onClick={handleSubmit} 
          disabled={loading}
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-black h-16 rounded-2xl text-xl shadow-lg shadow-amber-900/20"
        >
          {loading ? 'GUARDANDO...' : 'CONFIRMAR PEDIDO'}
        </Button>
      </section>
    </div>
  );
}