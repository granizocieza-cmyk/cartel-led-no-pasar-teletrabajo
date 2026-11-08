/* =============================================================================
 *  app.js — Interfaz de la simulación (todo lo "visual" y los botones)
 * =============================================================================
 *  La lógica de verdad (animaciones, estados, antirrebote, latido) está en
 *  nucleo.js. Aquí solo conectamos: botones -> micro simulado -> Agente ->
 *  "red WiFi" (un paquete que viaja) -> Cartel -> dibujo en el canvas.
 *
 *  Dos relojes (ver nucleo.js):
 *    visual : tiempo real, para animar.
 *    logico : avanza ×1, ×3 o ×10 más rápido, para ver los 15 s de latido, los
 *             5 s de antirrebote o los 45 s de "sin señal" sin esperar.
 * ========================================================================== */
(function () {
  'use strict';
  const N = window.Nucleo;
  const $ = (id) => document.getElementById(id);

  // ------------------------------------------------------------ Estado de la demo
  const PROGRAMAS = {
    teams: { exe: 'ms-teams.exe', caja: $('app-teams') },
    navegador: { exe: 'msedge.exe', caja: $('app-navegador') },
    zoom: { exe: 'Zoom.exe', caja: $('app-zoom') },
  };
  const TIEMPO_VIAJE_MS = 900;     // lo que tarda el paquete en cruzar (visual)
  const PERIODO_AGENTE_MS = 1000;  // el agente mira el micro cada 1 s (lógico)

  let wifi = true;
  let velocidad = 1;
  let visual = 0, logico = 0, proximoTick = 0;
  let primeraLectura = true, micAntes = false, envioOkAntes = true, ultimoEstadoLog = null;
  let inicioLlamada = null;
  let paquetes = [];

  const cartel = new N.Cartel('IP 192.168.1.50');
  const agente = new N.Agente();   // 15 s de latido, 5 s de antirrebote (como config.example.ini)

  const microActivo = () => Object.values(PROGRAMAS).some((p) => p.caja.checked);
  const sesionesActivas = () => Object.values(PROGRAMAS).filter((p) => p.caja.checked).map((p) => p.exe);

  // ------------------------------------------------------------------ Registros
  function hora(ms) {
    const s = Math.floor(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }
  function escribir(listaId, texto, clase) {
    const ol = $(listaId);
    const li = document.createElement('li');
    const t = document.createElement('span');
    t.className = 't';
    t.textContent = hora(logico) + '  ';
    const m = document.createElement('span');
    if (clase) m.className = clase;
    m.textContent = texto;
    li.append(t, m);
    ol.appendChild(li);
    while (ol.children.length > 80) ol.removeChild(ol.firstChild);
    ol.scrollTop = ol.scrollHeight;
  }
  const logPC = (txt, c) => escribir('log-pc', txt, c);
  const logESP = (txt, c) => escribir('log-esp', txt, c);

  // ------------------------------------------------------------- Agente (PC)
  function pasoAgente(tl) {
    const activo = microActivo();
    if (activo !== micAntes || primeraLectura) {
      const quien = sesionesActivas().join(', ');
      logPC(`Micrófono ${activo ? 'EN USO por: ' + quien : 'libre'}  [3 micros revisados]`, activo ? 'aviso' : '');
    }
    micAntes = activo;
    primeraLectura = false;

    const a = agente.tick(tl, activo);
    if (!a.enviar) return;

    const ruta = a.estado === N.OCUPADO ? '/ocupado' : '/libre';
    const ok = wifi;
    agente.resultadoEnvio(ok, tl);
    paquetes.push({ inicio: visual, estado: a.estado, ruta, latido: a.esLatido, ok, entregado: false, nodo: null });

    // Igual que main.cpp: solo registro los cambios y los fallos nuevos, no cada latido.
    if (!ok && envioOkAntes) logPC(`ERROR enviando '${a.estado}': sin respuesta de cartel.local`, 'mal');
    else if (ok && (!envioOkAntes || a.estado !== ultimoEstadoLog)) {
      logPC(`Enviado '${a.estado}' (cartel.local -> HTTP 200)`, 'ok');
      ultimoEstadoLog = a.estado;
    }
    envioOkAntes = ok;
  }

  // ------------------------------------------------------- Paquetes por la red
  const capaRed = $('capa-red'), ruta = $('ruta'), plantilla = $('paquete');
  let largoRuta = 1;

  function geometria() {
    const esc = $('escena').getBoundingClientRect();
    const p = $('portatil').getBoundingClientRect();
    const c = document.querySelector('.soporte').getBoundingClientRect();
    const rel = (x, y) => [x - esc.left, y - esc.top];
    let a, b, ctrl;
    if (c.left > p.right + 30) {                       // disposición horizontal
      a = rel(p.right, p.top + 110);
      b = rel(c.left - 4, c.top + c.height / 2);
      ctrl = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 70];
    } else if (c.bottom <= p.top) {                    // apilado en móvil: el cartel arriba, el portátil debajo
      a = rel(p.left + p.width / 2, p.top);
      b = rel(c.left + c.width / 2, c.bottom + 4);
      ctrl = [Math.max(a[0], b[0]) + 70, (a[1] + b[1]) / 2];
    } else {                                           // apilado con el cartel debajo
      a = rel(p.left + p.width / 2, p.bottom);
      b = rel(c.left + c.width / 2, c.top - 4);
      ctrl = [Math.max(a[0], b[0]) + 70, (a[1] + b[1]) / 2];
    }
    ruta.setAttribute('d', `M${a[0]},${a[1]} Q${ctrl[0]},${ctrl[1]} ${b[0]},${b[1]}`);
    largoRuta = ruta.getTotalLength() || 1;
  }

  function moverPaquetes() {
    for (const p of paquetes) {
      const f = (visual - p.inicio) / TIEMPO_VIAJE_MS;
      if (!p.nodo) {
        p.nodo = plantilla.cloneNode(true);
        p.nodo.removeAttribute('id');
        p.nodo.classList.add(p.estado === N.OCUPADO ? 'es-ocupado' : 'es-libre');
        if (p.latido) p.nodo.classList.add('es-latido');
        if (!p.ok) p.nodo.classList.add('es-perdido');
        p.nodo.querySelector('text').textContent = (p.latido ? 'latido ' : '') + 'GET ' + p.ruta;
        capaRed.appendChild(p.nodo);
      }
      // Si la red está cortada el paquete se "pierde" a mitad de camino.
      const tope = p.ok ? 1 : 0.55;
      const e = Math.min(f, tope);
      const pt = ruta.getPointAtLength(largoRuta * (e * e * (3 - 2 * e)));   // suavizado
      p.nodo.setAttribute('transform', `translate(${pt.x},${pt.y})`);
      p.nodo.setAttribute('opacity', f > tope ? Math.max(0, 1 - (f - tope) * 6) : 1);

      if (f >= 1 && !p.entregado) {
        p.entregado = true;
        if (p.ok) {
          cartel.recibirOrden(p.estado, visual, logico);
          logESP(`[http] GET ${p.ruta}  -> 200`, p.latido ? '' : 'ok');
        }
      }
    }
    paquetes = paquetes.filter((p) => {
      const fin = p.entregado && (visual - p.inicio) / TIEMPO_VIAJE_MS > 1.3;
      if (fin && p.nodo) p.nodo.remove();
      return !fin;
    });
  }

  // ------------------------------------------------------------ Dibujo del cartel
  const canvas = $('matriz'), ctx = canvas.getContext('2d');

  function pintarMatriz(frame) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const ancho = Math.max(320, Math.round(canvas.getBoundingClientRect().width * dpr));
    const alto = Math.round(ancho / 4);
    if (canvas.width !== ancho || canvas.height !== alto) { canvas.width = ancho; canvas.height = alto; }
    const celda = ancho / N.ANCHO;
    const m = frame.marco;
    // El brillo real (0..48 sobre 255) es muy bajo para una pantalla; lo reescalo
    // solo para DIBUJAR, manteniendo que el deslizador se note.
    const ganancia = 0.4 + 0.6 * (frame.brillo / N.BRILLO_MAX);

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#04040a';
    ctx.fillRect(0, 0, ancho, alto);

    // Carcasa de cada LED (apagado): un cuadradito oscuro con el diodo.
    for (let y = 0; y < N.ALTO; y++) {
      for (let x = 0; x < N.ANCHO; x++) {
        const px = x * celda, py = y * celda;
        ctx.fillStyle = '#0b0c13';
        ctx.fillRect(px + celda * 0.07, py + celda * 0.07, celda * 0.86, celda * 0.86);
        ctx.fillStyle = '#14151f';
        ctx.beginPath();
        ctx.arc(px + celda / 2, py + celda / 2, celda * 0.27, 0, 6.2832);
        ctx.fill();
      }
    }

    // Luz de los LEDs encendidos: halo difuso + núcleo brillante.
    ctx.globalCompositeOperation = 'lighter';
    let sr = 0, sg = 0, sb = 0, sInt = 0;
    for (let y = 0; y < N.ALTO; y++) {
      for (let x = 0; x < N.ANCHO; x++) {
        const i = (y * N.ANCHO + x) * 3;
        if (m[i] + m[i + 1] + m[i + 2] === 0) continue;
        const col = [0, 1, 2].map((k) => Math.min(255, 255 * Math.pow(m[i + k] / 255, 0.72) * ganancia));
        const inten = Math.max(col[0], col[1], col[2]) / 255;
        sr += col[0]; sg += col[1]; sb += col[2]; sInt += inten;
        const cx = x * celda + celda / 2, cy = y * celda + celda / 2;
        const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, celda * 1.35);
        halo.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${0.55 * inten})`);
        halo.addColorStop(1, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},0)`);
        ctx.fillStyle = halo;
        ctx.fillRect(cx - celda * 1.4, cy - celda * 1.4, celda * 2.8, celda * 2.8);
        ctx.fillStyle = `rgb(${col[0] | 0},${col[1] | 0},${col[2] | 0})`;
        ctx.beginPath();
        ctx.arc(cx, cy, celda * 0.3, 0, 6.2832);
        ctx.fill();
        ctx.fillStyle = `rgba(255,255,255,${0.35 * inten})`;   // punto caliente
        ctx.beginPath();
        ctx.arc(cx, cy, celda * 0.13, 0, 6.2832);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    return { sr, sg, sb, sInt };
  }

  // La luz del cartel "se derrama" sobre la pared y bajo la puerta.
  let ultimaLuz = 0;
  function luzPared(s) {
    if (visual - ultimaLuz < 90) return;
    ultimaLuz = visual;
    if (s.sInt < 0.5) { document.documentElement.style.setProperty('--luz', 'rgba(0,0,0,0)'); return; }
    const mx = Math.max(s.sr, s.sg, s.sb, 1);
    const alfa = Math.min(0.42, s.sInt / 120);
    document.documentElement.style.setProperty(
      '--luz', `rgba(${Math.round((s.sr / mx) * 255)},${Math.round((s.sg / mx) * 255)},${Math.round((s.sb / mx) * 255)},${alfa.toFixed(3)})`);
  }

  // ----------------------------------------------------------------- Interfaz
  let ultimaUI = 0;
  const ETIQUETAS = {
    arrancando: ['arrancando…', ''],
    neutro: ['? sin señal del PC', 'neutro'],
    libre: ['PASAR · micro libre', 'libre'],
    ocupado: ['NO PASAR · micro en uso', 'ocupado'],
  };
  function chip(el, texto, clase) {
    el.innerHTML = '';
    const s = document.createElement('span');
    s.className = 'chip ' + (clase || '');
    s.textContent = texto;
    el.appendChild(s);
  }
  function actualizarUI(frame) {
    if (visual - ultimaUI < 100) return;
    ultimaUI = visual;

    const activas = sesionesActivas();
    $('wasapi').textContent = activas.length ? activas.join(', ') : 'ninguna';
    const activo = activas.length > 0;
    chip($('a-micro'), activo ? 'EN USO' : 'libre', activo ? 'rojo-c' : 'verde-c');
    const conf = agente.confirmado;
    chip($('a-confirmado'), conf ? (conf === N.OCUPADO ? 'ocupado' : 'libre') : '—', conf === N.OCUPADO ? 'rojo-c' : conf === N.LIBRE ? 'verde-c' : '');

    const rest = agente.restanteLibre(logico, activo);
    $('m-antirrebote').hidden = rest === null;
    if (rest !== null) {
      $('v-antirrebote').textContent = (rest / 1000).toFixed(1) + ' s';
      $('b-antirrebote').style.width = (100 * (1 - rest / agente.t.retardo_libre_ms)) + '%';
    }
    const hl = agente.hastaLatido(logico);
    $('v-latido-pc').textContent = hl === null ? '—' : Math.ceil(hl / 1000) + ' s';
    $('b-latido-pc').style.width = hl === null ? '0%' : (100 * (1 - hl / agente.t.latido_ms)) + '%';

    const [txt, clase] = ETIQUETAS[cartel.estado];
    const e = $('estado-cartel');
    e.textContent = txt;
    e.className = 'estado-cartel ' + clase;

    $('v-ma').textContent = (frame.ma / 1000).toFixed(2) + ' A  (límite ' + (N.LIMITE_MA / 1000).toFixed(1) + ' A)';
    $('b-ma').style.width = Math.min(100, (100 * frame.ma) / 2400) + '%';
    $('marca-limite').style.left = (100 * N.LIMITE_MA) / 2400 + '%';

    const vivo = cartel.estado === N.OCUPADO || cartel.estado === N.LIBRE;
    const seg = cartel.segundosDesdeLatido(logico);
    $('v-latido').textContent = vivo ? 'hace ' + Math.floor(seg) + ' s  (límite ' + (N.TIMEOUT_LATIDO_MS / 1000) + ' s)' : '—';
    const barra = $('b-latido');
    barra.style.width = vivo ? Math.min(100, (100 * seg * 1000) / N.TIMEOUT_LATIDO_MS) + '%' : '0%';
    barra.style.background = seg > 40 ? 'var(--rojo)' : seg > 30 ? 'var(--ambar)' : 'var(--cian)';

    if (inicioLlamada !== null) $('cronometro').textContent = hora(logico - inicioLlamada);
  }

  function sincronizarBotonLlamada() {
    const en = PROGRAMAS.teams.caja.checked;
    const b = $('btn-llamada');
    b.setAttribute('aria-pressed', String(en));
    b.querySelector('.b-icono').textContent = en ? '📴' : '📞';
    b.querySelector('.b-texto').textContent = en ? 'Colgar la llamada de Teams' : 'Entra una llamada de Teams';
    $('llamada').hidden = !en;
    if (en && inicioLlamada === null) inicioLlamada = logico;
    if (!en) inicioLlamada = null;
  }

  // ------------------------------------------------------------------ Eventos
  $('btn-llamada').addEventListener('click', () => {
    PROGRAMAS.teams.caja.checked = !PROGRAMAS.teams.caja.checked;
    sincronizarBotonLlamada();
  });
  Object.values(PROGRAMAS).forEach((p) => p.caja.addEventListener('change', sincronizarBotonLlamada));

  $('btn-wifi').addEventListener('click', () => {
    wifi = !wifi;
    const b = $('btn-wifi');
    b.setAttribute('aria-pressed', String(!wifi));
    b.textContent = wifi ? '📡 Cortar el WiFi' : '📡 Restaurar el WiFi';
    $('txt-wifi').textContent = wifi ? 'WiFi de casa' : 'WiFi cortado';
    $('etiqueta-wifi').classList.toggle('sin-red', !wifi);
    ruta.classList.toggle('cortada', !wifi);
    logPC(wifi ? 'WiFi restaurado' : 'WiFi cortado (simulado)', 'aviso');
  });

  document.querySelectorAll('.seg').forEach((b) =>
    b.addEventListener('click', () => {
      velocidad = Number(b.dataset.vel);
      document.querySelectorAll('.seg').forEach((x) => x.classList.toggle('activo', x === b));
    }));

  $('brillo').addEventListener('input', (ev) => {
    cartel.brillo = Number(ev.target.value);
    $('v-brillo').textContent = ev.target.value;
  });

  $('btn-reiniciar').addEventListener('click', () => {
    cartel.reiniciar(visual, logico);
    logESP('— reinicio del ESP32 —', 'aviso');
  });

  window.addEventListener('resize', geometria);
  if (window.ResizeObserver) new ResizeObserver(geometria).observe($('escena'));

  // ----------------------------------------------------------------- Bucle
  let ultimoReal = null;
  function bucle(ahoraReal) {
    if (ultimoReal === null) ultimoReal = ahoraReal;
    const dt = Math.min(250, ahoraReal - ultimoReal);   // si la pestaña estuvo oculta, no salto de golpe
    ultimoReal = ahoraReal;
    visual += dt;
    logico += dt * velocidad;

    while (proximoTick <= logico) {
      pasoAgente(proximoTick);
      proximoTick += PERIODO_AGENTE_MS;
    }
    moverPaquetes();
    cartel.comprobarLatido(visual, logico);
    const frame = cartel.fotograma(visual, logico);
    const luz = pintarMatriz(frame);
    luzPared(luz);
    actualizarUI(frame);
    while (cartel.registro.length) {
      const l = cartel.registro.shift();
      logESP(l, l.includes('NEUTRO') ? 'aviso' : '');
    }
    requestAnimationFrame(bucle);
  }

  // Arranque
  logPC('Agente iniciado. Cartel: cartel.local:80, latido 15 s, retardo a PASAR 5 s');
  logESP('== Cartel NO PASAR ==');
  logESP('[wifi] conectando a MiWiFi ...');
  sincronizarBotonLlamada();
  geometria();
  requestAnimationFrame(bucle);

  // Para depurar o grabar el GIF desde la consola / herramientas de prueba.
  window.__sim = {
    cartel, agente,
    llamada(en) { PROGRAMAS.teams.caja.checked = en; sincronizarBotonLlamada(); },
    wifi(en) { if (wifi !== en) $('btn-wifi').click(); },
    velocidad(v) { velocidad = v; },
  };
})();
