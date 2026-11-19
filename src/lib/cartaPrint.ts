import {
  bogotaDateLabel,
  formatCOP,
  isAvailableToday,
  llevarPrice,
  priceForDay,
  type CartaConfig,
  type CartaItem,
} from './cartaStore';

export const WHATSAPP_PEDIDOS = '301 550 1038';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

interface Row {
  name: string;
  desc?: string;
  price: number;
}

/** Arma las secciones del menú del día con los precios del modo pedido */
export function buildSections(items: CartaItem[], cfg: CartaConfig, day: number, polloStock: number | null, llevar: boolean) {
  const rows = (cat: string) =>
    items
      .filter(i => i.category === cat && isAvailableToday(i, day, polloStock))
      .map<Row>(i => {
        const mesa = priceForDay(i, day) ?? i.price;
        return { name: i.name, desc: i.description, price: llevar ? llevarPrice(mesa, i, cfg) : mesa };
      });
  const featured = items.find(i => i.featured && isAvailableToday(i, day, polloStock));
  return {
    featured: featured
      ? {
          name: featured.name,
          desc: featured.description,
          price: llevar ? llevarPrice(priceForDay(featured, day) ?? featured.price, featured, cfg) : priceForDay(featured, day) ?? featured.price,
        }
      : null,
    especiales: rows('Especiales').filter(r => r.name !== featured?.name),
    pollo: rows('Pollo asado'),
    platosDia: rows('Platos del día'),
    proteinas: rows('Proteínas del corriente'),
    sancochos: rows('Sancochos'),
    infantil: rows('Menú infantil'),
    bebidas: rows('Bebidas'),
    adicionales: rows('Adicionales'),
  };
}

// ---------- Menú impreso (precios de mesa, blanco y negro) ----------

