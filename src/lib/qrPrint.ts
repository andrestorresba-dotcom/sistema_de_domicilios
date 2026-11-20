import QRCode from 'qrcode';

/** Hoja carta con los QR de las mesas (4 por fila), lista para imprimir y recortar */
export async function printMesaQRs(from: number, to: number, origin = window.location.origin) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write('<p style="font-family:sans-serif">Generando códigos…</p>');
  const cards: string[] = [];
  for (let n = from; n <= to; n++) {
    const url = `${origin}/mesa/${n}`;
    const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
    cards.push(`
      <div class="card">
        <div class="brand">Asadero de Pollo Ventilador</div>
        <div class="qr">${svg}</div>
        <div class="mesa">Mesa ${n}</div>
        <div class="hint">Escanea, mira la carta y pide desde tu celular</div>
      </div>`);
  }
  w.document.open();
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>QR de mesas ${from}–${to}</title>
<style>
  @page { size: letter; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, sans-serif; color: #111; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
  .card { border: 1px dashed #999; border-radius: 4mm; padding: 5mm; text-align: center; break-inside: avoid; }
  .brand { font-size: 9pt; letter-spacing: .08em; text-transform: uppercase; color: #555; }
  .qr svg { width: 42mm; height: 42mm; margin: 3mm auto; display: block; }
  .mesa { font-size: 20pt; font-weight: 700; }
  .hint { font-size: 8pt; color: #444; margin-top: 1mm; }
  .bar { padding: 10px; font-size: 14px; }
  @media print { .bar { display: none; } }
</style></head><body>
<div class="bar">Recorta cada tarjeta por la línea punteada. <button onclick="print()">Imprimir</button></div>
<div class="grid">${cards.join('')}</div>
<script>setTimeout(() => print(), 300)</script>
</body></html>`);
  w.document.close();
  return true;
}
