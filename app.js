/* ==========================================================================
   MENTE ÁGIL · app.js
   JavaScript vanilla (ES6+). Sin dependencias, sin build step.
   Estructura:
     0. Utilidades matemáticas y de formato
     1. Catálogo de las 15 categorías (generadores por nivel)
     2. Normalización y corrección de respuestas
     3. Persistencia (localStorage)
     4. Estado de la aplicación
     5. Render · vista Catálogo
     6. Render · vista Dashboard
     7. Motor de sesión (temporizador, progreso, feedback, resumen)
     8. Eventos, atajos de teclado y arranque
   ========================================================================== */
(function () {
  'use strict';

  /* ======================================================================
     0. UTILIDADES
     ====================================================================== */

  /** Entero aleatorio en [min, max] (ambos incluidos). */
  const ri = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  /** Elemento aleatorio de un array. */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  /** Baraja una copia del array (Fisher–Yates). */
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  /** Redondeo "humano" (evita el -0 y los problemas de punto flotante). */
  const round = (v, d = 0) => {
    const f = Math.pow(10, d);
    return Math.round((v + Number.EPSILON) * f) / f;
  };
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /**
   * Formatea un número al estilo español: punto para millares, coma decimal.
   * 1234.5 -> "1.234,5"
   */
  function fmt(n) {
    if (!isFinite(n)) return '—';
    const r = round(n, 4);
    const neg = r < 0;
    const abs = Math.abs(r);
    const dec = String(abs).includes('.') ? String(round(abs, 4)).split('.')[1].replace(/0+$/, '') : '';
    const intPart = String(Math.floor(abs)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (neg ? '−' : '') + intPart + (dec ? ',' + dec : '');
  }
  /** Versión corta (sin separador de millares) para respuestas esperadas. */
  const fmtShort = (n) => fmt(n).replace(/\./g, '');
  /** Número decimal legible en español: 4.55 -> "4,55" (sin punto de millar). */
  const fmtDec = (n) => fmtShort(round(n, 4)).replace('.', ',');

  /** Escapa texto para inyectarlo como HTML con seguridad. */
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  /** Convierte "3/5" en una fracción tipográfica. */
  const fracHTML = (s) => {
    const p = String(s).trim().split('/');
    return p.length === 2 ? `<span class="frac"><span>${esc(p[0])}</span><span>${esc(p[1])}</span></span>` : esc(s);
  };

  /** MM:SS (o H:MM:SS si supera la hora). */
  function fmtTime(ms) {
    const total = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const p = (x) => String(x).padStart(2, '0');
    return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
  }
  /** Duración legible ("1 h 12 min", "8 min", "45 s"). */
  function fmtDur(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s} s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)} h ${m % 60} min`;
  }
  const LEVELS = { facil: 'Fácil', medio: 'Medio', dificil: 'Difícil' };

  /* ======================================================================
     1. CATÁLOGO · 15 categorías
     Cada generador devuelve:
       { q, qHTML?, sub?, kind:'number'|'mcq', answer, tol?, unit?,
         options?, correct?, hint }
     ====================================================================== */

  /* Rangos por número de cifras (para las opciones de cada categoría) */
  const DIGR = { 1: [2, 9], 2: [11, 99], 3: [101, 999] };
  const pickRange = (o, autoMap) => (o && DIGR[o.digits] ? DIGR[o.digits] : autoMap);
  const optVal = (o, key) => (o && o[key] !== undefined && o[key] !== 'auto' ? o[key] : null);

  /* -- 1. Sumas y restas encadenadas ------------------------------------ */
  function genChain(lv, o) {
    o = o || {};
    const op = optVal(o, 'op') || 'mixtas';
    const R = pickRange(o, { facil: [11, 49], medio: [11, 99], dificil: [101, 899] }[lv]);
    const n = lv === 'facil' ? 3 : 4;
    const lo = R[0], hi = R[1];
    let terms, signs, ans, guard = 0;
    if (op === 'restas') {
      const k = n - 1;
      const subHi = Math.max(lo, Math.floor(hi / (k + 1)));
      const subs = Array.from({ length: k }, () => ri(lo, subHi));
      const sum = subs.reduce((a, b) => a + b, 0);
      const a = sum + ri(1, Math.max(1, hi - sum));
      terms = [a, ...subs];
      signs = terms.map((_, i) => (i ? -1 : 1));
      ans = a - sum;
    } else {
      do {
        terms = Array.from({ length: n }, () => ri(lo, hi));
        signs = terms.map((_, i) =>
          i === 0 ? 1 : op === 'sumas' ? 1 : (Math.random() < 0.5 ? 1 : -1));
        if (op === 'mixtas' && n > 2 && !signs.slice(1).includes(-1)) signs[1] = -1;
        ans = terms.reduce((acc, t, i) => acc + signs[i] * t, 0);
        guard++;
      } while (guard < 90 && ans < 0);
    }
    const parts = terms.map((t, i) => (i === 0 ? '' : (signs[i] > 0 ? ' + ' : ' − ')) + fmt(t)).join('');
    const hint = op === 'sumas'
      ? `Suma por decenas y ajusta al final las unidades: ${parts} = ${fmt(ans)}.`
      : op === 'restas'
        ? `Resta por partes: primero las decenas, después las unidades. ${parts} = ${fmt(ans)}.`
        : `Agrupa los números "cómodos" y compensa después: ${parts} = ${fmt(ans)}.`;
    return {
      q: `${parts} = ?`,
      sub: op === 'sumas' ? 'Todo sumas: agrupa como te resulte cómodo' : op === 'restas' ? 'Todo restas: el resultado nunca es negativo' : 'Resuelve de izquierda a derecha redondeando a decenas',
      kind: 'number', answer: ans, tol: 0, hint
    };
  }

  /* -- 2. Complementos a 10, 100 o 1000 --------------------------------- */
  function genComplement(lv, o) {
    o = o || {};
    const tgt = optVal(o, 'target');
    let t, n;
    if (tgt === '10') { t = 10; n = ri(2, 9); }
    else if (tgt === '100') { t = 100; n = ri(12, 98); }
    else if (tgt === '1000') { t = 1000; n = ri(105, 995); }
    else if (tgt === 'dec') { t = 1; n = round(ri(1, 99) / 100, 2); }
    else if (lv === 'facil') { t = pick([10, 10, 100]); n = t === 10 ? ri(2, 9) : ri(12, 98); }
    else if (lv === 'medio') { t = pick([100, 100, 1000]); n = t === 100 ? ri(12, 98) : ri(105, 995); }
    else if (Math.random() < 0.35) { t = 1; n = round(ri(1, 99) / 100, 2); }
    else { t = 1000; n = ri(105, 995); }
    const ans = round(t - n, 2);
    const decimals = t === 1;
    return {
      q: `¿Cuánto le falta a ${decimals ? fmtDec(n) : fmt(n)} para llegar a ${decimals ? '1' : fmt(t)}?`,
      kind: 'number', answer: ans, tol: 0,
      hint: decimals
        ? `Piensa en céntimos: 1 − ${fmtDec(n)} = ${fmtDec(ans)}.`
        : `Completa por cifras: la última debe sumar 10 y las demás 9. ${fmt(n)} + ${fmt(ans)} = ${fmt(t)}.`
    };
  }

  /* -- 3. Dobles y mitades sucesivas ------------------------------------ */
  function genDoubleHalf(lv, o) {
    o = o || {};
    const kind = optVal(o, 'kind') || (Math.random() < 0.5 ? 'dobles' : 'mitades');
    const autoDigits = !optVal(o, 'digits');
    const R = pickRange(o, { facil: [12, 49], medio: [26, 199], dificil: [101, 999] }[lv]);
    let text, ans, hint;
    if (kind === 'dobles') {
      if (autoDigits && lv !== 'facil' && Math.random() < 0.3) {
        const base = ri(105, 995) / 100; ans = round(base * 2, 2);
        text = `Doble de ${fmtDec(base)}`;
        hint = `Trabaja en céntimos: ${Math.round(base * 100)} × 2 = ${Math.round(ans * 100)} → ${fmtDec(ans)}.`;
      } else {
        const n = ri(R[0], R[1]); ans = n * 2; text = `Doble de ${fmt(n)}`;
        hint = `Duplica por partes: ${fmt(n)} × 2 = ${fmt(ans)}.`;
      }
    } else {
      if (autoDigits && lv === 'dificil' && Math.random() < 0.3) {
        const n = 2 * ri(R[0], R[1]) + 1; ans = round(n / 2, 1);
        text = `Mitad de ${fmt(n)}`;
        hint = `Es impar: ${fmt(n)} ÷ 2 = ${fmt((n - 1) / 2)} + 0,5 = ${fmtDec(ans)}.`;
      } else if (autoDigits && lv !== 'facil' && Math.random() < 0.35) {
        const nDec = round(ri(11, 99) / 10, 1); ans = round(nDec / 2, 2);
        text = `Mitad de ${fmtDec(nDec)}`;
        hint = `Trabaja en décimas: ${Math.round(nDec * 10)} ÷ 2 = ${Math.round(ans * 100)} centésimas → ${fmtDec(ans)}.`;
      } else {
        const n = 2 * ri(R[0], R[1]); ans = n / 2; text = `Mitad de ${fmt(n)}`;
        hint = `Parte por cifras: ${fmt(n)} ÷ 2 = ${fmt(ans)}.`;
      }
    }
    return { q: `${text} = ?`, kind: 'number', answer: round(ans, 2), tol: 0, hint };
  }

  /* -- 4. Multiplicar por 5, 25 y 50 ------------------------------------ */
  function genMul5(lv, o) {
    o = o || {};
    let k, n;
    const f = optVal(o, 'factor');
    if (f) {
      k = +f;
      const R = pickRange(o, { facil: [6, 39], medio: [12, 98], dificil: [102, 998] }[lv]);
      n = ri(R[0], R[1]);
    } else if (lv === 'facil') { k = 5; n = ri(6, 39); }
    else if (lv === 'medio') {
      const mode = pick(['5', '25', '50']);
      if (mode === '5') { k = 5; n = ri(24, 198); }
      else if (mode === '25') { k = 25; n = ri(3, 48) * 4; }
      else { k = 50; n = ri(3, 39) * 2; }
    } else {
      const mode = pick(['5g', '25', '50', '25odd']);
      if (mode === '5g') { k = 5; n = ri(102, 998); }
      else if (mode === '25') { k = 25; n = ri(12, 148); }
      else if (mode === '50') { k = 50; n = ri(12, 198); }
      else { k = 25; n = ri(4, 39) * 2 + 1; }
    }
    const ans = n * k;
    const hints = {
      5: `×5 es la mitad de ×10: ${fmt(n)} × 10 = ${fmt(n * 10)} → la mitad = ${fmt(ans)}.`,
      25: `×25 es un cuarto de ×100: ${fmt(n)} × 100 = ${fmt(n * 100)} → ÷4 = ${fmt(ans)}.`,
      50: `×50 es la mitad de ×100: ${fmt(n)} × 100 = ${fmt(n * 100)} → ÷2 = ${fmt(ans)}.`
    };
    return { q: `${fmt(n)} × ${k} = ?`, kind: 'number', answer: ans, tol: 0, hint: hints[k] };
  }

  /* -- 5. Multiplicar por 11 -------------------------------------------- */
  function genMul11(lv, o) {
    o = o || {};
    const auto = !optVal(o, 'digits');
    const d = auto ? { facil: 1, medio: 2, dificil: pick([2, 3]) }[lv] : +optVal(o, 'digits');
    let n;
    if (d === 1) n = ri(2, 9);
    else if (d === 2) {
      if (auto && lv === 'medio') { do { n = ri(11, 89); } while (Math.floor(n / 10) + (n % 10) > 9); }
      else n = ri(11, 99);
    } else n = ri(101, 909);
    const ans = n * 11;
    const str = String(n);
    let hint;
    if (str.length === 1) hint = `${n} × 11 = ${ans}: la cifra se repite.`;
    else if (str.length === 2) {
      const a = str[0], b = str[1];
      hint = (+a + +b <= 9)
        ? `Abre las cifras y coloca su suma en medio: ${a}_${b} → ${a}(${+a + +b})${b} = ${ans}.`
        : `La suma ${+a}+${+b} = ${+a + +b} lleva acarreo: súmale 1 a la primera cifra → ${ans}.`;
    } else {
      hint = `Con 3 cifras suma vecinos: ${str[0]} · ${+str[0] + +str[1]} · ${+str[1] + +str[2]} · ${str[2]} = ${fmt(ans)}.`;
    }
    return { q: `${fmt(n)} × 11 = ?`, kind: 'number', answer: ans, tol: 0, hint };
  }

  /* -- 6. Cuadrados cercanos a una base --------------------------------- */
  function genSquare(lv, o) {
    o = o || {};
    const r = optVal(o, 'range');
    let n;
    if (r === 'bajas') n = ri(11, 30);
    else if (r === 'medias') n = ri(31, 60);
    else if (r === 'altas') n = ri(61, 125);
    else if (lv === 'facil') n = pick([ri(11, 19), ri(21, 25)]);
    else if (lv === 'medio') n = pick([ri(26, 39), ri(41, 49), ri(51, 59)]);
    else n = pick([ri(38, 62), ri(96, 109), ri(111, 125)]);
    const ans = n * n;
    const bases = n <= 30 ? [10, 20, 25, 30] : n <= 70 ? [25, 50] : [100, 125];
    let base = bases[0];
    bases.forEach((b) => { if (Math.abs(b - n) < Math.abs(base - n)) base = b; });
    const d = n - base;
    const sgn = d >= 0 ? '+' : '−';
    const hint = d === 0
      ? `${n} es una base exacta: ${n}² = ${fmt(ans)}.`
      : `(${base} ${sgn} ${Math.abs(d)})² = ${base}² ${sgn} 2·${base}·${Math.abs(d)} + ${Math.abs(d)}² = ${fmt(base * base)} ${sgn} ${fmt(2 * base * Math.abs(d))} + ${Math.abs(d) * Math.abs(d)} = ${fmt(ans)}.`;
    return { q: `${n}² = ?`, sub: '(a ± b)² = a² ± 2ab + b²', kind: 'number', answer: ans, tol: 0, hint };
  }

  /* -- 7. Descomposición para multiplicar -------------------------------- */
  function genDecomp(lv, o) {
    o = o || {};
    const sh = optVal(o, 'shape') ||
      (lv === 'facil' ? '2x1' : lv === 'medio' ? pick(['2x1', '3x1']) : pick(['2x2', '3x2']));
    let a, b, parts;
    if (sh === '2x1') { a = ri(12, 99); b = ri(3, 9); parts = [Math.floor(a / 10) * 10, a % 10]; }
    else if (sh === '3x1') { a = ri(102, 999); b = ri(3, 9); parts = [Math.floor(a / 100) * 100, Math.floor((a % 100) / 10) * 10, a % 10]; }
    else if (sh === '2x2') { a = ri(21, 89); b = ri(11, 39); parts = [Math.floor(a / 10) * 10, a % 10]; }
    else { a = ri(121, 989); b = ri(11, 29); parts = [Math.floor(a / 100) * 100, a - Math.floor(a / 100) * 100]; }
    parts = parts.filter((p) => p !== 0);
    const ans = a * b;
    const detail = parts.map((p) => `${fmt(p)}×${fmt(b)} = ${fmt(p * b)}`).join('  +  ');
    return {
      q: `${fmt(a)} × ${fmt(b)} = ?`,
      sub: `Descompón: ${parts.map(fmt).join(' + ')} × ${fmt(b)}`,
      kind: 'number', answer: ans, tol: 0,
      hint: `Propiedad distributiva: ${detail} = ${fmt(ans)}.`
    };
  }

  /* -- 8. Porcentajes mentales ------------------------------------------ */
  function genPercent(lv, o) {
    o = o || {};
    const kind = optVal(o, 'kind');
    let p, n, dec = 0, hint;

    if (kind === 'encadenados' || (!kind && lv === 'dificil' && Math.random() < 0.3)) {
      const first = pick([10, 20, 25, 50]);
      n = ri(4, 40) * 20; p = first;
      const step1 = round(n * first / 100, 2);
      const second = pick([10, 25, 50]);
      const ans = round(step1 * second / 100, 2);
      return {
        q: `${second} % del ${first} % de ${fmt(n)} = ?`,
        kind: 'number', answer: ans, tol: 0,
        hint: `Encadena: ${first} % de ${fmt(n)} = ${fmt(step1)} → ${second} % de ${fmt(step1)} = ${fmtDec(ans)}.`
      };
    }
    if (kind === 'amables') {
      p = pick([10, 10, 20, 25, 50]);
      n = p === 25 ? ri(2, 39) * 4 : ri(2, 30) * 10;
    } else if (kind === 'raros') {
      p = pick([5, 15, 35, 45, 65, 85, 12.5, 37.5, 62.5]);
      n = Number.isInteger(p) ? ri(12, 198) : ri(2, 19) * 8;
      dec = 2;
    } else if (lv === 'facil') {
      p = pick([10, 10, 25, 50, 20]);
      n = p === 25 ? ri(2, 39) * 4 : ri(2, 30) * 10;
    } else if (lv === 'medio') {
      const mode = pick(['15', '5', '40', '75', 'dec']);
      if (mode === 'dec') { p = pick([10, 25, 50]); n = round(ri(12, 96) * 0.5, 1); dec = 1; }
      else { p = { '15': 15, '5': 5, '40': 40, '75': 75 }[mode]; n = p === 75 ? ri(2, 39) * 4 : ri(2, 39) * 10; }
    } else {
      if (Math.random() < 0.4) { p = round(pick([12.5, 37.5, 62.5]), 1); n = ri(2, 19) * 8; dec = 1; }
      else { p = pick([5, 15, 35, 45, 65, 85]); n = ri(12, 198); dec = 2; }
    }
    hint = p === 15 ? `15 % = 10 % + 5 %: ${fmt(n / 10)} + ${fmt(n / 20)} = ${fmtDec(round(n * 0.15, 2))}.`
      : p === 5 ? `5 % = la mitad del 10 %: ${fmtDec(round(n / 10, 2))} ÷ 2 = ${fmtDec(round(n * 0.05, 2))}.`
        : p === 40 ? `40 % = 4 × 10 %: ${fmtDec(round(n / 10, 2))} × 4 = ${fmtDec(round(n * 0.4, 2))}.`
          : p === 75 ? `75 % = 3/4: ${fmt(n)} ÷ 4 = ${fmtDec(round(n / 4, 2))} → × 3 = ${fmtDec(round(n * 0.75, 2))}.`
            : p === 10 ? `El 10 % es dividir entre 10: ${fmt(n)} ÷ 10 = ${fmtDec(round(n * 0.1, 2))}.`
              : p === 50 ? `El 50 % es la mitad: ${fmt(n)} ÷ 2 = ${fmtDec(round(n * 0.5, 2))}.`
                : p === 25 ? `El 25 % es la mitad de la mitad: ${fmt(n)} ÷ 2 = ${fmtDec(round(n / 2, 2))} → ÷ 2 = ${fmtDec(round(n * 0.25, 2))}.`
                  : p === 20 ? `El 20 % es el doble del 10 %: ${fmtDec(round(n / 10, 2))} × 2 = ${fmtDec(round(n * 0.2, 2))}.`
                    : `Descompón el porcentaje: ${fmtDec(p)} % de ${fmt(n)} = ${fmt(n)} × ${fmtDec(p)} ÷ 100 = ${fmtDec(round(n * p / 100, 2))}.`;
    const ans = round(n * p / 100, dec === 0 ? 0 : 2);
    return {
      q: `${fmtDec(p)} % de ${fmt(n)} = ?`,
      kind: 'number', answer: ans, tol: dec === 2 ? 0.5 : 0,
      hint
    };
  }

  /* -- 9. Regla de tres simple mental ----------------------------------- */
  function genRule3(lv, o) {
    o = o || {};
    const price = optVal(o, 'price');
    const items = [
      { s: 'lápices', u: '€' }, { s: 'botes de pintura', u: '€' }, { s: 'cafés', u: '€' },
      { s: 'libretas', u: '€' }, { s: 'manzanas', u: '€' }, { s: 'billetes de tren', u: '€' },
      { s: 'bolsas de nueces', u: '€' }, { s: 'entradas de cine', u: '€' }
    ];
    const it = pick(items);
    let a, c, b, tol = 0;
    if (price === 'enteros') {
      a = ri(2, 9); c = a * ri(2, 12); b = a * ri(2, 9) + ri(0, a - 1);
    } else if (price === 'centimos') {
      a = pick([3, 4, 6, 7, 8, 9]);
      c = round(a * ri(2, 9) * 0.5 + ri(1, 3) * 0.25, 2);
      b = ri(3, 19);
    } else if (lv === 'facil') {
      a = ri(2, 5); c = a * ri(2, 9); b = a * ri(2, 6);
    } else if (lv === 'medio') {
      a = pick([2, 3, 4, 5, 6, 8]);
      c = a * ri(2, 12) + (Math.random() < 0.35 ? 0.5 : 0);
      b = a * ri(2, 9) + ri(0, a - 1);
    } else {
      a = pick([3, 6, 7, 8, 9, 12]);
      c = round(a * ri(2, 9) * 0.5 + ri(0, 4) * 0.25, 2);
      b = ri(5, 29);
    }
    const ans = round(c / a * b, 2);
    if (price === 'centimos' || lv === 'dificil') tol = round(Math.max(0.02, ans * 0.02), 2);
    return {
      q: `Si ${a} ${it.s} cuestan ${fmtDec(c)} ${it.u}, ¿cuánto cuestan ${b}?`,
      sub: 'Regla de tres simple directa',
      kind: 'number', answer: ans, tol,
      hint: `Precio unitario: ${fmtDec(c)} ÷ ${a} = ${fmtDec(round(c / a, 2))} ${it.u} → × ${b} = ${fmtDec(ans)} ${it.u}.`
    };
  }

  /* -- 10. Fracciones equivalentes y comparación ------------------------- */
  function genFraction(lv, o) {
    o = o || {};
    const pool = {
      facil: [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [1, 10], [3, 10]],
      medio: [[1, 2], [2, 3], [3, 5], [5, 8], [3, 4], [7, 10], [4, 9], [2, 7], [5, 6], [3, 8], [7, 12]],
      dificil: [[5, 8], [7, 11], [9, 13], [11, 15], [17, 25], [13, 21], [23, 31], [19, 27]]
    }[lv];
    const task = optVal(o, 'task') || (lv !== 'facil' && Math.random() < 0.3 ? 'simplificar' : 'comparar');

    if (task === 'simplificar') {
      const [n0, d0] = pick(pool.filter((f) => gcd(f[0], f[1]) === 1));
      const k = ri(2, lv === 'medio' ? 6 : 12);
      const n = n0 * k, d = d0 * k;
      return {
        q: `Simplifica ${n}/${d} · ¿cuál es el numerador de la fracción irreducible?`,
        qHTML: `Simplifica ${fracHTML(n + '/' + d)} · ¿cuál es el <b>numerador</b> de la fracción irreducible?`,
        kind: 'number', answer: n0, tol: 0,
        hint: `Divide ambos términos por su máximo común divisor (${k}): ${n}/${d} = ${n0}/${d0}.`
      };
    }

    let [a, b] = shuffle(pool).slice(0, 2);
    let guard = 0;
    while (a[0] * b[1] === b[0] * a[1] && guard++ < 30) [a, b] = shuffle(pool).slice(0, 2);
    const fA = `${a[0]}/${a[1]}`, fB = `${b[0]}/${b[1]}`;
    const vA = a[0] / a[1], vB = b[0] / b[1];
    const correct = vA > vB ? fA : fB;
    const opts = new Set([correct, fA, fB]);
    if (lv !== 'facil') {
      opts.add(`${a[0] * 2}/${a[1] * 2}`);
      opts.add(`${b[0] + 1}/${b[1] + 1}`);
    }
    const options = shuffle([...opts]).slice(0, lv === 'facil' ? 2 : 3);
    if (!options.includes(correct)) options[0] = correct;
    return {
      q: `¿Qué fracción es mayor: ${fA} o ${fB}?`,
      qHTML: `¿Qué fracción es mayor: ${fracHTML(fA)} o ${fracHTML(fB)}?`,
      kind: 'mcq', answer: correct, options: shuffle(options), correct,
      hint: `Multiplica en cruz: ${a[0]}×${b[1]} = ${a[0] * b[1]} y ${b[0]}×${a[1]} = ${b[0] * a[1]}. Gana ${correct} (${round(Math.max(vA, vB), 3)} frente a ${round(Math.min(vA, vB), 3)}).`
    };
  }

  /* -- 11. Divisibilidad rápida ----------------------------------------- */
  function genDivisibility(lv, o) {
    o = o || {};
    const families = {
      basicos: [2, 3, 5, 10], sumas: [3, 9], finales: [4, 25],
      compuestos: [6, 12, 15], duros: [7, 8, 11]
    };
    const set = families[optVal(o, 'family')] ||
      { facil: [2, 3, 5, 10], medio: [3, 4, 6, 9, 25], dificil: [7, 8, 9, 11, 12, 15] }[lv];
    const range = { facil: [20, 199], medio: [40, 999], dificil: [120, 9999] }[lv];
    const d = pick(set);
    let n = ri(range[0], range[1]);
    const wantDivisible = Math.random() < 0.5;
    let guard = 0;
    while (((n % d === 0) !== wantDivisible) && guard++ < 200) n = ri(range[0], range[1]);
    const yes = n % d === 0;
    const digitSum = String(n).split('').reduce((s, c) => s + +c, 0);
    const rules = {
      2: 'termina en cifra par', 3: `la suma de sus cifras (${digitSum}) es múltiplo de 3`,
      4: `sus dos últimas cifras (${String(n).slice(-2)}) forman un múltiplo de 4`,
      5: 'termina en 0 o 5', 6: 'es par y divisible por 3', 7: 'al duplicar la última cifra y restarla al resto, queda un múltiplo de 7',
      8: `sus tres últimas cifras (${String(n).slice(-3)}) son múltiplo de 8`,
      9: `la suma de sus cifras (${digitSum}) es múltiplo de 9`,
      10: 'termina en 0', 11: 'la suma alterna de sus cifras es 0 o múltiplo de 11',
      12: 'es divisible por 3 y por 4', 15: 'termina en 0 o 5 y es divisible por 3',
      25: 'termina en 00, 25, 50 o 75'
    };
    return {
      q: `¿Es ${fmt(n)} divisible por ${d}?`,
      kind: 'mcq', answer: yes ? 'Sí' : 'No', options: ['Sí', 'No'], correct: yes ? 'Sí' : 'No',
      hint: `${yes ? 'Sí' : 'No'}: ${rules[d]}. ${fmt(n)} ÷ ${d} = ${yes ? fmt(n / d) : `${fmt(Math.floor(n / d))} y resto ${n % d}`}.`
    };
  }

  /* -- 12. Estimación con redondeo -------------------------------------- */
  function genEstimate(lv, o) {
    o = o || {};
    const r10 = (x) => Math.round(x / 10) * 10;
    const r100 = (x) => Math.round(x / 100) * 100;
    const op = optVal(o, 'op');
    const mode = op || (lv === 'dificil' ? pick(['mul', 'sum3', 'sumas']) : 'sumas');
    let exact, approx, tolPct, q, hint;
    if (mode === 'mul') {
      const a = ri(18, 96), b = ri(12, 49);
      exact = a * b; approx = r10(a) * r10(b); tolPct = 0.15;
      q = `${a} × ${b} ≈ ?`;
      hint = `Redondea cada factor a la decena: ${r10(a)} × ${r10(b)} = ${fmt(approx)} (exacto ${fmt(exact)}).`;
    } else if (mode === 'sum3') {
      const a = ri(1200, 9800), b = ri(800, 6900), c = ri(300, 2900);
      exact = a + b - c;
      approx = r100(a) + r100(b) - r100(c); tolPct = 0.08;
      q = `${fmt(a)} + ${fmt(b)} − ${fmt(c)} ≈ ?`;
      hint = `Trabaja en centenas: ${fmt(r100(a))} + ${fmt(r100(b))} − ${fmt(r100(c))} = ${fmt(approx)} (exacto ${fmt(exact)}).`;
    } else {
      const hundreds = lv !== 'facil';
      const rnd = hundreds ? r100 : r10;
      const [lo, hi] = hundreds ? [120, 980] : [16, 89];
      const a = ri(lo, hi), b = ri(lo, hi);
      const sgn = pick(['+', '+', '−']);
      exact = sgn === '+' ? a + b : a - b;
      approx = sgn === '+' ? rnd(a) + rnd(b) : rnd(a) - rnd(b);
      tolPct = hundreds ? 0.1 : 0.12;
      q = `${fmt(a)} ${sgn} ${fmt(b)} ≈ ?`;
      hint = `Redondea a ${hundreds ? 'centenas' : 'decenas'}: ${fmt(rnd(a))} ${sgn} ${fmt(rnd(b))} = ${fmt(approx)} (exacto ${fmt(exact)}).`;
    }
    return {
      q, sub: 'Se acepta cualquier valor próximo al redondeo correcto',
      kind: 'number', answer: exact, tol: Math.max(1, Math.round(Math.abs(exact) * tolPct)),
      hint, approx
    };
  }

  /* -- 13. Potencias y raíces aproximadas ------------------------------- */
  function genPower(lv, o) {
    o = o || {};
    const task = optVal(o, 'task');
    let mode;
    if (task === 'potencias') mode = pick(['p2', 'p3', 'pAny', 'cube']);
    else if (task === 'raices-exactas') mode = 'sqrtExact';
    else if (task === 'raices-aprox') mode = 'sqrtApprox';
    else mode = pick(lv === 'facil' ? ['p2', 'p3', 'sqrtExact']
      : lv === 'medio' ? ['pAny', 'cube', 'sqrtExact', 'sqrtApprox']
        : ['pBig', 'sqrtApprox', 'cubeBig', 'p2big']);
    let q, ans, hint, tol = 0, sub;
    if (mode === 'p2') {
      const e = ri(3, 7); ans = Math.pow(2, e); q = `2^${e} = ?`;
      hint = `Duplica ${e} veces partiendo de 1: 2^${e} = ${ans}.`;
    } else if (mode === 'p3') {
      const e = ri(2, 4); ans = Math.pow(3, e); q = `3^${e} = ?`;
      hint = `3^${e} = ${ans} (multiplica por 3, ${e} veces).`;
    } else if (mode === 'pAny') {
      const b = pick([2, 3, 4, 5, 6, 10]); const e = b === 10 ? ri(2, 4) : b <= 3 ? ri(3, 5) : ri(2, 3);
      ans = Math.pow(b, e); q = `${b}^${e} = ?`;
      hint = `${b}^${e} = ${ans}: encadena ${e} multiplicaciones por ${b}.`;
    } else if (mode === 'p2big') {
      const b = ri(11, 20); ans = b * b; q = `${b}² = ?`;
      hint = `Cuadrado con base cercana: ${b}² = ${ans}.`;
    } else if (mode === 'pBig') {
      const b = pick([2, 3, 5, 6, 7]); const e = b === 2 ? ri(7, 10) : b === 3 ? ri(4, 6) : ri(3, 4);
      ans = Math.pow(b, e); q = `${b}^${e} = ?`;
      hint = `Ancla en potencias conocidas: ${b}^${e} = ${fmt(ans)}.`;
    } else if (mode === 'cube') {
      const b = ri(2, 6); ans = b * b * b; q = `${b}³ = ?`;
      hint = `${b}³ = ${b} × ${b} × ${b} = ${ans}.`;
    } else if (mode === 'cubeBig') {
      const b = ri(6, 12); ans = b * b * b; q = `${b}³ = ?`;
      hint = `${b}² = ${b * b} → × ${b} = ${ans}.`;
    } else if (mode === 'sqrtExact') {
      const r = ri(4, lv === 'facil' ? 12 : 20); ans = r * r; q = `√${ans} = ?`;
      hint = `Busca el cuadrado perfecto: ${r}² = ${ans}, así que √${ans} = ${r}.`;
    } else {
      const n = ri(11, 399); const root = Math.sqrt(n); ans = Math.round(root); tol = 1;
      q = `√${n} ≈ ?`; sub = 'Escribe el número entero más cercano';
      hint = `Encuadra entre cuadrados: ${ans - 1}² = ${(ans - 1) * (ans - 1)} y ${ans}² = ${ans * ans} → √${n} ≈ ${round(root, 2)}.`;
    }
    return {
      q,
      qHTML: q.replace(/(\d+)\^(\d+)/g, '$1<sup>$2</sup>'),
      sub, kind: 'number', answer: ans, tol, hint
    };
  }

  /* -- 14. Conversiones de unidades ------------------------------------- */
  const CONV_GROUP = {
    km: 'longitud', 'm-cm': 'longitud', 'cm-m': 'longitud', kmDec: 'longitud', 'mm-m': 'longitud',
    'kg-g': 'masa', 'g-kg': 'masa', ton: 'masa',
    'h-min': 'tiempo', 'min-s': 'tiempo', 'min-h': 'tiempo', h2min: 'tiempo', hDec: 'tiempo', ms: 'tiempo',
    m2: 'espacio', 'km2-m2': 'espacio', cm3: 'espacio', 'L-mL': 'espacio',
    euros: 'otras'
  };
  function genConvert(lv, o) {
    o = o || {};
    const pool = {
      facil: ['km', 'h-min', 'm-cm', 'kg-g', 'min-s', 'euros'],
      medio: ['kmDec', 'cm-m', 'g-kg', 'min-h', 'm2', 'L-mL'],
      dificil: ['h2min', 'km2-m2', 'ms', 'ton', 'hDec', 'cm3', 'mm-m']
    }[lv];
    const g = optVal(o, 'mag');
    const filtered = g ? pool.filter((t) => CONV_GROUP[t] === g) : pool;
    const t = pick(filtered.length ? filtered : pool);
    const r = ri;
    let q, ans, unit, hint;
    if (t === 'km') { const v = r(2, 12); ans = v * 1000; unit = 'm'; q = `${v} km = ? m`; hint = `1 km = 1.000 m → ${v} × 1.000 = ${fmt(ans)} m.`; }
    else if (t === 'h-min') { const v = r(2, 9); ans = v * 60; unit = 'min'; q = `${v} h = ? min`; hint = `1 h = 60 min → ${v} × 60 = ${ans} min.`; }
    else if (t === 'm-cm') { const v = r(2, 25); ans = v * 100; unit = 'cm'; q = `${v} m = ? cm`; hint = `1 m = 100 cm → ${v} × 100 = ${ans} cm.`; }
    else if (t === 'kg-g') { const v = r(2, 20); ans = v * 1000; unit = 'g'; q = `${v} kg = ? g`; hint = `1 kg = 1.000 g → ${fmt(ans)} g.`; }
    else if (t === 'min-s') { const v = r(2, 15); ans = v * 60; unit = 's'; q = `${v} min = ? s`; hint = `1 min = 60 s → ${ans} s.`; }
    else if (t === 'euros') { const v = r(2, 20); ans = v * 100; unit = 'céntimos'; q = `${v} € = ? céntimos`; hint = `1 € = 100 céntimos → ${ans}.`; }
    else if (t === 'kmDec') { const v = round(r(11, 99) / 10, 1); ans = round(v * 1000, 0); unit = 'm'; q = `${fmtDec(v)} km = ? m`; hint = `${fmtDec(v)} × 1.000 = ${fmt(ans)} m (mueve la coma 3 lugares).`; }
    else if (t === 'cm-m') { const v = r(15, 250); ans = round(v / 100, 2); unit = 'm'; q = `${v} cm = ? m`; hint = `Divide entre 100: ${v} cm = ${fmtDec(ans)} m.`; }
    else if (t === 'g-kg') { const v = r(150, 4950); ans = round(v / 1000, 3); unit = 'kg'; q = `${fmt(v)} g = ? kg`; hint = `Divide entre 1.000: ${fmt(v)} g = ${fmtDec(ans)} kg.`; }
    else if (t === 'min-h') { const v = r(2, 11) * 15; ans = round(v / 60, 2); unit = 'h'; q = `${v} min = ? h`; hint = `${v} ÷ 60 = ${fmtDec(ans)} h.`; }
    else if (t === 'm2') { const v = r(2, 40); ans = v * 10000; unit = 'cm²'; q = `${v} m² = ? cm²`; hint = `Al ser superficie se eleva al cuadrado: 1 m² = 10.000 cm² → ${fmt(ans)} cm².`; }
    else if (t === 'L-mL') { const v = round(r(2, 25) / 10, 1); ans = round(v * 1000, 0); unit = 'mL'; q = `${fmtDec(v)} L = ? mL`; hint = `1 L = 1.000 mL → ${fmt(ans)} mL.`; }
    else if (t === 'h2min') { const h = r(1, 4); const m = r(1, 11) * 5; ans = h * 60 + m; unit = 'min'; q = `${h} h ${m} min = ? min`; hint = `${h} × 60 = ${h * 60} min + ${m} = ${ans} min.`; }
    else if (t === 'km2-m2') { const v = round(r(12, 48) / 10, 1); ans = round(v * 1000000, 0); unit = 'm²'; q = `${fmtDec(v)} km² = ? m²`; hint = `1 km² = 1.000.000 m² → ${fmt(ans)} m².`; }
    else if (t === 'ms') { const v = round(r(12, 98) / 10, 1); ans = round(v * 1000, 0); unit = 'ms'; q = `${fmtDec(v)} s = ? ms`; hint = `1 s = 1.000 ms → ${fmt(ans)} ms.`; }
    else if (t === 'ton') { const v = r(1200, 9800); ans = round(v / 1000, 3); unit = 't'; q = `${fmt(v)} kg = ? t`; hint = `Divide entre 1.000: ${fmtDec(ans)} t.`; }
    else if (t === 'hDec') { const v = round(r(12, 48) / 10, 1); ans = round(v * 60, 0); unit = 'min'; q = `${fmtDec(v)} h = ? min`; hint = `${fmtDec(v)} × 60 = ${fmt(ans)} min.`; }
    else if (t === 'mm-m') { const v = r(1200, 9800); ans = round(v / 1000, 2); unit = 'm'; q = `${fmt(v)} mm = ? m`; hint = `Divide entre 1.000: ${fmt(v)} mm = ${fmtDec(ans)} m.`; }
    else { const v = r(2, 9); ans = v * 1000000; unit = 'cm³'; q = `${v} m³ = ? cm³`; hint = `En volumen el factor se eleva al cubo: 1 m³ = 1.000.000 cm³ → ${fmt(ans)} cm³.`; }
    return { q, kind: 'number', answer: ans, tol: 0, unit, hint };
  }

  /* -- 15. Secuencias y patrones ---------------------------------------- */
  function genSequence(lv, o) {
    o = o || {};
    const fam = optVal(o, 'family');
    const scale = { facil: 0, medio: 1, dificil: 2 }[lv];

    const aritm = () => {
      if (scale === 2 && Math.random() < 0.5) {
        const a0 = ri(1, 6); const d0 = ri(2, 5); const dd = ri(2, 4);
        const terms = [a0]; let d = d0;
        for (let i = 1; i < 5; i++) { terms.push(terms[i - 1] + d); d += dd; }
        return { terms, ans: terms[4] + d, rule: `Las diferencias crecen de ${dd} en ${dd}: serie de segundo orden.` };
      }
      if (scale >= 1 && Math.random() < 0.4) {
        const a0 = ri(3, 12); const d1 = ri(2, 6); const d2 = d1 + ri(1, 4);
        const terms = [a0, a0 + d1, a0 + d1 + d2, a0 + 2 * d1 + 2 * d2];
        return { terms, ans: terms[3] + d1, rule: `Alterna sumas: +${d1}, +${d2}, +${d1}, +${d2}…` };
      }
      const d = pick(scale === 0 ? [2, 3, 4, 5, 10] : scale === 1 ? [3, 6, 7, 8, 9] : [6, 11, 13, 17, 19]);
      const a0 = ri(2, scale === 0 ? 20 : scale === 1 ? 40 : 90);
      const terms = [0, 1, 2, 3].map((i) => a0 + d * i);
      return { terms, ans: a0 + d * 4, rule: `Progresión aritmética: se suma ${d} en cada paso.` };
    };
    const geo = () => {
      if (scale === 2 && Math.random() < 0.4) {
        const a0 = pick([8, 12, 16, 24]);
        const terms = [0, 1, 2, 3].map((i) => round(a0 * Math.pow(1.5, i), 2));
        return { terms, ans: round(a0 * Math.pow(1.5, 4), 2), rule: 'Cada término es 1,5 veces el anterior (crecimiento del 50 %).' };
      }
      const r0 = scale === 0 ? 2 : pick([2, 3, 4]);
      const a0 = ri(1, scale === 0 ? 6 : 4);
      const terms = [0, 1, 2, 3].map((i) => a0 * Math.pow(r0, i));
      return { terms, ans: a0 * Math.pow(r0, 4), rule: `Progresión geométrica: se multiplica por ${r0}.` };
    };
    const especial = () => {
      const mode = pick(['triang', 'cuadrado', 'fib']);
      if (mode === 'triang') {
        const t = (n) => n * (n + 1) / 2;
        const start = scale === 0 ? 1 : ri(1, 4);
        const terms = [0, 1, 2, 3, 4].map((i) => t(start + i));
        return { terms, ans: t(start + 5), rule: 'Números triangulares: se suma 2, 3, 4, 5, 6… (n·(n+1)/2).' };
      }
      if (mode === 'cuadrado') {
        const k = pick([0, 1]);
        const start = scale === 0 ? 1 : ri(1, 5);
        const terms = [0, 1, 2, 3, 4].map((i) => (start + i) * (start + i) + k);
        return { terms, ans: (start + 5) * (start + 5) + k, rule: `Cuadrados perfectos${k ? ' más 1' : ''}: n².` };
      }
      let a = ri(1, 4), b = a + ri(1, 3 + scale);
      const terms = [a, b];
      for (let i = 2; i < 5; i++) terms.push(terms[i - 1] + terms[i - 2]);
      return { terms, ans: terms[4] + terms[3], rule: 'Tipo Fibonacci: cada término suma los dos anteriores.' };
    };
    const mixta = () => {
      const a0 = ri(2, 8);
      const terms = [a0];
      for (let i = 0; i < 4; i++) terms.push(terms[i] * 2 + (i % 2 === 0 ? 1 : -1));
      return { terms, ans: terms[4] * 2 + 1, rule: 'Doble y alterna +1 / −1.' };
    };

    let res;
    if (fam === 'aritmeticas') res = aritm();
    else if (fam === 'geometricas') res = geo();
    else if (fam === 'especiales') res = especial();
    else if (fam === 'mixtas') res = Math.random() < 0.5 ? mixta() : aritm();
    else res = scale === 0 ? (Math.random() < 0.6 ? aritm() : geo())
      : scale === 1 ? pick([especial, especial, aritm, geo])()
        : pick([geo, especial, mixta, aritm])();

    return {
      q: `${res.terms.map(fmt).join(', ')},  ¿?`,
      sub: '¿Qué número continúa la serie?',
      kind: 'number', answer: round(res.ans, 2), tol: 0,
      hint: `${res.rule} El siguiente término es ${fmtDec(res.ans)}.`
    };
  }

  /* ---------- Metadatos del catálogo ---------- */
  const CATEGORIES = [
    {
      id: 'chain', num: '01', icon: '🔗', color: '#0ea5e9', name: 'Sumas y restas encadenadas',
      trains: 'Memoria operativa', example: '47 + 28 − 19', gen: genChain,
      range: {
        facil: '3 términos · resultado positivo',
        medio: '4 términos con signo mixto',
        dificil: '4 términos · signos aleatorios'
      }
    },
    {
      id: 'complement', num: '02', icon: '🎯', color: '#f59e0b', name: 'Complementos a 10, 100 o 1000',
      trains: 'Rapidez', example: '¿Cuánto le falta a 73 para 100?', gen: genComplement,
      range: {
        facil: 'Complementos a 10 y a 100',
        medio: 'Complementos a 100 y a 1000',
        dificil: 'Complementos a 1000 y decimales (a 1)'
      }
    },
    {
      id: 'double', num: '03', icon: '🪞', color: '#8b5cf6', name: 'Dobles y mitades sucesivas',
      trains: 'Fluidez', example: 'Doble de 48 · mitad de 136', gen: genDoubleHalf,
      range: {
        facil: 'Dobles y mitades exactos',
        medio: 'Mitades con decimales',
        dificil: 'Decimales y mitades impares'
      }
    },
    {
      id: 'mul5', num: '04', icon: '⚡', color: '#eab308', name: 'Multiplicar por 5, 25 y 50',
      trains: 'Atajos', example: '36 × 5 · 24 × 25', gen: genMul5,
      range: {
        facil: 'Solo × 5',
        medio: '× 5, × 25 y × 50 con factores "amables"',
        dificil: 'Factores grandes y × 25 con impares'
      }
    },
    {
      id: 'mul11', num: '05', icon: '🔢', color: '#14b8a6', name: 'Multiplicar por 11',
      trains: 'Patrones', example: '34 × 11', gen: genMul11,
      range: {
        facil: 'Truco directo sin acarreo',
        medio: 'Sin acarreo (suma de cifras ≤ 9)',
        dificil: 'Con acarreo y términos largos'
      }
    },
    {
      id: 'square', num: '06', icon: '🟦', color: '#6366f1', name: 'Cuadrados cercanos a una base',
      trains: '(a ± b)²', example: '19² · 21² · 48²', gen: genSquare,
      range: {
        facil: 'Bases 10 y 25 (11–25)',
        medio: 'Bases 25 y 50 (26–59)',
        dificil: 'Bases 50, 100 y 125 (38–125)'
      }
    },
    {
      id: 'decomp', num: '07', icon: '🧩', color: '#22c55e', name: 'Descomposición para multiplicar',
      trains: 'Distributiva', example: '17 × 6 = 10×6 + 7×6', gen: genDecomp,
      range: {
        facil: '2 cifras × 1 cifra',
        medio: '3 cifras × 1 cifra',
        dificil: '2 × 2 cifras y 3 × 2 cifras'
      }
    },
    {
      id: 'percent', num: '08', icon: '💯', color: '#ec4899', name: 'Porcentajes mentales',
      trains: 'Proporciones', example: '15 % de 80 · 25 % de 240', gen: genPercent,
      range: {
        facil: '10 %, 20 %, 25 % y 50 % de números redondos',
        medio: '5 %, 15 %, 40 %, 75 % y cantidades con decimales',
        dificil: 'Porcentajes raros (12,5 %; 37,5 %) y porcentajes encadenados'
      }
    },
    {
      id: 'rule3', num: '09', icon: '⚖️', color: '#f97316', name: 'Regla de tres simple mental',
      trains: 'Proporcionalidad', example: 'Si 4 lápices cuestan 6 €, ¿9?', gen: genRule3,
      range: {
        facil: 'Divisores pequeños y precios enteros',
        medio: 'Precios con 50 céntimos',
        dificil: 'Precio unitario no entero (se admite ±2 % por redondeo mental)'
      }
    },
    {
      id: 'fraction', num: '10', icon: '➗', color: '#a855f7', name: 'Fracciones equivalentes y comparación',
      trains: 'Sentido numérico', example: '¿Qué es mayor: 3/5 o 5/8?', gen: genFraction,
      range: {
        facil: 'Comparación con denominadores ≤ 10',
        medio: 'Comparación + simplificación de fracciones',
        dificil: 'Denominadores grandes y fracciones muy próximas'
      }
    },
    {
      id: 'divis', num: '11', icon: '🧮', color: '#06b6d4', name: 'Divisibilidad rápida',
      trains: 'Criterios', example: '¿Es 738 divisible por 3?', gen: genDivisibility,
      range: {
        facil: 'Criterios del 2, 3, 5 y 10 con 2–3 cifras',
        medio: 'Se añaden 4, 6, 9 y 25',
        dificil: 'Se añaden 7, 8, 11, 12 y 15 (hasta 4 cifras)'
      }
    },
    {
      id: 'estimate', num: '12', icon: '📏', color: '#84cc16', name: 'Estimación con redondeo',
      trains: 'Aproximación', example: '198 + 304 ≈ ?', gen: genEstimate,
      range: {
        facil: 'Sumas y restas redondeadas a decenas (±12 %)',
        medio: '3 cifras redondeadas a centenas (±10 %)',
        dificil: 'Productos y encadenados de 4 cifras (±8–15 %)'
      }
    },
    {
      id: 'power', num: '13', icon: '🚀', color: '#ef4444', name: 'Potencias y raíces aproximadas',
      trains: 'Potencias', example: '2⁷ · √50 ≈ ?', gen: genPower,
      range: {
        facil: 'Potencias de 2 y 3 y raíces exactas',
        medio: 'Otras bases, cubos y raíces aproximadas (±1)',
        dificil: 'Exponentes altos y raíces hasta √399 (±1)'
      }
    },
    {
      id: 'convert', num: '14', icon: '📐', color: '#0d9488', name: 'Conversiones de unidades',
      trains: 'Decimales', example: '2,5 km a m · 45 min a horas', gen: genConvert,
      range: {
        facil: 'km, m, cm, kg, g, h, min y euros',
        medio: 'Factores decimales, superficie y capacidad',
        dificil: 'Unidades compuestas, km², m³, ms y toneladas'
      }
    },
    {
      id: 'sequence', num: '15', icon: '🌀', color: '#d946ef', name: 'Secuencias y patrones',
      trains: 'Lógica', example: '2, 6, 12, 20, ¿?', gen: genSequence,
      range: {
        facil: 'Aritméticas y duplicaciones',
        medio: 'Triangulares, cuadrados, Fibonacci y alternas',
        dificil: 'Geométricas (×3, ×1,5), segundo orden y mixtas'
      }
    }
  ];

  const CAT_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

  /* ---------- Opciones configurables por categoría ----------
     Cada grupo: { id, label, def, type?, choices: [[valor, etiqueta], …] }   */
  const CAT_OPTS = {
    chain: [
      { id: 'op', label: 'Operaciones', def: 'mixtas', choices: [['mixtas', 'Mixtas'], ['sumas', 'Solo sumas'], ['restas', 'Solo restas']] },
      { id: 'digits', label: 'Cifras de los términos', def: 'auto', note: '«Auto» sigue el tamaño del nivel; un valor fijo lo sustituye y el nivel sigue mandando sobre términos y operaciones', choices: [['auto', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3']] }
    ],
    complement: [
      { id: 'target', label: 'Complemento a…', def: 'auto', type: 'select', choices: [['auto', 'Auto (según nivel)'], ['10', '10'], ['100', '100'], ['1000', '1000'], ['dec', '1 (decimales)']] }
    ],
    double: [
      { id: 'kind', label: 'Qué practicar', def: 'mixto', choices: [['mixto', 'Mixto'], ['dobles', 'Dobles'], ['mitades', 'Mitades']] },
      { id: 'digits', label: 'Cifras del número', def: 'auto', note: '«Auto» sigue el tamaño del nivel; un valor fijo lo sustituye y el nivel sigue mandando sobre términos y operaciones', choices: [['auto', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3']] }
    ],
    mul5: [
      { id: 'factor', label: 'Factor', def: 'auto', choices: [['auto', 'Auto'], ['5', '×5'], ['25', '×25'], ['50', '×50']] },
      { id: 'digits', label: 'Cifras del número', def: 'auto', note: '«Auto» sigue el tamaño del nivel; un valor fijo lo sustituye y el nivel sigue mandando sobre términos y operaciones', choices: [['auto', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3']] }
    ],
    mul11: [
      { id: 'digits', label: 'Cifras del número', def: 'auto', note: '«Auto» sigue el tamaño del nivel; un valor fijo lo sustituye y el nivel sigue mandando sobre términos y operaciones', choices: [['auto', 'Auto'], ['1', '1'], ['2', '2'], ['3', '3']] }
    ],
    square: [
      { id: 'range', label: 'Rango de la base', def: 'auto', choices: [['auto', 'Auto'], ['bajas', '11–30'], ['medias', '31–60'], ['altas', '61–125']] }
    ],
    decomp: [
      { id: 'shape', label: 'Forma del producto', def: 'auto', choices: [['auto', 'Auto'], ['2x1', '2 cifras × 1'], ['3x1', '3 cifras × 1'], ['2x2', '2 cifras × 2']] }
    ],
    percent: [
      { id: 'kind', label: 'Tipo de porcentaje', def: 'auto', choices: [['auto', 'Auto'], ['amables', 'Amables'], ['raros', 'Raros'], ['encadenados', 'Encadenados']] }
    ],
    rule3: [
      { id: 'price', label: 'Precios', def: 'auto', choices: [['auto', 'Auto'], ['enteros', 'Enteros'], ['centimos', 'Con céntimos']] }
    ],
    fraction: [
      { id: 'task', label: 'Tarea', def: 'auto', choices: [['auto', 'Auto'], ['comparar', 'Comparar'], ['simplificar', 'Simplificar']] }
    ],
    divis: [
      { id: 'family', label: 'Criterios de divisibilidad', def: 'auto', type: 'select', choices: [['auto', 'Auto (según nivel)'], ['basicos', '2, 3, 5 y 10'], ['sumas', '3 y 9 (suma de cifras)'], ['finales', '4 y 25 (cifras finales)'], ['compuestos', '6, 12 y 15'], ['duros', '7, 8 y 11']] }
    ],
    estimate: [
      { id: 'op', label: 'Operación a estimar', def: 'auto', choices: [['auto', 'Auto'], ['sumas', 'Sumas y restas'], ['productos', 'Productos'], ['encadenados', 'Encadenados']] }
    ],
    power: [
      { id: 'task', label: 'Tarea', def: 'auto', choices: [['auto', 'Auto'], ['potencias', 'Potencias'], ['raices-exactas', 'Raíces exactas'], ['raices-aprox', 'Raíces aproximadas']] }
    ],
    convert: [
      { id: 'mag', label: 'Magnitud', def: 'auto', type: 'select', choices: [['auto', 'Auto (según nivel)'], ['longitud', 'Longitud'], ['masa', 'Masa'], ['tiempo', 'Tiempo'], ['espacio', 'Superficie y volumen'], ['otras', 'Euros y céntimos']] }
    ],
    sequence: [
      { id: 'family', label: 'Familia de series', def: 'auto', choices: [['auto', 'Auto'], ['aritmeticas', 'Aritméticas'], ['geometricas', 'Geométricas'], ['especiales', 'Especiales']] }
    ]
  };
  CATEGORIES.forEach((c) => { c.opts = CAT_OPTS[c.id] || []; });

  /** Opciones por defecto de una categoría. */
  function defaultOpts(cat) {
    const out = {};
    (cat.opts || []).forEach((g) => { out[g.id] = g.def; });
    return out;
  }
  /** Opciones efectivas (por defecto + guardadas por el usuario). */
  function resolveOpts(cat) {
    const saved = (DATA.prefs.catOpts || {})[cat.id] || {};
    const out = {};
    (cat.opts || []).forEach((g) => {
      out[g.id] = g.choices.some((ch) => ch[0] === saved[g.id]) ? saved[g.id] : g.def;
    });
    return out;
  }

  /* ======================================================================
     2. NORMALIZACIÓN Y CORRECCIÓN DE RESPUESTAS
     ====================================================================== */

  function normalizeNumber(raw) {
    const c = normalizeCandidates(raw);
    return c.length ? c[0] : null;
  }

  function normalizeCandidates(raw) {
    if (typeof raw !== 'string' && typeof raw !== 'number') return [];
    let s = String(raw).trim()
      .replace(/[\u00a0\u2007\u202f\s]/g, '')
      .replace(/^\+/, '')
      .replace(/−/g, '-');
    if (!s) return [];
    let neg = false;
    if (s.startsWith('-')) { neg = true; s = s.slice(1); }

    const variants = [s];
    const hasComma = s.includes(','), hasDot = s.includes('.');

    if (hasComma && hasDot) {
      if ((s.match(/,/g) || []).length > 1) return [];
      variants.splice(0, 1, s.replace(/\./g, '').replace(',', '.'));
    } else if (hasComma) {
      const parts = s.split(',');
      if (parts.length > 2) return [];
      else if (/^\d{3}$/.test(parts[1]) && /^\d{1,3}$/.test(parts[0])) {
        variants[0] = parts.join('');
        variants.push(s.replace(',', '.'));
      } else variants.splice(0, 1, s.replace(',', '.'));
    } else if (hasDot) {
      const parts = s.split('.');
      if (parts.length > 2) variants.splice(0, 1, parts.join(''));
      else if (/^\d{3}$/.test(parts[1]) && /^\d{1,3}$/.test(parts[0])) {
        variants.splice(0, 1, parts.join(''));
      }
    }

    const out = [];
    for (const v of variants) {
      if (!/^(\d+\.?\d*|\.\d+)$/.test(v)) continue;
      const n = parseFloat(v) * (neg ? -1 : 1);
      if (Number.isFinite(n) && !out.includes(n)) out.push(n);
    }
    return out;
  }

  function grade(ex, response) {
    if (ex.kind === 'mcq') {
      const ok = String(response).trim().toLowerCase() === String(ex.answer).trim().toLowerCase();
      return { ok, value: response, expected: String(ex.answer) };
    }
    const candidates = normalizeCandidates(response);
    if (candidates.length === 0) {
      return { ok: false, value: null, expected: expectedText(ex), invalid: true };
    }
    const tol = Math.max(0, ex.tol || 0);
    const match = candidates.find((v) => Math.abs(v - ex.answer) <= tol + 1e-9);
    return {
      ok: match !== undefined,
      value: match !== undefined ? match : candidates[0],
      expected: expectedText(ex)
    };
  }

  function expectedText(ex) {
    if (ex.kind === 'mcq') return String(ex.answer);
    const v = ex.answer;
    const isInt = Number.isInteger(v);
    return isInt ? fmt(v) : fmtDec(v);
  }

  /* ======================================================================
     3. PERSISTENCIA · localStorage (con respaldo en memoria para file://)
     ====================================================================== */
  const STORAGE_KEY = 'menteagil.v1';
  let memoryFallback = null;
  const store = {
    get(k) {
      try { return window.localStorage.getItem(k); } catch (e) { return memoryFallback ? memoryFallback[k] ?? null : null; }
    },
    set(k, v) {
      try { window.localStorage.setItem(k, v); } catch (e) { (memoryFallback = memoryFallback || {})[k] = v; }
    }
  };

  const DEFAULT_DATA = () => ({
    cats: {},
    totalMs: 0,
    history: [],
    prefs: {
      level: 'facil', length: 10, timer: true, hints: true, lastCat: 'chain',
      autoNext: true, theme: 'claro', palette: 'turquesa', catOpts: {}
    }
  });

  let DATA = load();
  function load() {
    let d = DEFAULT_DATA();
    try {
      const raw = store.get(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        d = { ...d, ...parsed, prefs: { ...d.prefs, ...(parsed.prefs || {}) }, cats: parsed.cats || {} };
      }
    } catch (e) { /* datos corruptos → valores por defecto */ }
    CATEGORIES.forEach((c) => {
      d.cats[c.id] = d.cats[c.id] || { ok: 0, wrong: 0, sessions: 0, bestStreak: 0, lastPlayed: null };
    });
    return d;
  }
  function save() {
    try { store.set(STORAGE_KEY, JSON.stringify(DATA)); } catch (e) { /* cuota llena: se ignora */ }
  }
  function catStats(id) { return DATA.cats[id] || (DATA.cats[id] = { ok: 0, wrong: 0, sessions: 0, bestStreak: 0, lastPlayed: null }); }

  /* ======================================================================
     3b. TEMAS Y PALETAS
     ====================================================================== */
  const THEMES = ['claro', 'oscuro', 'lectura'];
  const THEME_ICON = { claro: '#i-sun', oscuro: '#i-moon', lectura: '#i-book' };
  const THEME_META = { claro: '#f4f7f6', oscuro: '#0d1418', lectura: '#f2ead9' };
  const PALETTES = [
    { id: 'turquesa', label: 'Turquesa', a: '#0d9488', b: '#0a6f65' },
    { id: 'indigo', label: 'Índigo', a: '#4f46e5', b: '#3730a3' },
    { id: 'bosque', label: 'Bosque', a: '#16a34a', b: '#166534' },
    { id: 'ambar', label: 'Ámbar', a: '#b45309', b: '#7c2d12' },
    { id: 'fucsia', label: 'Fucsia', a: '#db2777', b: '#9f1239' },
    { id: 'oceano', label: 'Océano', a: '#0369a1', b: '#075985' },
    { id: 'violeta', label: 'Violeta', a: '#7c3aed', b: '#5b21b6' },
    { id: 'cian', label: 'Cian', a: '#0e7490', b: '#155e75' },
    { id: 'lima', label: 'Lima', a: '#4d7c0f', b: '#3f6212' },
    { id: 'rubi', label: 'Rubí', a: '#be123c', b: '#9f1239' },
    { id: 'coral', label: 'Coral', a: '#ea580c', b: '#c2410c' },
    { id: 'grafito', label: 'Grafito', a: '#475569', b: '#334155' },
    { id: 'azul', label: 'Azul', a: '#2563eb', b: '#1d4ed8' },
    { id: 'magenta', label: 'Magenta', a: '#c026d3', b: '#a21caf' },
    { id: 'menta', label: 'Menta', a: '#059669', b: '#047857' },
    { id: 'petroleo', label: 'Petróleo', a: '#115e59', b: '#134e4a' },
    { id: 'rojo', label: 'Rojo', a: '#dc2626', b: '#b91c1c' },
    { id: 'noche', label: 'Noche', a: '#1e293b', b: '#0f172a' }
  ];
  const SUPPORTS_MIX = typeof CSS !== 'undefined' && !!CSS.supports &&
    CSS.supports('color', 'color-mix(in srgb, red, blue)');

  /* ======================================================================
     4. ESTADO
     ====================================================================== */
  const S = {
    view: 'home',
    catId: DATA.prefs.lastCat && CAT_BY_ID[DATA.prefs.lastCat] ? DATA.prefs.lastCat : CATEGORIES[0].id,
    level: LEVELS[DATA.prefs.level] ? DATA.prefs.level : 'facil',
    length: [5, 10, 20, 0].includes(DATA.prefs.length) ? DATA.prefs.length : 10,
    timerVisible: DATA.prefs.timer !== false,
    hints: DATA.prefs.hints !== false,
    autoNext: DATA.prefs.autoNext !== false,
    theme: THEMES.includes(DATA.prefs.theme) ? DATA.prefs.theme : 'claro',
    palette: PALETTES.some((p) => p.id === DATA.prefs.palette) ? DATA.prefs.palette : 'turquesa',
    nextTimer: null,
    paused: false,
    ex: null,
    idx: 0,
    ok: 0, wrong: 0,
    streak: 0, bestStreak: 0,
    elapsed: 0, running: false, started: false, lastTick: 0, tickId: null,
    answered: false,
    qStartedAt: 0,
    sessionStartedAt: 0,
    results: [],
    selected: null,
    summaryOpen: false
  };
  const totalOfSession = () => (S.length === 0 ? Infinity : S.length);

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const el = {
    body: document.body,
    // cabecera
    btnBrand: $('#btnBrand'), btnHeaderHome: $('#btnHeaderHome'), btnHeaderPractice: $('#btnHeaderPractice'),
    btnSettings: $('#btnSettings'), btnTheme: $('#btnTheme'),
    headerBadges: $('#headerBadges'), hbadgeCat: $('#hbadgeCat'), hbadgeLevel: $('#hbadgeLevel'),
    // catálogo
    catGrid: $('#catGrid'), globalStats: $('#globalStats'), searchInput: $('#searchInput'),
    homeLevelSeg: $('#homeLevelSeg'), emptyNote: $('#emptyNote'), btnResetStats: $('#btnResetStats'),
    btnHeroStart: $('#btnHeroStart'), btnHeroRandom: $('#btnHeroRandom'),
    historySection: $('#historySection'), historyList: $('#historyList'),
    // topbar
    btnBack: $('#btnBack'), topbarCat: $('#topbarCat'), topbarLevel: $('#topbarLevel'), topbarProgress: $('#topbarProgress'),
    // config
    selCategory: $('#selCategory'), levelSeg: $('#levelSeg'), levelRange: $('#levelRange'),
    catOptsBox: $('#catOptsBox'), chkAutoNext: $('#chkAutoNext'),
    themeSeg: $('#themeSeg'), paletteRow: $('#paletteRow'),
    selLength: $('#selLength'), chkTimer: $('#chkTimer'), chkHints: $('#chkHints'),
    btnPause: $('#btnPause'), btnPauseLabel: $('#btnPauseLabel'), btnResetSession: $('#btnResetSession'),
    // ejercicio
    panelCatIcon: $('#panelCatIcon'), panelCatName: $('#panelCatName'), panelCatTrains: $('#panelCatTrains'),
    pillProgress: $('#pillProgress'), stage: $('#stage'), stageKicker: $('#stageKicker'),
    stageStreak: $('#stageStreak'), stageStreakTxt: $('#stageStreakTxt'),
    question: $('#question'), questionSub: $('#questionSub'),
    answerForm: $('#answerForm'), answerInput: $('#answerInput'), answerUnit: $('#answerUnit'),
    mcq: $('#mcq'), answerHelp: $('#answerHelp'), btnCheck: $('#btnCheck'), btnNext: $('#btnNext'),
    feedback: $('#feedback'), hintBox: $('#hintBox'), hintText: $('#hintText'),
    pauseVeil: $('#pauseVeil'), btnResume: $('#btnResume'),
    // stats
    timerCard: $('#timerCard'), timerValue: $('#timerValue'), timerNote: $('#timerNote'),
    statOk: $('#statOk'), statBad: $('#statBad'), progressTxt: $('#progressTxt'),
    progressBar: $('#progressBar'), progressFill: $('#progressFill'), progressDots: $('#progressDots'),
    statAcc: $('#statAcc'), statStreak: $('#statStreak'), statAvg: $('#statAvg'),
    catOk: $('#catOk'), catBad: $('#catBad'), catFill: $('#catFill'),
    // resumen
    overlay: $('#summaryOverlay'), sumEmoji: $('#sumEmoji'), sumTitle: $('#sumTitle'), sumSub: $('#sumSub'),
    sumRing: $('#sumRing'), sumPct: $('#sumPct'), sumStats: $('#sumStats'), sumMsg: $('#sumMsg'),
    sumAgain: $('#sumAgain'), sumHome: $('#sumHome'),
    // drawer · configuración general
    settingsDrawer: $('#settingsDrawer'), drawerOverlay: $('#drawerOverlay'),
    btnCloseSettings: $('#btnCloseSettings'),
    // varios
    toasts: $('#toasts'), confetti: $('#confetti'), srAnnounce: $('#srAnnounce')
  };

  /* ======================================================================
     5. VISTA CATÁLOGO
     ====================================================================== */
  function exampleOf(cat) {
    try {
      const ex = cat.gen('facil', resolveOpts(cat));
      return `${ex.q.replace(' = ?', '').replace(',  ¿?', ', …').replace(' ?', '')}  →  ${expectedText(ex)}`;
    } catch (e) { return cat.example; }
  }

  function renderCatalog(filter = '') {
    const q = filter.trim().toLowerCase();
    const list = CATEGORIES.filter((c) =>
      !q || c.name.toLowerCase().includes(q) || c.trains.toLowerCase().includes(q) || c.num.includes(q)
    );
    el.catGrid.innerHTML = list.map((c) => {
      const st = catStats(c.id);
      const total = st.ok + st.wrong;
      const acc = total ? Math.round((st.ok / total) * 100) : 0;
      return `
      <article class="cat-card" style="--cat:${c.color};--cat-soft:${catSoft(c.color)};--cat-deep:${catDeep(c.color)}">
        <div class="cat-top">
          <span class="cat-ic" aria-hidden="true">${c.icon}</span>
          <div class="cat-titles">
            <span class="cat-num">Categoría ${c.num}</span>
            <h3 class="cat-name">${esc(c.name)}</h3>
            <span class="cat-trains">Qué entrena: ${esc(c.trains)}</span>
          </div>
        </div>
        <p class="cat-example"><em>Ejemplo</em>${esc(exampleOf(c))}</p>
        <div class="cat-foot">
          <div class="cat-stats">
            <div class="cat-stats-row">
              <b>${st.ok}</b> aciertos · <b>${st.wrong}</b> fallos${total ? ` · <b>${acc}%</b>` : ''}
            </div>
            <div class="bar-mini"><i style="width:${acc}%"></i></div>
          </div>
          <button class="btn btn-sm" type="button" data-practice="${c.id}">
            Practicar <svg class="icon" aria-hidden="true" style="width:16px;height:16px"><use href="#i-arrow-right"/></svg>
          </button>
        </div>
      </article>`;
    }).join('');
    el.emptyNote.hidden = list.length !== 0;
  }

  function renderGlobalStats() {
    let ok = 0, wrong = 0, sessions = 0, best = 0;
    CATEGORIES.forEach((c) => {
      const st = catStats(c.id);
      ok += st.ok; wrong += st.wrong; sessions += st.sessions; best = Math.max(best, st.bestStreak || 0);
    });
    const total = ok + wrong;
    const acc = total ? Math.round((ok / total) * 100) : 0;
    el.globalStats.innerHTML = `
      <div class="gstat is-ok"><b>${fmt(ok)}</b><span>Aciertos</span></div>
      <div class="gstat is-bad"><b>${fmt(wrong)}</b><span>Fallos</span></div>
      <div class="gstat is-brand"><b>${total ? acc + '%' : '—'}</b><span>Precisión</span></div>
      <div class="gstat"><b>${fmtDur(DATA.totalMs)}</b><span>Tiempo</span></div>
      <p class="hero-stats-foot">
        <svg class="icon" aria-hidden="true" style="width:16px;height:16px;color:var(--brand)"><use href="#i-trophy"/></svg>
        ${total === 0
          ? 'Todavía no hay datos: tu progreso se guarda automáticamente en este navegador.'
          : `${sessions} sesión${sessions === 1 ? '' : 'es'} completada${sessions === 1 ? '' : 's'} · mejor racha: ${best} aciertos seguidos`}
      </p>`;
  }

  function renderHistory() {
    const h = DATA.history || [];
    el.historySection.hidden = h.length === 0;
    if (!h.length) { el.historyList.innerHTML = ''; return; }
    const rows = h.slice(0, 8).map((s) => {
      const c = CAT_BY_ID[s.cat] || CATEGORIES[0];
      const acc = s.total ? Math.round((s.ok / s.total) * 100) : 0;
      const tone = acc >= 70 ? 'good' : acc >= 40 ? 'mid' : 'low';
      return `<tr style="--cat:${c.color}">
        <td><span class="h-cat"><span class="h-dot" aria-hidden="true"></span>${c.icon} ${esc(c.name)}</span></td>
        <td>${esc(LEVELS[s.level] || s.level)}</td>
        <td><b>${s.ok}</b> / ${s.total}</td>
        <td><span class="h-acc ${tone}">${acc} %</span></td>
        <td class="h-mono">${fmtTime(s.ms)}</td>
        <td class="h-dim">${esc(s.when)}</td>
      </tr>`;
    }).join('');
    el.historyList.innerHTML = `<div class="table-wrap"><table class="history-table">
      <caption class="sr-only">Registro de las últimas sesiones practicadas</caption>
      <thead><tr>
        <th scope="col">Categoría</th><th scope="col">Nivel</th><th scope="col">Aciertos</th>
        <th scope="col">Precisión</th><th scope="col">Tiempo</th><th scope="col">Cuándo</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
  }

  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function catSoft(color) { return hexA(color, S.theme === 'oscuro' ? 0.2 : 0.13); }
  function catDeep(color) {
    if (SUPPORTS_MIX) return `color-mix(in srgb, ${color} ${S.theme === 'oscuro' ? 72 : 62}%, var(--ink))`;
    return shade(color, S.theme === 'oscuro' ? 0.42 : -0.45);
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (v) => clamp(Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt), 0, 255);
    r = f(r); g = f(g); b = f(b);
    return `rgb(${r},${g},${b})`;
  }

  /* ======================================================================
     6. VISTA DASHBOARD · render
     ====================================================================== */
  function setView(v) {
    S.view = v;
    el.body.dataset.view = v;
    el.btnHeaderHome.hidden = v !== 'practice';
    el.btnHeaderPractice.hidden = v === 'practice';
    el.headerBadges.hidden = v !== 'practice';
    if (v === 'home') { renderCatalog(el.searchInput.value); renderGlobalStats(); renderHistory(); }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function applyCategoryTheme(cat) {
    const root = document.documentElement;
    root.style.setProperty('--cat', cat.color);
    root.style.setProperty('--cat-soft', catSoft(cat.color));
    root.style.setProperty('--cat-deep', catDeep(cat.color));
  }

  function fillCategorySelect() {
    el.selCategory.innerHTML = CATEGORIES.map(
      (c) => `<option value="${c.id}">${c.icon}  ${c.num} · ${esc(c.name)}</option>`
    ).join('');
  }

  function magnitudeNote(cat) {
    if (!(cat.opts || []).some((g) => g.id === 'digits')) return '';
    const v = resolveOpts(cat).digits;
    return v === 'auto'
      ? ' · números: tamaño según nivel'
      : ` · números: ${v} cifra${v === '1' ? '' : 's'} (tamaño fijo)`;
  }

  function renderConfigUI() {
    const cat = CAT_BY_ID[S.catId];
    el.selCategory.value = S.catId;
    $$('.seg-btn', el.levelSeg).forEach((b) => {
      const on = b.dataset.level === S.level;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    el.levelRange.textContent = (cat.range[S.level] || '') + magnitudeNote(cat);
    el.selLength.value = String(S.length);
    el.chkTimer.checked = S.timerVisible;
    el.chkHints.checked = S.hints;
    el.chkAutoNext.checked = S.autoNext;
    renderCatOpts();
    el.panelCatIcon.textContent = cat.icon;
    el.panelCatName.textContent = cat.name;
    el.panelCatTrains.textContent = `Qué entrena: ${cat.trains}`;
    el.topbarCat.textContent = `${cat.icon} ${cat.name}`;
    el.topbarLevel.textContent = LEVELS[S.level];
    el.hbadgeCat.textContent = `${cat.icon} ${cat.name}`;
    el.hbadgeLevel.textContent = `Nivel ${LEVELS[S.level]}`;
    applyCategoryTheme(cat);
    el.timerCard.classList.toggle('is-hidden', !S.timerVisible);
  }

  function renderStats() {
    const total = totalOfSession();
    const answered = S.results.length;
    const infinite = !isFinite(total);
    const shown = infinite ? answered % 10 : Math.min(answered, total);
    const pct = infinite ? (answered % 10) * 10 : (total ? (answered / total) * 100 : 0);

    el.statOk.textContent = S.ok;
    el.statBad.textContent = S.wrong;
    el.progressFill.style.width = pct + '%';
    el.progressBar.setAttribute('aria-valuemax', String(infinite ? 10 : total));
    el.progressBar.setAttribute('aria-valuenow', String(shown));
    el.progressTxt.textContent = infinite ? `${answered} resueltos` : `${answered} / ${total}`;
    el.pillProgress.textContent = infinite ? `nº ${answered + (S.answered ? 0 : 1)}` : `${Math.min(answered + (S.answered ? 0 : 1), total)} / ${total}`;
    el.topbarProgress.textContent = infinite ? `${answered}` : `${answered}/${total}`;

    const dotsN = infinite ? 10 : total;
    if (el.progressDots.childElementCount !== dotsN) {
      el.progressDots.innerHTML = Array.from({ length: dotsN }, () => '<span class="dot"></span>').join('');
    }
    const dots = $$('.dot', el.progressDots);
    const base = infinite ? Math.floor(answered / 10) * 10 : 0;
    dots.forEach((d, i) => {
      const r = S.results[base + i];
      d.className = 'dot' + (r === 'ok' ? ' is-ok' : r === 'bad' ? ' is-bad' : '');
    });

    const acc = answered ? Math.round((S.ok / answered) * 100) : null;
    el.statAcc.textContent = acc === null ? '—' : acc + '%';
    el.statStreak.textContent = S.streak;
    el.statAvg.textContent = answered ? fmtTime(S.elapsed / answered) : '—';

    const st = catStats(S.catId);
    el.catOk.textContent = st.ok;
    el.catBad.textContent = st.wrong;
    const cTotal = st.ok + st.wrong;
    el.catFill.style.width = (cTotal ? (st.ok / cTotal) * 100 : 0) + '%';

    el.stageStreak.hidden = S.streak < 2;
    el.stageStreakTxt.textContent = `${S.streak} seguidas`;
  }

  function renderExercise() {
    const cat = CAT_BY_ID[S.catId];
    let ex = null, guard = 0;
    while (guard++ < 40) {
      try { ex = cat.gen(S.level, resolveOpts(cat)); } catch (err) { ex = null; }
      if (ex && Number.isFinite(ex.kind === 'mcq' ? 0 : ex.answer)) break;
    }
    if (!ex) ex = { q: 'No se pudo generar el ejercicio', kind: 'number', answer: 0, hint: '' };

    S.ex = ex;
    S.answered = false;
    S.selected = null;
    S.qStartedAt = S.started ? performance.now() : 0;

    const qHTML = ex.qHTML || esc(ex.q).replace(/\?/g, '<span class="q-box">?</span>');
    el.question.innerHTML = qHTML;
    el.questionSub.hidden = !ex.sub;
    el.questionSub.textContent = ex.sub || '';
    el.stageKicker.textContent = isFinite(totalOfSession())
      ? `Ejercicio ${Math.min(S.idx + 1, totalOfSession())} de ${totalOfSession()}`
      : `Ejercicio ${S.idx + 1}`;

    const isMcq = ex.kind === 'mcq';
    el.mcq.hidden = !isMcq;
    el.answerInput.parentElement.classList.toggle('is-hidden', isMcq);
    el.answerInput.disabled = isMcq;
    el.answerInput.value = '';
    el.answerInput.className = 'answer-input';
    el.answerInput.placeholder = '?';
    if (isMcq) {
      el.mcq.innerHTML = ex.options.map((o, i) => `
        <button type="button" class="mcq-opt" data-val="${esc(o)}" data-i="${i}">
          <span class="k" aria-hidden="true">${i + 1}</span>${ex.options.length > 2 && /^-?\d/.test(o) ? esc(o) : (String(o).includes('/') ? fracHTML(o) : esc(o))}
        </button>`).join('');
    }
    el.answerUnit.hidden = !ex.unit;
    el.answerUnit.textContent = ex.unit || '';

    el.feedback.hidden = true;
    el.feedback.className = 'feedback';
    el.feedback.innerHTML = '';
    el.hintBox.hidden = true;
    el.hintBox.open = false;
    el.hintText.textContent = ex.hint || '';
    el.btnCheck.hidden = false;
    el.btnCheck.disabled = false;
    el.btnNext.hidden = true;
    el.btnNext.innerHTML = 'Siguiente ejercicio <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
    el.stage.classList.remove('is-ok', 'is-bad');
    el.answerHelp.hidden = isMcq;
    el.answerHelp.innerHTML = isMcq
      ? 'Elige una opción (teclas <kbd>1</kbd>–<kbd>4</kbd>).'
      : 'Acepta coma o punto decimal. Pulsa <kbd>Enter</kbd> para comprobar.';

    renderStats();
    if (!isMcq && !S.paused && window.matchMedia('(min-width: 900px)').matches) {
      setTimeout(() => el.answerInput.focus({ preventScroll: true }), 60);
    }
  }

  /* ======================================================================
     7. MOTOR DE SESIÓN
     ====================================================================== */
  function startSession() {
    clearTimeout(S.nextTimer); S.nextTimer = null;
    stopTicker();
    S.idx = 0; S.ok = 0; S.wrong = 0; S.streak = 0; S.bestStreak = 0;
    S.elapsed = 0; S.started = false; S.running = false; S.paused = false;
    S.sessionStartedAt = performance.now();
    S.results = []; S.answered = false;
    updatePauseUI();
    el.timerValue.textContent = '00:00';
    el.timerNote.textContent = 'Arranca con tu primera respuesta';
    renderConfigUI();
    renderExercise();
    renderStats();
    announce(`${CAT_BY_ID[S.catId].name}, nivel ${LEVELS[S.level]}. Nueva sesión.`);
  }

  function startTicker() {
    if (S.tickId) return;
    S.lastTick = performance.now();
    S.tickId = setInterval(() => {
      if (!S.running || S.paused) { S.lastTick = performance.now(); return; }
      const now = performance.now();
      S.elapsed += now - S.lastTick;
      S.lastTick = now;
      el.timerValue.textContent = fmtTime(S.elapsed);
    }, 250);
  }
  function stopTicker() { if (S.tickId) { clearInterval(S.tickId); S.tickId = null; } }

  function markStarted() {
    if (!S.started) {
      S.started = true;
      S.running = true;
      S.sessionStartedAt = performance.now();
      el.timerNote.textContent = 'En marcha';
      startTicker();
    }
    if (!S.qStartedAt) S.qStartedAt = S.sessionStartedAt || performance.now();
  }

  function checkAnswer() {
    if (S.paused || !S.ex || S.answered) return;
    const ex = S.ex;
    let response;
    if (ex.kind === 'mcq') {
      if (S.selected === null) { toast('Elige una opción antes de comprobar', 'i-target'); return; }
      response = S.selected;
    } else {
      response = el.answerInput.value;
      if (!response.trim()) { el.answerInput.focus(); pulse(el.answerInput); return; }
    }

    markStarted();
    const res = grade(ex, response);
    S.answered = true;
    const qTime = S.qStartedAt ? performance.now() - S.qStartedAt : 0;

    if (res.ok) {
      S.ok++; S.streak++; S.bestStreak = Math.max(S.bestStreak, S.streak);
      S.results.push('ok');
    } else {
      S.wrong++; S.streak = 0;
      S.results.push('bad');
    }
    const st = catStats(S.catId);
    st.ok += res.ok ? 1 : 0;
    st.wrong += res.ok ? 0 : 1;
    st.bestStreak = Math.max(st.bestStreak || 0, S.streak);
    st.lastPlayed = Date.now();
    save();

    const praise = ['¡Correcto!', '¡Bien!', '¡Exacto!', '¡Perfecto!', '¡A por otra!'];
    el.feedback.hidden = false;
    if (res.ok) {
      el.stage.classList.add('is-ok');
      el.feedback.className = 'feedback is-ok';
      el.feedback.innerHTML = `
        <span class="fb-ic"><svg class="icon" aria-hidden="true"><use href="#i-check"/></svg></span>
        <span><strong>${pick(praise)}</strong><small>${ex.kind === 'mcq' ? 'Respuesta correcta.' : `${fmtDec(res.value)} · en ${fmtTime(qTime)}`}${ex.tol ? ' · dentro del margen de estimación' : ''}${S.autoNext ? ' · siguiente en un instante…' : ''}</small></span>`;
      if (ex.kind !== 'mcq') el.answerInput.classList.add('is-ok');
      markMcqStates(ex, response, true);
      bump(el.statOk);
      if (S.streak > 0 && S.streak % 5 === 0) toast(`🔥 Racha de ${S.streak} aciertos seguidos`, 'i-flame');
      announce(`Correcto. ${S.ok} aciertos, ${S.wrong} fallos.`);
    } else {
      el.stage.classList.add('is-bad');
      el.feedback.className = 'feedback is-bad';
      const given = res.invalid
        ? 'no se ha podido interpretar tu respuesta'
        : `has respondido ${ex.kind === 'mcq' ? esc(String(response)) : fmtDec(res.value)}`;
      el.feedback.innerHTML = `
        <span class="fb-ic"><svg class="icon" aria-hidden="true"><use href="#i-x"/></svg></span>
        <span><strong>Respuesta correcta: ${esc(res.expected)}</strong><small>${given}. ${ex.tol ? `Se aceptaba un margen de ±${fmt(ex.tol)}.` : ''}${S.autoNext ? ' Siguiente en unos segundos…' : ''}</small></span>`;
      if (ex.kind !== 'mcq') { el.answerInput.classList.add('is-bad'); el.answerInput.disabled = true; }
      markMcqStates(ex, response, false);
      bump(el.statBad);
      announce(`Incorrecto. La respuesta correcta es ${res.expected}.`);
    }

    if (S.hints && ex.hint) { el.hintBox.hidden = false; }
    el.btnCheck.hidden = true;
    el.btnNext.hidden = false;
    el.btnNext.focus({ preventScroll: true });
    renderStats();

    if (S.results.length >= totalOfSession()) {
      el.btnNext.innerHTML = 'Ver resumen de la sesión <svg class="icon" aria-hidden="true"><use href="#i-arrow-right"/></svg>';
    }

    if (S.autoNext) scheduleNext(res.ok ? 950 : 2600);
  }

  function scheduleNext(ms) {
    clearTimeout(S.nextTimer);
    S.nextTimer = setTimeout(() => {
      S.nextTimer = null;
      if (S.paused || !S.answered || S.summaryOpen || S.view !== 'practice') return;
      nextExercise();
    }, ms);
  }

  function markMcqStates(ex, response, ok) {
    if (ex.kind !== 'mcq') return;
    $$('.mcq-opt', el.mcq).forEach((b) => {
      b.disabled = true;
      if (String(b.dataset.val) === String(ex.correct)) b.classList.add('is-right');
      else if (String(b.dataset.val) === String(response)) b.classList.add('is-wrong');
    });
  }

  function nextExercise() {
    if (!S.answered) return;
    clearTimeout(S.nextTimer); S.nextTimer = null;
    S.idx++;
    const done = S.results.length >= totalOfSession();
    if (done) { finishSession(); return; }
    renderExercise();
    if (!isMcqNow() && window.matchMedia('(min-width: 900px)').matches) el.answerInput.focus({ preventScroll: true });
  }
  const isMcqNow = () => !!(S.ex && S.ex.kind === 'mcq');

  function finishSession() {
    S.running = false;
    stopTicker();
    const total = S.results.length;
    const acc = total ? Math.round((S.ok / total) * 100) : 0;
    const st = catStats(S.catId);
    st.sessions += 1;
    DATA.totalMs += S.elapsed;
    DATA.history.unshift({
      cat: S.catId, level: S.level, ok: S.ok, total, ms: Math.round(S.elapsed),
      when: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    });
    DATA.history = DATA.history.slice(0, 12);
    DATA.prefs.lastCat = S.catId;
    save();
    showSummary(acc, total);
  }

  function showSummary(acc, total) {
    const cat = CAT_BY_ID[S.catId];
    const emoji = acc >= 90 ? '🏆' : acc >= 70 ? '🎯' : acc >= 50 ? '💪' : '📚';
    const msg = acc >= 90 ? 'Dominio total: sube el nivel y vuelve a intentarlo.'
      : acc >= 70 ? 'Muy bien. Repite los fallos en nivel medio para consolidar.'
        : acc >= 50 ? 'Vas por buen camino: lee las pistas y baja un nivel si hace falta.'
          : 'Practica en nivel fácil hasta automatizar el truco: la velocidad llega sola.';
    el.sumEmoji.textContent = emoji;
    el.sumTitle.textContent = acc >= 70 ? '¡Sesión completada!' : 'Sesión completada';
    el.sumSub.textContent = `${cat.icon} ${cat.name} · nivel ${LEVELS[S.level]}`;
    el.sumPct.textContent = acc + '%';
    el.sumRing.style.strokeDashoffset = String(326.7 * (1 - acc / 100));
    el.sumRing.style.stroke = acc >= 70 ? 'var(--ok)' : acc >= 50 ? 'var(--warn)' : 'var(--bad)';
    el.sumStats.innerHTML = `
      <div class="ms"><b style="color:var(--ok)">${S.ok}</b><span>Acertadas</span></div>
      <div class="ms"><b style="color:var(--bad)">${S.wrong}</b><span>Falladas</span></div>
      <div class="ms"><b>${fmtTime(S.elapsed)}</b><span>Tiempo</span></div>
      <div class="ms"><b>${total ? fmtTime(S.elapsed / total) : '—'}</b><span>Media/ej.</span></div>
      <div class="ms"><b>${S.bestStreak}</b><span>Mejor racha</span></div>
      <div class="ms"><b>${catStats(S.catId).ok}</b><span>Aciertos históric.</span></div>`;
    el.sumMsg.textContent = msg;
    el.overlay.hidden = false;
    el.body.classList.add('is-locked');
    S.summaryOpen = true;
    if (acc >= 70) launchConfetti();
    announce(`Sesión terminada con ${acc} por ciento de aciertos.`);
    setTimeout(() => el.sumAgain.focus(), 120);
  }

  function closeSummary() {
    el.overlay.hidden = true;
    el.body.classList.remove('is-locked');
    S.summaryOpen = false;
  }

  function setPaused(p) {
    S.paused = p;
    clearTimeout(S.nextTimer); S.nextTimer = null;
    if (p) {
      S.running = false;
      el.timerNote.textContent = 'En pausa';
      el.timerCard.classList.add('is-paused');
    } else if (S.started) {
      S.running = true;
      S.lastTick = performance.now();
      el.timerNote.textContent = 'En marcha';
      el.timerCard.classList.remove('is-paused');
      startTicker();
    }
    updatePauseUI();
    announce(p ? 'Sesión en pausa' : 'Sesión reanudada');
  }
  function updatePauseUI() {
    el.btnPause.setAttribute('aria-pressed', String(S.paused));
    el.btnPauseLabel.textContent = S.paused ? 'Reanudar' : 'Pausa';
    el.btnPause.querySelector('use').setAttribute('href', S.paused ? '#i-play' : '#i-pause');
    el.pauseVeil.hidden = !S.paused;
    el.answerInput.disabled = S.paused || isMcqNow();
    el.btnCheck.disabled = S.paused;
    el.btnNext.disabled = S.paused;
    $$('.mcq-opt', el.mcq).forEach((b) => { if (!S.answered) b.disabled = S.paused; });
    if (S.paused) el.timerCard.classList.add('is-paused');
    else if (S.running) el.timerCard.classList.remove('is-paused');
  }

  function persistPrefs() {
    DATA.prefs = {
      ...DATA.prefs, level: S.level, length: S.length, timer: S.timerVisible,
      hints: S.hints, lastCat: S.catId, autoNext: S.autoNext, theme: S.theme, palette: S.palette
    };
    save();
  }

  function bump(node) {
    const card = node.closest('.stat');
    if (!card) return;
    card.classList.remove('bump');
    void card.offsetWidth;
    card.classList.add('bump');
  }
  function pulse(node) {
    node.animate?.(
      [{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }],
      { duration: 240, easing: 'ease-in-out' }
    );
  }
  function announce(text) { if (el.srAnnounce) el.srAnnounce.textContent = text; }
  function toast(text, icon = 'i-check') {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#${icon}"/></svg><span>${esc(text)}</span>`;
    el.toasts.appendChild(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 320); }, 2600);
  }

  function launchConfetti() {
    const cv = el.confetti;
    const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.style.display = 'block';
    cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);
    const colors = ['#0d9488', '#4f46e5', '#f59e0b', '#ec4899', '#22c55e', '#06b6d4'];
    const parts = Array.from({ length: 130 }, () => ({
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight * 0.4,
      r: 3 + Math.random() * 5,
      c: colors[(Math.random() * colors.length) | 0],
      vx: -1.4 + Math.random() * 2.8,
      vy: 2 + Math.random() * 3.4,
      rot: Math.random() * Math.PI,
      vr: -0.14 + Math.random() * 0.28
    }));
    let frames = 0;
    (function loop() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.035; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r, p.r, p.r * 1.7);
        ctx.restore();
      });
      frames++;
      if (frames < 190 && parts.some((p) => p.y < window.innerHeight + 30)) requestAnimationFrame(loop);
      else { ctx.clearRect(0, 0, cv.width, cv.height); cv.style.display = 'none'; }
    })();
  }

  function renderCatOpts() {
    const cat = CAT_BY_ID[S.catId];
    const cur = resolveOpts(cat);
    el.catOptsBox.innerHTML = (cat.opts || []).map((g) => {
      const useSelect = g.type === 'select' || g.choices.length > 4;
      const control = useSelect
        ? `<div class="select-wrap"><select data-opt="${g.id}" aria-label="${esc(g.label)}">` +
          g.choices.map((ch) => `<option value="${esc(ch[0])}"${ch[0] === cur[g.id] ? ' selected' : ''}>${esc(ch[1])}</option>`).join('') +
          '</select></div>'
        : `<div class="segmented" role="radiogroup" aria-label="${esc(g.label)}">` +
          g.choices.map((ch) => {
            const on = ch[0] === cur[g.id];
            return `<button type="button" class="seg-btn${on ? ' is-on' : ''}" role="radio" aria-checked="${on}" data-opt="${g.id}" data-val="${esc(ch[0])}">${esc(ch[1])}</button>`;
          }).join('') + '</div>';
      return `<div class="opt-group"><span class="opt-label">${esc(g.label)}</span>${control}` +
        (g.note ? `<p class="opt-note">${esc(g.note)}</p>` : '') + '</div>';
    }).join('');
  }

  function setCatOpt(id, val) {
    const cat = CAT_BY_ID[S.catId];
    const g = (cat.opts || []).find((x) => x.id === id);
    if (!g || !g.choices.some((ch) => ch[0] === val)) return;
    DATA.prefs.catOpts = DATA.prefs.catOpts || {};
    DATA.prefs.catOpts[cat.id] = { ...(DATA.prefs.catOpts[cat.id] || {}), [id]: val };
    persistPrefs();
    renderCatOpts();
    startSession();
    const lbl = g.choices.find((ch) => ch[0] === val);
    toast(`${g.label}: ${lbl ? lbl[1] : val}`, 'i-target');
  }

  /* ---------- Apariencia: tema + paleta ---------- */
  function renderPaletteRow() {
    el.paletteRow.innerHTML = PALETTES.map((p) =>
      `<button type="button" class="swatch" role="radio" data-palette="${p.id}" title="Paleta ${esc(p.label)}" aria-label="Paleta ${esc(p.label)}" style="--sw-a:${p.a};--sw-b:${p.b}"></button>`
    ).join('');
  }

  function applyAppearance() {
    const rootEl = document.documentElement;
    rootEl.dataset.theme = S.theme;
    rootEl.dataset.palette = S.palette;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_META[S.theme] || THEME_META.claro);
    const use = document.getElementById('themeUse');
    if (use) use.setAttribute('href', THEME_ICON[S.theme] || THEME_ICON.claro);
    if (el.btnTheme) el.btnTheme.setAttribute('aria-label', `Tema actual: ${S.theme}. Cambiar tema`);
    $$('.seg-btn', el.themeSeg).forEach((b) => {
      const on = b.dataset.theme === S.theme;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-checked', String(on));
    });
    $$('.swatch', el.paletteRow).forEach((b) => {
      const on = b.dataset.palette === S.palette;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    renderCatalog(el.searchInput.value);
    applyCategoryTheme(CAT_BY_ID[S.catId]);
  }

  function setTheme(t) {
    if (!THEMES.includes(t) || t === S.theme) return;
    S.theme = t;
    persistPrefs();
    applyAppearance();
    announce(`Tema ${t} activado`);
  }
  function setPalette(id) {
    if (!PALETTES.some((p) => p.id === id) || id === S.palette) return;
    S.palette = id;
    persistPrefs();
    applyAppearance();
    const p = PALETTES.find((x) => x.id === id);
    toast(`Paleta ${p.label}`, 'i-palette');
  }

  /* ---------- Drawer de configuración general ---------- */
  let lastFocusedBeforeDrawer = null;

  function openDrawer() {
    if (el.settingsDrawer.classList.contains('is-open')) return;
    lastFocusedBeforeDrawer = document.activeElement;
    el.settingsDrawer.classList.add('is-open');
    el.drawerOverlay.classList.add('is-open');
    el.settingsDrawer.setAttribute('aria-hidden', 'false');
    el.body.classList.add('is-locked');
    setTimeout(() => el.btnCloseSettings.focus({ preventScroll: true }), 80);
  }

  function closeDrawer() {
    if (!el.settingsDrawer.classList.contains('is-open')) return;
    el.settingsDrawer.classList.remove('is-open');
    el.drawerOverlay.classList.remove('is-open');
    el.settingsDrawer.setAttribute('aria-hidden', 'true');
    el.body.classList.remove('is-locked');
    if (lastFocusedBeforeDrawer && lastFocusedBeforeDrawer.focus) {
      lastFocusedBeforeDrawer.focus({ preventScroll: true });
    }
  }

  function toggleDrawer() {
    if (el.settingsDrawer.classList.contains('is-open')) closeDrawer();
    else openDrawer();
  }

  // Focus-trap simple dentro del drawer
  el.settingsDrawer.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const focusable = el.settingsDrawer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ======================================================================
     8. EVENTOS
     ====================================================================== */
  function goPractice(catId, level) {
    if (catId && CAT_BY_ID[catId]) S.catId = catId;
    if (level && LEVELS[level]) S.level = level;
    persistPrefs();
    setView('practice');
    startSession();
  }
  function goHome() {
    if (S.started && S.elapsed > 1000) { DATA.totalMs += S.elapsed; save(); }
    stopTicker();
    S.running = false;
    setView('home');
  }

  el.btnBrand.addEventListener('click', () => (S.view === 'practice' ? goHome() : window.scrollTo({ top: 0, behavior: 'smooth' })));
  el.btnHeaderHome.addEventListener('click', goHome);
  el.btnBack.addEventListener('click', goHome);
  el.btnHeaderPractice.addEventListener('click', () => goPractice(DATA.prefs.lastCat, $$('.seg-btn.is-on', el.homeLevelSeg)[0]?.dataset.level));
  el.btnHeroStart.addEventListener('click', () => goPractice(DATA.prefs.lastCat, $$('.seg-btn.is-on', el.homeLevelSeg)[0]?.dataset.level));
  el.btnHeroRandom.addEventListener('click', () => goPractice(pick(CATEGORIES).id, $$('.seg-btn.is-on', el.homeLevelSeg)[0]?.dataset.level));

  el.catGrid.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-practice]');
    if (!btn) return;
    const level = $$('.seg-btn.is-on', el.homeLevelSeg)[0]?.dataset.level || 'facil';
    goPractice(btn.dataset.practice, level);
  });

  el.homeLevelSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    $$('.seg-btn', el.homeLevelSeg).forEach((x) => x.classList.toggle('is-on', x === b));
  });

  el.searchInput.addEventListener('input', () => renderCatalog(el.searchInput.value));

  el.btnResetStats.addEventListener('click', () => {
    if (!window.confirm('¿Borrar todas las estadísticas guardadas en este navegador? Esta acción no se puede deshacer.')) return;
    const prefs = DATA.prefs;
    DATA = DEFAULT_DATA();
    DATA.prefs = prefs;
    save();
    renderCatalog(el.searchInput.value); renderGlobalStats(); renderHistory();
    toast('Estadísticas borradas', 'i-trash');
  });

  /* -- Drawer (configuración general) -- */
  el.btnSettings.addEventListener('click', toggleDrawer);
  el.btnCloseSettings.addEventListener('click', closeDrawer);
  el.drawerOverlay.addEventListener('click', closeDrawer);

  /* -- Configuración del dashboard -- */
  el.selCategory.addEventListener('change', () => {
    S.catId = el.selCategory.value;
    persistPrefs();
    startSession();
    toast(`${CAT_BY_ID[S.catId].icon} ${CAT_BY_ID[S.catId].name}`, 'i-target');
  });

  el.levelSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b || b.dataset.level === S.level) return;
    S.level = b.dataset.level;
    persistPrefs();
    renderConfigUI();
    startSession();
  });

  el.selLength.addEventListener('change', () => {
    S.length = parseInt(el.selLength.value, 10);
    persistPrefs();
    startSession();
  });

  el.chkTimer.addEventListener('change', () => {
    S.timerVisible = el.chkTimer.checked;
    el.timerCard.classList.toggle('is-hidden', !S.timerVisible);
    persistPrefs();
  });
  el.catOptsBox.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn[data-opt]');
    if (b) setCatOpt(b.dataset.opt, b.dataset.val);
  });
  el.catOptsBox.addEventListener('change', (e) => {
    const sel = e.target.closest('select[data-opt]');
    if (sel) setCatOpt(sel.dataset.opt, sel.value);
  });

  el.chkAutoNext.addEventListener('change', () => {
    S.autoNext = el.chkAutoNext.checked;
    if (!S.autoNext) { clearTimeout(S.nextTimer); S.nextTimer = null; }
    persistPrefs();
    toast(S.autoNext ? 'Avance automático activado' : 'Avance automático desactivado', 'i-bolt');
  });

  el.themeSeg.addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn[data-theme]');
    if (b) setTheme(b.dataset.theme);
  });
  el.paletteRow.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch[data-palette]');
    if (b) setPalette(b.dataset.palette);
  });
  el.btnTheme.addEventListener('click', () => {
    setTheme(THEMES[(THEMES.indexOf(S.theme) + 1) % THEMES.length]);
  });

  el.chkHints.addEventListener('change', () => {
    S.hints = el.chkHints.checked;
    if (!S.hints) el.hintBox.hidden = true;
    else if (S.answered && S.ex && S.ex.hint) el.hintBox.hidden = false;
    persistPrefs();
  });

  el.btnPause.addEventListener('click', () => setPaused(!S.paused));
  el.btnResume.addEventListener('click', () => { setPaused(false); if (!isMcqNow()) el.answerInput.focus(); });
  el.btnResetSession.addEventListener('click', () => { startSession(); toast('Sesión reiniciada', 'i-reset'); });

  /* -- Respuesta -- */
  el.answerForm.addEventListener('submit', (e) => { e.preventDefault(); checkAnswer(); });
  el.btnNext.addEventListener('click', nextExercise);

  el.answerInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (S.answered) nextExercise(); else checkAnswer();
    }
  });
  el.answerInput.addEventListener('input', () => {
    el.answerInput.classList.remove('is-ok', 'is-bad');
  });

  el.mcq.addEventListener('click', (e) => {
    const b = e.target.closest('.mcq-opt');
    if (!b || S.answered || S.paused) return;
    selectOption(b.dataset.val);
  });

  function selectOption(val) {
    S.selected = val;
    $$('.mcq-opt', el.mcq).forEach((b) => b.classList.toggle('is-sel', b.dataset.val === val));
    if (!S.answered) { markStarted(); checkAnswer(); }
  }

  /* -- Modal resumen -- */
  el.sumAgain.addEventListener('click', () => { closeSummary(); startSession(); });
  el.sumHome.addEventListener('click', () => { closeSummary(); goHome(); });
  el.overlay.addEventListener('click', (e) => { if (e.target === el.overlay) { closeSummary(); startSession(); } });

  /* -- Atajos globales de teclado -- */
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');

    if (e.key === 'Escape') {
      if (el.settingsDrawer.classList.contains('is-open')) { closeDrawer(); return; }
      if (S.summaryOpen) { closeSummary(); startSession(); }
      else if (S.view === 'practice') goHome();
      return;
    }
    if (S.view !== 'practice' || S.summaryOpen) return;
    if (el.settingsDrawer.classList.contains('is-open')) return;

    if (e.key === 'Enter' && !typing) {
      if (t && t.closest('summary')) return;
      e.preventDefault();
      if (S.answered) nextExercise(); else if (!isMcqNow()) checkAnswer();
      return;
    }
    if (/^[1-4]$/.test(e.key) && isMcqNow() && !S.answered && !S.paused) {
      const opts = $$('.mcq-opt', el.mcq);
      const b = opts[parseInt(e.key, 10) - 1];
      if (b) { e.preventDefault(); selectOption(b.dataset.val); }
      return;
    }
    if (typing) return;
    const k = e.key.toLowerCase();
    if (k === 'p') { e.preventDefault(); setPaused(!S.paused); }
    else if (k === 'r') { e.preventDefault(); startSession(); toast('Sesión reiniciada', 'i-reset'); }
    else if (k === 'n' && S.answered) { e.preventDefault(); nextExercise(); }
  });

  /* -- Ahorro de recursos cuando la pestaña no está visible -- */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.started && S.running) {
      setPaused(true);
      toast('Sesión pausada automáticamente', 'i-pause');
    }
  });
  window.addEventListener('pagehide', () => {
    if (S.started && S.elapsed > 0) { DATA.totalMs += S.elapsed; save(); }
  });

  /* ======================================================================
     ARRANQUE
     ====================================================================== */
  fillCategorySelect();
  renderPaletteRow();
  $$('.seg-btn', el.homeLevelSeg).forEach((b) => b.classList.toggle('is-on', b.dataset.level === S.level));
  renderCatalog('');
  renderGlobalStats();
  renderHistory();
  renderConfigUI();
  setView('home');
  startSession();
  setView('home');
  applyAppearance();

  /* Exposición mínima para depuración/pruebas (no forma parte de la API pública). */
  window.MenteAgil = {
    CATEGORIES, CAT_BY_ID, CAT_OPTS, normalizeNumber, normalizeCandidates, grade, fmt, fmtTime, expectedText,
    defaultOpts, resolveOpts, setTheme, setPalette, setCatOpt,
    state: S, data: () => DATA, startSession, goPractice,
    openDrawer, closeDrawer
  };
})();