// Prueba la pagina del link de la bio como la ve una clienta: en el telefono, a una hora
// concreta y con el pulgar. Mide lo que se puede medir en vez de mirarlo a ojo --
// si el boton de WhatsApp queda bajo el pliegue, si algun texto baja de 15 px, si algun
// area de toque baja de 44 px, y el contraste real de cada texto contra su fondo real.
//
//   node probar.js [ruta-al-html]     (por defecto, el index.html del repo publico)
//
// Deja los pantallazos en pantallazos/ y escupe una tabla por consola. Sale con codigo 1
// si algo incumple, para que no haya que leer la salida entera para saber si paso.

const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = path.join(process.env.HOME,
  'Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64',
  'Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing');

const HTML = process.argv[2] || '/tmp/linderos-check/index.html';
const SALIDA = path.join(__dirname, 'pantallazos');

// El telefono chico va primero a proposito: es el que decide si algo entra en la primera
// pantalla. Si pasa en el SE, pasa en todos.
const EQUIPOS = [
  { nombre: 'iPhone-SE',    ancho: 375, alto: 667, escala: 2, ios: true  },
  { nombre: 'iPhone-14',    ancho: 393, alto: 852, escala: 3, ios: true  },
  { nombre: 'Android-chico', ancho: 360, alto: 800, escala: 3, ios: false },
];

// Momentos que cambian lo que dice la pagina. La hora va en hora de Chile (UTC-3 en
// septiembre); el offset se escribe explicito para no depender de la zona de esta maquina.
const MOMENTOS = [
  { nombre: 'sabado-11h',   iso: '2026-09-12T11:00:00-03:00', espera: { tienda: 'Abierto ahora',          boton: 'al tiro' } },
  { nombre: 'domingo-17h',  iso: '2026-09-13T17:00:00-03:00', espera: { tienda: 'Cerrado',                boton: 'al tiro' } },
  { nombre: 'lunes-14h15',  iso: '2026-09-14T14:15:00-03:00', espera: { tienda: 'Cerrado por almuerzo',   boton: 'al tiro' } },
  { nombre: 'lunes-02h',    iso: '2026-09-14T02:00:00-03:00', espera: { tienda: 'Cerrado',                boton: 'primera hora' } },
  { nombre: 'lunes-07h59',  iso: '2026-09-14T07:59:00-03:00', espera: { tienda: 'Cerrado',                boton: 'primera hora' } },
  { nombre: 'lunes-08h00',  iso: '2026-09-14T08:00:00-03:00', espera: { tienda: 'Cerrado',                boton: 'al tiro' } },
  { nombre: 'lunes-22h59',  iso: '2026-09-14T22:59:00-03:00', espera: { tienda: 'Cerrado',                boton: 'al tiro' } },
  { nombre: 'lunes-23h00',  iso: '2026-09-14T23:00:00-03:00', espera: { tienda: 'Cerrado',                boton: 'primera hora' } },
];

// Minimos. Los dos primeros son el estandar del proyecto para clientela mayor; el de 44 px
// es el tamano de objetivo tactil de las pautas WCAG (2.5.5, nivel AAA).
const MIN_TEXTO = 15;
const MIN_TOQUE = 44;
const MIN_CONTRASTE = 4.5;   // AA para texto normal
const META_CONTRASTE = 7;    // AAA, que es lo que el proyecto se puso como meta

const fallas = [];
const avisos = [];

// Congela el reloj antes de que corra cualquier script de la pagina. Solo se fija el
// instante: toLocaleString sigue siendo el de verdad, asi que la conversion a hora de Chile
// es la real y no una simulada, que es justo lo que interesa probar.
function relojFijo(iso) {
  return `(() => {
    const fijo = new Date(${JSON.stringify(iso)}).getTime();
    const Real = Date;
    class Falso extends Real {
      constructor(...a) { return a.length ? new Real(...a) : new Real(fijo); }
      static now() { return fijo; }
    }
    Falso.parse = Real.parse; Falso.UTC = Real.UTC;
    Date = Falso;
  })()`;
}

