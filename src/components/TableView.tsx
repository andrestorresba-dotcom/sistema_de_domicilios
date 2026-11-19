import React, { useState, useEffect } from 'react';
import { tableStore, TableStatus } from '../lib/tableStore';
import { TableOrderModal } from '../TableOrderModal';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, where, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore'; 

export function TableView() {
  const [tables, setTables] = useState<Map<number, any>>(new Map());
  const [todaySales, setTodaySales] = useState<any[]>([]); 
  const [selectedFloor, setSelectedFloor] = useState<1 | 2>(1);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  // Lo último que envió el lector, para ver en pantalla si está leyendo bien
  const [lastScan, setLastScan] = useState<{ code: string; enter: boolean; at: number } | null>(null);

  // 🎯 EFECTO 1: Escuchar el lector de códigos de barras
  // El lector funciona como un teclado: "escribe" el número muy rápido y termina con Enter (o Tab).
  useEffect(() => {
    // Máximo tiempo entre teclas de una misma lectura. Antes era 50 ms y algunos
    // lectores (o el lector conectado por un hub USB) son más lentos: la lectura se
    // partía, se perdía el Enter y la mesa no se liberaba.
    const MAX_GAP_MS = 150;
    // Si el lector no envía Enter, mostramos el aviso pasado este tiempo
    const NO_SUFFIX_MS = 400;

    let scannedBuffer = '';
    let lastKeyTime = 0;
    let noSuffixTimer: ReturnType<typeof setTimeout> | undefined;

    const isTypingField = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    // Toma el dígito por la tecla física, así no importa la distribución del teclado
    // ni si el lector usa los números de arriba o los del teclado numérico.
    const digitFrom = (e: KeyboardEvent) => {
      const m = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
      if (m) return m[1];
      return e.key >= '0' && e.key <= '9' && e.key.length === 1 ? e.key : null;
    };

    const finish = async (code: string, enter: boolean) => {
      setLastScan({ code, enter, at: Date.now() });
      if (!enter) return;
      const tableNumberScanned = parseInt(code, 10);
      // Validamos que el número leído corresponda al rango de mesas (1 a 42)
      if (!isNaN(tableNumberScanned) && tableNumberScanned >= 1 && tableNumberScanned <= 42) {
        if (window.confirm(`¿Confirmar pago y liberar automáticamente la Mesa #${tableNumberScanned}?`)) {
          await autoCompleteAndReleaseTable(tableNumberScanned);
        }
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      // Si alguien está escribiendo en un campo (nombre, cantidad, observaciones…), no es el lector.
      if (isTypingField(e.target)) return;

      const now = Date.now();
      if (now - lastKeyTime > MAX_GAP_MS) scannedBuffer = '';
      lastKeyTime = now;

      // El lector terminó de leer
      if (e.key === 'Enter' || e.key === 'Tab') {
        clearTimeout(noSuffixTimer);
        if (scannedBuffer.length > 0) {
          e.preventDefault();
          const code = scannedBuffer;
          scannedBuffer = '';
          await finish(code, true);
        }
        return;
      }

      const digit = digitFrom(e);
      if (digit) {
        scannedBuffer += digit;
        clearTimeout(noSuffixTimer);
        // Si no llega Enter, avisamos en pantalla que el lector no lo está enviando
        noSuffixTimer = setTimeout(() => {
          if (scannedBuffer) {
            const code = scannedBuffer;
            scannedBuffer = '';
            finish(code, false);
          }
        }, NO_SUFFIX_MS);
      }
    };

    // Función interna que gestiona el cobro y liberación en Firebase
    const autoCompleteAndReleaseTable = async (tableNum: number) => {
      try {
        const docRef = doc(db, 'mesas', tableNum.toString());
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const uniqueVentaId = `${tableNum}-${Date.now()}`;
          
          const ventaData = {
            id: uniqueVentaId,
            tableNumber: tableNum,
            floor: data.floor || (tableNum <= 26 ? 1 : 2),
            waiterName: data.waiterName || 'Escáner Código Barras',
            items: data.items || [],
            total: data.total || 0,
            observations: data.observations || '',
            status: 'completed',
            completedAt: new Date().toISOString()
          };

          // 1. Guardamos una copia exacta en la lista histórica de ventas cobradas
          await setDoc(doc(db, 'ventas', uniqueVentaId), ventaData);
          
          // 2. Eliminamos el pedido activo de la mesa en Firebase
          await deleteDoc(docRef);

          // 3. Le avisamos a tu store local de estados para que la mesa pase a verde de inmediato
          tableStore.completeOrder(tableNum);
          
        } else {
          alert(`La mesa ${tableNum} ya está libre o no tiene pedidos guardados.`);
        }
      } catch (error) {
        console.error("Error al procesar el código de barras:", error);
        alert("Hubo un problema al liberar la mesa con el escáner.");
      }
    };

    // Escuchamos el teclado en toda la pantalla
    window.addEventListener('keydown', handleKeyDown);

    // Limpieza del evento para evitar duplicados en memoria
    return () => {
      clearTimeout(noSuffixTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 🛰️ EFECTO 2: Escucha las mesas en tiempo real (Para ponerlas rojas o verdes)
  useEffect(() => {
    const totalMesas = 42; 
    const q = query(collection(db, 'mesas'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updatedTables = new Map<number, any>();
      
      for (let i = 1; i <= totalMesas; i++) {
        updatedTables.set(i, null);
      }

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const tableNum = Number(doc.id);

        if (data.status !== 'available') {
          updatedTables.set(tableNum, {
            id: doc.id,
            status: data.status || 'occupied',
            waiterName: data.waiterName || '',
            total: Number(data.total) || 0,
            floor: data.floor ? Number(data.floor) : (tableNum <= 26 ? 1 : 2),
            items: data.items || []
          });
        }
      });

      setTables(updatedTables);
    }, (error) => {
      console.error("Error al sincronizar mesas:", error);
    });

    return () => unsubscribe();
  }, []);

  // 🛰️ EFECTO 3: Escucha la colección 'ventas' (Optimizado para el cierre de caja de hoy)
  useEffect(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const q = query(
      collection(db, 'ventas'),
      where('completedAt', '>=', startOfToday.toISOString())
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesArray: any[] = [];

      snapshot.docs.forEach((doc) => {
        salesArray.push(doc.data());
      });

      setTodaySales(salesArray);
    }, (error) => {
      console.error("Error al sincronizar las ventas del cierre de caja:", error);
    });

    return () => unsubscribe();
  }, []);

  // Métodos de cálculo dinámico
  const getOccupiedCount = () => {
    let count = 0;
    tables.forEach((order, tableNumber) => {
      const belongsToFloor = selectedFloor === 1 ? tableNumber <= 26 : tableNumber > 26;
      if (belongsToFloor && order && order.status === 'occupied') count++;
    });
    return count;
  };

  const getTotalRevenue = () => {
    let total = 0;
    tables.forEach((order, tableNumber) => {
      // Corregido a <= 26 para que sume también el consumo de las mesas de llevar (23 a 26)
      const belongsToFloor = selectedFloor === 1 ? tableNumber <= 26 : tableNumber > 26;
      if (belongsToFloor && order && order.status === 'occupied') total += order.total;
    });
    return total;
  };

  const getTodayRevenue = () => {
    return todaySales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  };

  const getTableStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'occupied': return 'bg-red-100 border-red-300';
      case 'reserved': return 'bg-yellow-100 border-yellow-300';
      case 'available': default: return 'bg-green-100 border-green-300';
    }
  };

  const getTableStatusText = (status: TableStatus) => {
    switch (status) {
      case 'occupied': return 'Ocupada';
      case 'reserved': return 'Reservada';
      case 'available': default: return 'Disponible';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Vista de Mesas</h2>
          <p className="text-sm text-gray-600">Gestión de mesas del restaurante.</p>
          <ScanStatus lastScan={lastScan} />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedFloor(1)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedFloor === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Primer Piso
          </button>
          <button
            onClick={() => setSelectedFloor(2)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${selectedFloor === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
          >
            Segundo Piso
          </button>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Mesas Ocupadas</h3>
          <p className="text-2xl font-bold text-red-600">{getOccupiedCount()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Consumo Actual</h3>
          <p className="text-2xl font-bold text-green-600">${getTotalRevenue().toLocaleString('es-CO')}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Ventas del Día</h3>
          <p className="text-2xl font-bold text-blue-600">${getTodayRevenue().toLocaleString('es-CO')}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Mesas Disponibles</h3>
          <p className="text-2xl font-bold text-gray-600">{(selectedFloor === 1 ? 26 : 16) - getOccupiedCount()}</p>
        </div>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {Array.from(tables.entries())
          .filter(([tableNumber]) => selectedFloor === 1 ? tableNumber <= 26 : tableNumber > 26)
          .map(([tableNumber, order]) => {
            const status = order ? order.status : 'available';
            return (
              <div
                key={tableNumber}
                onClick={() => setSelectedTable(tableNumber)}
                className={`aspect-square rounded-lg border-2 p-3 cursor-pointer hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 ${getTableStatusColor(status)}`}
              >
                <div className="h-full flex flex-col justify-between">
                  <div className="text-center">
                    <div className="font-bold text-lg">{tableNumber}</div>
                    <div className="text-sm font-medium">{getTableStatusText(status)}</div>
                  </div>
                  {order && order.status === 'occupied' && (
                    <div className="text-xs text-center border-t border-red-200 pt-1 mt-1">
                      <div className="font-semibold text-gray-800 truncate">{order.waiterName}</div>
                      <div className="text-red-700 font-bold">${order.total.toLocaleString('es-CO')}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {selectedTable && (
        <TableOrderModal
          tableNumber={selectedTable}
          floor={selectedFloor}
          onClose={() => setSelectedTable(null)}
        />
      )}
    </div>
  );
}
function ScanStatus({ lastScan }: { lastScan: { code: string; enter: boolean; at: number } | null }) {
  if (!lastScan) {
    return <p className="mt-1 text-xs text-gray-400">Lector de código de barras: listo. Escanea el ticket para liberar la mesa.</p>;
  }
  const time = new Date(lastScan.at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  if (lastScan.enter) {
    return (
      <p className="mt-1 text-xs text-green-700">
        Lector: leyó <b>{lastScan.code}</b> a las {time}.
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-red-700">
      Lector: leyó <b>{lastScan.code}</b> pero no envió Enter, por eso no se liberó la mesa. Configura el lector
      para que agregue Enter (CR) al final de cada lectura.
    </p>
  );
}
