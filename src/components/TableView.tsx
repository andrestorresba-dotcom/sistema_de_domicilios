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

  // 🎯 EFECTO 1: Escuchar el Escáner de Códigos de Barra (Ubicado correctamente dentro del componente)
  useEffect(() => {
    let scannedBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = async (e: KeyboardEvent) => {
      const currentTime = Date.now();
      
      // ⚡ Si pasa más de 50ms entre teclas, detecta que es un humano escribiendo y lo ignora.
      if (currentTime - lastKeyTime > 50) {
        scannedBuffer = ''; 
      }
      lastKeyTime = currentTime;

      // Cuando el lector termina de leer el código de barras, siempre envía un "Enter"
      if (e.key === 'Enter') {
        if (scannedBuffer.length > 0) {
          const tableNumberScanned = parseInt(scannedBuffer);
          
          // Validamos que el número leído corresponda a tu rango de mesas (1 a 42)
          if (!isNaN(tableNumberScanned) && tableNumberScanned >= 1 && tableNumberScanned <= 42) {
            
            // Confirmación rápida en pantalla antes de proceder a la liberación automática
            if (window.confirm(`¿Confirmar pago y liberar automáticamente la Mesa #${tableNumberScanned}?`)) {
              await autoCompleteAndReleaseTable(tableNumberScanned);
            }
            
          }
          scannedBuffer = ''; // Limpiamos el acumulador para la siguiente lectura
        }
        return;
      }

      // Vamos atrapando los números correlativos que arroja el láser
      if (e.key >= '0' && e.key <= '9') {
        scannedBuffer += e.key;
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
    return () => window.removeEventListener('keydown', handleKeyDown);
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