// Contraste WCAG contra el fondo REAL: si el elemento es transparente sube por los
// ancestros hasta encontrar un color opaco, que es lo que el ojo ve.
const MEDIR = `(() => {
  const lum = (c) => {
    const [r,g,b] = c.map(v => v/255).map(v => v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4));
    return 0.2126*r + 0.7152*g + 0.0722*b;
  };
  const rgb = (s) => (s.match(/[\\d.]+/g) || []).slice(0,3).map(Number);
  const alfa = (s) => { const p = (s.match(/[\\d.]+/g) || []); return p.length > 3 ? Number(p[3]) : 1; };
  const fondoDe = (el) => {
    for (let n = el; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      if (alfa(c) > 0.95) return rgb(c);
    }
    return [255,255,255];
  };
  const contraste = (el) => {
    const f = lum(rgb(getComputedStyle(el).color)), b = lum(fondoDe(el));
    return +(((Math.max(f,b)+0.05)/(Math.min(f,b)+0.05)).toFixed(2));
  };

  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).display !== 'none';
  };

  // Cada texto que la clienta tiene que poder leer, con su tamano y su contraste.
  const textos = [...document.querySelectorAll('h1,p,span,strong,em,dt,dd,a')]
    .filter(visible)
    .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    .map(el => ({
      texto: el.textContent.trim().replace(/\\s+/g,' ').slice(0,42),
      px: +parseFloat(getComputedStyle(el).fontSize).toFixed(1),
      contraste: contraste(el),
    }));

  // Todo lo que se toca.
  const toques = [...document.querySelectorAll('a[href]')].filter(visible).map(el => {
    const r = el.getBoundingClientRect();
    return {
      texto: el.textContent.trim().replace(/\\s+/g,' ').slice(0,34),
      href: el.getAttribute('href').slice(0,52),
      alto: Math.round(r.height),
      arriba: Math.round(r.top),
      abajo: Math.round(r.bottom),
    };
  });

  const wsp = document.getElementById('wsp').getBoundingClientRect();
  return {
    textos, toques,
    pliegue: window.innerHeight,
    wsp: { arriba: Math.round(wsp.top), abajo: Math.round(wsp.bottom) },
    estado: document.getElementById('estadoTexto').textContent.trim(),
    hoy: document.getElementById('hoyTexto').textContent.trim(),
    cuando: document.getElementById('cuandoWsp').textContent.trim(),
    alto: document.body.scrollHeight,
    // Agrandar tipografias es la forma mas facil de provocar scroll lateral en un telefono
    // angosto, y en un telefono el scroll lateral no se nota: la linea simplemente se corta.
    desborde: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

(async () => {
  if (!fs.existsSync(CHROME)) { console.error('No esta el Chrome de pruebas en', CHROME); process.exit(2); }
  fs.rmSync(SALIDA, { recursive: true, force: true });
  fs.mkdirSync(SALIDA, { recursive: true });

  const navegador = await chromium.launch({ executablePath: CHROME });
  const url = HTML.startsWith('http') ? HTML : 'file://' + path.resolve(HTML);
  console.log('Probando:', url, '\n');

  // --- 1. Los ocho momentos, en el telefono chico ---
  console.log('== QUE DICE LA PAGINA A CADA HORA ==\n');
  console.log('momento        tienda                      boton verde');
  console.log('-'.repeat(88));

  for (const m of MOMENTOS) {
    const ctx = await navegador.newContext({
      viewport: { width: 375, height: 667 }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true, locale: 'es-CL', timezoneId: 'America/Santiago',
    });
    await ctx.addInitScript(relojFijo(m.iso));
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'networkidle' });
    const r = await p.evaluate(MEDIR);

    const okTienda = r.estado.includes(m.espera.tienda);
    const okBoton  = r.cuando.includes(m.espera.boton);
    if (!okTienda) fallas.push(`${m.nombre}: la tienda dice "${r.estado}", se esperaba "${m.espera.tienda}"`);
    if (!okBoton)  fallas.push(`${m.nombre}: el boton dice "${r.cuando}", se esperaba "${m.espera.boton}"`);

    console.log(
      m.nombre.padEnd(14) +
      (okTienda ? ' ' : '✗') + r.estado.padEnd(27) +
      (okBoton ? ' ' : '✗') + r.cuando
    );

    await p.screenshot({ path: path.join(SALIDA, `hora-${m.nombre}.png`) });
    await ctx.close();
  }

  // --- 2. Los tres equipos, a una hora normal ---
  console.log('\n\n== EN CADA TELEFONO (sabado 11:00, tienda abierta) ==\n');

  for (const eq of EQUIPOS) {
    const ctx = await navegador.newContext({
      viewport: { width: eq.ancho, height: eq.alto }, deviceScaleFactor: eq.escala,
      isMobile: true, hasTouch: true, locale: 'es-CL', timezoneId: 'America/Santiago',
      userAgent: eq.ios
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
    });
    await ctx.addInitScript(relojFijo('2026-09-12T11:00:00-03:00'));
    const p = await ctx.newPage();
    const osm = [];
    p.on('response', res => {
      if (res.url().includes('openstreetmap.org')) osm.push({ status: res.status() });
    });
    await p.goto(url, { waitUntil: 'networkidle' });
    const r = await p.evaluate(MEDIR);

    const entra = r.wsp.abajo <= r.pliegue;
    if (!entra) fallas.push(`${eq.nombre}: el boton de WhatsApp termina en ${r.wsp.abajo} px y la pantalla mide ${r.pliegue} px -- queda bajo el pliegue`);

    console.log(`${eq.nombre} (${eq.ancho}x${eq.alto})`);
    console.log(`  WhatsApp ocupa de ${r.wsp.arriba} a ${r.wsp.abajo} px, pantalla de ${r.pliegue} px  ${entra ? '-> entra en la primera pantalla' : '-> ✗ BAJO EL PLIEGUE'}`);
    console.log(`  la pagina entera mide ${r.alto} px (${(r.alto / r.pliegue).toFixed(1)} pantallas)`);

    if (r.desborde > 0) fallas.push(`${eq.nombre}: la pagina se sale ${r.desborde} px a lo ancho -- hay scroll lateral`);
    console.log(`  ancho: ${r.desborde > 0 ? '✗ se sale ' + r.desborde + ' px' : 'sin scroll lateral'}`);

    // Apple Maps solo en iOS.
    const apple = r.toques.some(t => t.href.includes('maps.apple.com'));
    if (apple !== eq.ios) fallas.push(`${eq.nombre}: Apple Maps ${apple ? 'aparece y no deberia' : 'no aparece y deberia'}`);
    console.log(`  Apple Maps ${apple ? 'visible' : 'oculto'} ${apple === eq.ios ? '' : '✗'}`);

    // Que se toca, en orden, y con cuanta area.
    console.log('  botones, en el orden en que se ven:');
    for (const t of r.toques) {
      const ok = t.alto >= MIN_TOQUE;
      if (!ok) fallas.push(`${eq.nombre}: "${t.texto}" mide ${t.alto} px de alto, bajo los ${MIN_TOQUE} px`);
      console.log(`    ${ok ? ' ' : '✗'} ${String(t.alto).padStart(3)} px  ${t.texto.padEnd(34)} ${t.href}`);
    }

    // Textos chicos y contrastes flojos.
    for (const t of r.textos) {
      if (t.px < MIN_TEXTO) fallas.push(`${eq.nombre}: "${t.texto}" en ${t.px} px, bajo los ${MIN_TEXTO} px`);
      if (t.contraste < MIN_CONTRASTE) fallas.push(`${eq.nombre}: "${t.texto}" con contraste ${t.contraste}:1, bajo el minimo ${MIN_CONTRASTE}:1`);
      else if (t.contraste < META_CONTRASTE) avisos.push(`"${t.texto}" con contraste ${t.contraste}:1, cumple AA pero no llega a la meta de ${META_CONTRASTE}:1`);
    }

    await p.screenshot({ path: path.join(SALIDA, `equipo-${eq.nombre}.png`) });

    // El mapa va con loading="lazy": no existe hasta que alguien baja hasta el. Hay que
    // bajar, esperar, y NO volver arriba -- al volver, el iframe se despinta y la captura
    // sale con un recuadro gris que parece roto cuando no lo esta.
    await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await p.waitForTimeout(3000);

    // Que el iframe exista no prueba nada: hay que ver que OSM haya respondido de verdad.
    const ok = osm.some(r => r.status === 200);
    if (!ok) fallas.push(`${eq.nombre}: el mapa no cargo (respuestas de OSM: ${JSON.stringify(osm)})`);
    console.log(`  mapa: ${ok ? `cargado (${osm.length} respuestas de OSM)` : '✗ no cargo'}`);

    await p.locator('.mapa').screenshot({ path: path.join(SALIDA, `mapa-${eq.nombre}.png`) });
    await p.screenshot({ path: path.join(SALIDA, `equipo-${eq.nombre}-completa.png`), fullPage: true });
    await ctx.close();
  }

  await navegador.close();

  // --- Veredicto ---
  const unicos = [...new Set(avisos)];
  if (unicos.length) {
    console.log('\n\n== AVISOS (cumplen la norma, no llegan a la meta del proyecto) ==\n');
    unicos.forEach(a => console.log('  ·', a));
  }

  console.log('\n\n== VEREDICTO ==\n');
  if (fallas.length) {
    console.log(`${fallas.length} problema(s):\n`);
    [...new Set(fallas)].forEach(f => console.log('  ✗', f));
    process.exit(1);
  }
  console.log('  Todo en orden.');
  console.log(`  Pantallazos en ${SALIDA}`);
})();
