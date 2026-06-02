export interface Zone {
  name: string;
  fee: number;
}

export const zones: Zone[] = [
  { name: 'Centro', fee: 5000 },
  { name: 'Vecinos', fee: 3000 },
  { name: 'Vecinos', fee: 4000 },
  { name: 'Sur Cerca', fee: 5000 },
  { name: 'Sur Lejos', fee: 6000 },
  { name: 'Norte Cerca', fee: 7000 },
  { name: 'Norte Lejos', fee: 8000 },
  { name: 'Oriente', fee: 5000 },
  { name: 'Oriente Mediano', fee: 7000 },
  { name: 'Oriente Lejos', fee: 8000 },
  { name: 'Fuera de la Ciudad', fee: 10000 },
];