export function printMenuMesa(items: CartaItem[], cfg: CartaConfig, day: number, polloStock: number | null) {
  const s = buildSections(items, cfg, day, polloStock, false);
  const list = (rows: Row[], withDesc = true) =>
    rows
      .map(
        r => `<div class="row"><span class="n">${esc(r.name)}</span><span class="dots"></span><span class="p">${formatCOP(r.price)}</span></div>${
          withDesc && r.desc ? `<div class="d">${esc(r.desc)}</div>` : ''
        }`,
      )
      .join('');
  const section = (title: string, body: string) => (body ? `<section><h2>${title}</h2>${body}</section>` : '');
  const corriente =
    s.proteinas.length || cfg.sopa || cfg.principios.length
      ? `<section class="box"><h2>Almuerzo corriente</h2>
        ${cfg.sopa ? `<div class="kv"><b>Sopa:</b> ${esc(cfg.sopa)}</div>` : ''}
        ${cfg.principios.length ? `<div class="kv"><b>Principio:</b> ${esc(cfg.principios.join(' · '))}</div>` : ''}
        ${cfg.jugo ? `<div class="kv"><b>Jugo:</b> ${esc(cfg.jugo)}</div>` : ''}
        <div class="kv"><b>Proteína:</b></div>${list(s.proteinas, false)}</section>`
      : '';
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Menú del día</title><style>
    @page { size: letter; margin: 10mm; }
    * { box-sizing: border-box; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #000; margin: 0; }
    header { text-align: center; border-bottom: 3px double #000; padding-bottom: 6px; margin-bottom: 10px; }
    header img { height: 90px; filter: grayscale(1) contrast(1.2); }
    h1 { font-size: 34px; margin: 2px 0 0; letter-spacing: 2px; text-transform: uppercase; }
    .date { font-size: 14px; } .date::first-letter { text-transform: uppercase; }
    .cols { columns: 2; column-gap: 12mm; }
    section { break-inside: avoid; margin-bottom: 12px; }
    h2 { font-size: 17px; text-transform: uppercase; letter-spacing: 1.5px; background: #000; color: #fff; padding: 3px 10px; border-radius: 20px; display: inline-block; margin: 0 0 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .row { display: flex; align-items: baseline; gap: 6px; font-size: 14px; font-weight: bold; text-transform: uppercase; }
    .dots { flex: 1; border-bottom: 1.5px dotted #000; }
    .p { white-space: nowrap; }
    .d { font-size: 11px; font-style: italic; margin: 0 0 4px; }
    .kv { font-size: 13px; margin: 2px 0; }
    .box { border: 2px solid #000; border-radius: 10px; padding: 8px 10px; }
    .feat { border: 2px solid #000; border-radius: 12px; padding: 8px 12px; text-align: center; margin-bottom: 12px; break-inside: avoid; }
    .feat .tag { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; }
    .feat .fp { font-size: 26px; font-weight: bold; }
    .feat .fn { font-size: 18px; font-weight: bold; text-transform: uppercase; }
    footer { border-top: 3px double #000; margin-top: 8px; padding-top: 6px; text-align: center; font-size: 13px; font-style: italic; font-weight: bold; text-transform: uppercase; }
  </style></head><body>
    <header><img src="${location.origin}/logo-ventilador.png" alt=""><h1>Menú del día</h1><div class="date">${esc(bogotaDateLabel())}</div></header>
    <div class="cols">
      ${s.featured ? `<div class="feat"><div class="tag">★ Plato nuevo ★</div><div class="fp">${formatCOP(s.featured.price)}</div><div class="fn">${esc(s.featured.name)}</div><div class="d">${esc(s.featured.desc)}</div></div>` : ''}
      ${section('Especiales', list(s.especiales))}
      ${section('Platos del día', list(s.platosDia))}
      ${corriente}
      ${section('Sancochos', list(s.sancochos))}
      ${section('Menú infantil', list(s.infantil))}
      ${section('Pollo asado', list(s.pollo))}
      ${section('Bebidas', list(s.bebidas, false))}
    </div>
    <footer>Los almuerzos para llevar tienen un costo adicional de ${formatCOP(cfg.recargoLlevar)} · Domicilios WhatsApp ${WHATSAPP_PEDIDOS}</footer>
  </body></html>`;
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) {
    alert('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  w.onload = () => setTimeout(() => w.print(), 200);
}

// ---------- Imagen para WhatsApp (precios para llevar) ----------

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const FONT = "'Helvetica Neue', Helvetica, Arial, sans-serif";

export async function renderWhatsappImage(items: CartaItem[], cfg: CartaConfig, day: number, polloStock: number | null) {
  const s = buildSections(items, cfg, day, polloStock, true);
  const W = 1080;
  const H = 1920;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;

  // Fondo crema con un degradado muy suave
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#fbf6ec');
  bg.addColorStop(1, '#f3e9d6');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);

  // Encabezado oscuro
  const hg = g.createLinearGradient(0, 0, W, 300);
  hg.addColorStop(0, '#1c1410');
  hg.addColorStop(1, '#3a1d10');
  g.fillStyle = hg;
  g.fillRect(0, 0, W, 300);
  const logo = await loadImage('/logo-ventilador.png');
  if (logo) {
    const lh = 240;
    const lw = (logo.width / logo.height) * lh;
    g.drawImage(logo, 50, 30, lw, lh);
  }
  g.fillStyle = '#fff';
  g.textAlign = 'right';
  g.font = `800 82px ${FONT}`;
  g.fillText('Menú del día', W - 50, 140);
  g.font = `500 34px ${FONT}`;
  g.fillStyle = '#f5b800';
  const date = bogotaDateLabel();
  g.fillText(date.charAt(0).toUpperCase() + date.slice(1), W - 50, 196);
  g.fillStyle = 'rgba(255,255,255,.75)';
  g.font = `500 26px ${FONT}`;
  g.fillText('Precios para llevar y domicilio', W - 50, 244);
  g.textAlign = 'left';

  const colW = 470;
  const colX = [50, 560];
  const y0 = 350;
  const rowH = 46;

  const fitText = (text: string, maxW: number, size: number, weight = 600) => {
    let fs = size;
    g.font = `${weight} ${fs}px ${FONT}`;
    while (g.measureText(text).width > maxW && fs > 18) {
      fs -= 1;
      g.font = `${weight} ${fs}px ${FONT}`;
    }
  };

  const drawSection = (col: number, y: number, title: string, rows: Row[], extra?: string[]) => {
    if (!rows.length && !extra?.length) return y;
    const x = colX[col];
    g.fillStyle = '#9b1c1c';
    g.font = `800 30px ${FONT}`;
    g.fillText(title.toUpperCase(), x, y);
    g.fillStyle = '#d9a514';
    g.fillRect(x, y + 12, 60, 4);
    y += 56;
    (extra ?? []).forEach(line => {
      g.fillStyle = '#3d2f26';
      fitText(line, colW, 25, 500);
      g.fillText(line, x, y);
      y += 38;
    });
    rows.forEach(r => {
      const price = formatCOP(r.price);
      g.font = `800 27px ${FONT}`;
      const pw = g.measureText(price).width;
      g.fillStyle = '#1c1410';
      fitText(r.name, colW - pw - 24, 27, 600);
      const nw = g.measureText(r.name).width;
      g.fillText(r.name, x, y);
      g.font = `800 27px ${FONT}`;
      g.fillStyle = '#9b1c1c';
      g.textAlign = 'right';
      g.fillText(price, x + colW, y);
      g.textAlign = 'left';
      g.strokeStyle = 'rgba(60,40,30,.35)';
      g.setLineDash([2, 6]);
      g.beginPath();
      g.moveTo(x + nw + 10, y - 7);
      g.lineTo(x + colW - pw - 10, y - 7);
      g.stroke();
      g.setLineDash([]);
      y += rowH;
    });
    return y + 26;
  };

  let yl = y0;
  if (s.featured) {
    g.fillStyle = '#1c1410';
    roundRect(g, colX[0], yl - 40, colW, 150, 22);
    g.fill();
    g.fillStyle = '#f5b800';
    g.font = `800 24px ${FONT}`;
    g.fillText('★ PLATO NUEVO', colX[0] + 26, yl);
    g.fillStyle = '#fff';
    fitText(s.featured.name, colW - 52, 34, 800);
    g.fillText(s.featured.name, colX[0] + 26, yl + 46);
    g.font = `800 36px ${FONT}`;
    g.fillStyle = '#f5b800';
    g.fillText(formatCOP(s.featured.price), colX[0] + 26, yl + 92);
    yl += 160;
  }
  yl = drawSection(0, yl, 'Especiales', s.especiales);
  yl = drawSection(0, yl, 'Menú infantil', s.infantil);
  drawSection(0, yl, 'Sancochos', s.sancochos);

  let yr = y0;
  yr = drawSection(1, yr, 'Pollo asado', s.pollo);
  yr = drawSection(1, yr, 'Platos del día', s.platosDia);
  const extra: string[] = [];
  if (cfg.sopa) extra.push(`Sopa: ${cfg.sopa}`);
  if (cfg.principios.length) extra.push(`Principio: ${cfg.principios.join(', ')}`);
  if (cfg.jugo) extra.push(`Jugo: ${cfg.jugo}`);
  drawSection(1, yr, 'Corriente del día', s.proteinas, extra);

  // Pie
  g.fillStyle = '#1c1410';
  g.fillRect(0, H - 170, W, 170);
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.font = `800 44px ${FONT}`;
  g.fillText(`Pide por WhatsApp ${WHATSAPP_PEDIDOS}`, W / 2, H - 98);
  g.font = `500 26px ${FONT}`;
  g.fillStyle = 'rgba(255,255,255,.8)';
  g.fillText('Nequi · Daviplata · Efectivo', W / 2, H - 50);
  if (cfg.nota) {
    g.fillStyle = '#9b1c1c';
    g.font = `700 28px ${FONT}`;
    g.fillText(cfg.nota, W / 2, H - 210);
  }
  g.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => c.toBlob(b => (b ? resolve(b) : reject(new Error('No se pudo crear la imagen'))), 'image/png'));
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

export async function shareOrDownload(blob: Blob, filename: string) {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
  if (nav.canShare?.({ files: [file] }) && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: 'Menú del día' });
      return;
    } catch {
      /* el usuario canceló: descargamos */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
