import React, { useState, useEffect, useCallback } from 'react';
import { tableStore, TableOrder, TableStatus } from '../lib/tableStore';
import { TableOrderModal } from '../TableOrderModal';

export function TableView() {
  const [tables, setTables] = useState<Map<number, TableOrder | null>>(new Map());
  const [selectedFloor, setSelectedFloor] = useState<1 | 2>(1);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);

  const updateTables = useCallback(() => {
    setTables(tableStore.getTablesByFloor(selectedFloor));
  }, [selectedFloor]);

  useEffect(() => {
    updateTables();
    return tableStore.subscribe(updateTables);
  }, [updateTables]);

  const getTableStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'available': return 'bg-green-100 border-green-300';
      case 'occupied': return 'bg-red-100 border-red-300';
      case 'reserved': return 'bg-yellow-100 border-yellow-300';
      default: return 'bg-gray-100 border-gray-300';
    }
  };

  const getTableStatusText = (status: TableStatus) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'occupied': return 'Ocupada';
      case 'reserved': return 'Reservada';
      default: return 'Desconocido';
    }
  };

  const handleTableClick = (tableNumber: number) => {
    setSelectedTable(tableNumber);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-bold text-2xl text-gray-900">Vista de Mesas</h2>
          <p className="text-sm text-gray-600">Gestión de mesas del restaurante.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedFloor(1)}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedFloor === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Primer Piso
          </button>
          <button
            onClick={() => setSelectedFloor(2)}
            className={`px-4 py-2 rounded-lg font-medium ${
              selectedFloor === 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            Segundo Piso
          </button>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Mesas Ocupadas</h3>
          <p className="text-2xl font-bold text-red-600">{tableStore.getOccupiedTablesCount()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Consumo Actual</h3>
          <p className="text-2xl font-bold text-green-600">${tableStore.getTotalRevenue().toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Ventas del Día</h3>
          <p className="text-2xl font-bold text-blue-600">${tableStore.getTodayRevenue().toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <h3 className="font-semibold text-gray-900">Mesas Disponibles</h3>
          <p className="text-2xl font-bold text-gray-600">{42 - tableStore.getOccupiedTablesCount()}</p>
        </div>
      </div>

      {/* Grid de Mesas */}
      <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
        {Array.from(tables.entries()).map(([tableNumber, order]) => {
          const status = order ? order.status : 'available';
          return (
            <div
              key={tableNumber}
              onClick={() => handleTableClick(tableNumber)}
              className={`aspect-square rounded-lg border-2 p-3 cursor-pointer hover:shadow-lg transition-shadow ${getTableStatusColor(status)}`}
            >
              <div className="h-full flex flex-col justify-between">
                <div className="text-center">
                  <div className="font-bold text-lg">{tableNumber}</div>
                  <div className="text-sm">{getTableStatusText(status)}</div>
                </div>
                {order && (
                  <div className="text-xs text-center">
                    <div>{order.waiterName}</div>
                    <div>${order.total.toLocaleString()}</div>
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