# 🧠 Mente Ágil · Gimnasio de cálculo mental

Pagina para practicar cálculo mental: 15 categorías de ejercicios,
3 niveles de dificultad, cronómetro, rachas, pistas de estrategia y estadísticas
persistentes. Sin frameworks, sin bundler, sin backend y sin una sola petición de red:
HTML5 + CSS3 + JavaScript vanilla (ES6+).

> Funciona **abriendo el link con doble clic** servida desde GitHub
> Pages sin configuración extra.
---

## 🚀 Cómo usarla

| Entorno | Pasos |
|---|---|
| Local | Abre `index.html` en cualquier navegador moderno. |
| Cualquier hosting estático | Copia los archivos tal cual. |

### Teclado

| Tecla | Acción |
|---|---|
| `Enter` | Comprueba la respuesta; pulsado de nuevo, salta al siguiente sin esperar al avance automático |
| `1` – `4` | Elige opción en ejercicios de opción múltiple |
| `P` | Pausa / reanuda |
| `R` | Reinicia la sesión |
| `Esc` | Vuelve al catálogo |

---

## 🗂️ Estructura

```
/
├── index.html   · Markup semántico, sprite SVG de iconos y las dos vistas
├── styles.css   · Sistema de diseño (tokens), mobile-first, sin dependencias
├── app.js       · Catálogo de generadores, motor de sesión y persistencia
├── README.md    · Este documento

```

---

## 🧩 Las 15 categorías

Cada categoría tiene una **función generadora propia** (`genChain`, `genComplement`,
`genDoubleHalf`, `genMul5`, `genMul11`, `genSquare`, `genDecomp`, `genPercent`,
`genRule3`, `genFraction`, `genDivisibility`, `genEstimate`, `genPower`,
`genConvert`, `genSequence`) que produce un ejercicio aleatorio adaptado al nivel
(Fácil / Medio / Difícil) con su respuesta, tolerancia, opciones (si procede) y una
**pista** que explica el truco mental (p. ej. «×25 es un cuarto de ×100»).

| # | Categoría | Qué entrena | Ejemplo |
|---|---|---|---|
| 01 | Sumas y restas encadenadas | Memoria operativa | 47 + 28 − 19 |
| 02 | Complementos a 10, 100 o 1000 | Rapidez | ¿Cuánto le falta a 73 para 100? |
| 03 | Dobles y mitades sucesivas | Fluidez | Doble de 48; mitad de 136 |
| 04 | Multiplicar por 5, 25, 50 | Atajos | 36 × 5; 24 × 25 |
| 05 | Multiplicar por 11 | Patrones | 34 × 11 |
| 06 | Cuadrados cercanos a una base | (a ± b)² | 19²; 21²; 48² |
| 07 | Descomposición para multiplicar | Distributiva | 17 × 6 = 10×6 + 7×6 |
| 08 | Porcentajes mentales | Proporciones | 15 % de 80; 25 % de 240 |
| 09 | Regla de tres simple mental | Proporcionalidad | Si 4 lápices cuestan 6 €, ¿9? |
| 10 | Fracciones equivalentes y comparación | Sentido numérico | ¿Qué es mayor: 3/5 o 5/8? |
| 11 | Divisibilidad rápida | Criterios | ¿Es 738 divisible por 3? |
| 12 | Estimación con redondeo | Aproximación | 198 + 304 ≈ ? |
| 13 | Potencias y raíces aproximadas | Potencias | 2⁷; √50 ≈ ? |
| 14 | Conversiones de unidades | Decimales | 2,5 km a m; 45 min a horas |
| 15 | Secuencias y patrones | Lógica | 2, 6, 12, 20, ¿? |

Los rangos concretos de cada nivel se muestran en el panel de configuración
(p. ej. *Difícil: productos y encadenados de 4 cifras (±8–15 %)*).

### Ajustes finos por categoría

Además del nivel, **cada categoría expone sus propias opciones** en el panel de
configuración (segmentadas o desplegables, según cuántas haya). Se guardan por
categoría en `localStorage` y regeneran el ejercicio al instante:

| Categoría | Opciones |
|---|---|
| 01 Sumas y restas encadenadas | Operaciones: mixtas / solo sumas / solo restas · Cifras: auto / 1 / 2 / 3 |
| 02 Complementos | Complemento a: auto / 10 / 100 / 1000 / 1 (decimales) |
| 03 Dobles y mitades | Qué practicar: mixto / dobles / mitades · Cifras: auto / 1 / 2 / 3 |
| 04 Multiplicar por 5, 25, 50 | Factor: auto / ×5 / ×25 / ×50 · Cifras: auto / 1 / 2 / 3 |
| 05 Multiplicar por 11 | Cifras: auto / 1 / 2 / 3 |
| 06 Cuadrados cercanos a una base | Rango de la base: auto / 11–30 / 31–60 / 61–125 |
| 07 Descomposición | Forma: auto / 2 cifras×1 / 3 cifras×1 / 2 cifras×2 |
| 08 Porcentajes | Tipo: auto / amables / raros / encadenados |
| 09 Regla de tres | Precios: auto / enteros / con céntimos |
| 10 Fracciones | Tarea: auto / comparar / simplificar |
| 11 Divisibilidad | Criterios: auto / 2·3·5·10 / 3 y 9 / 4 y 25 / 6·12·15 / 7·8·11 |
| 12 Estimación | Operación: auto / sumas y restas / productos / encadenados |
| 13 Potencias y raíces | Tarea: auto / potencias / raíces exactas / raíces aproximadas |
| 14 Conversiones | Magnitud: auto / longitud / masa / tiempo / superficie y volumen / euros |
| 15 Secuencias | Familia: auto / aritméticas / geométricas / especiales |

Con «Solo restas» el minuendo siempre supera la suma de los sustraendos (resultado
nunca negativo), y con cifras fijas todos los términos respetan ese número de cifras.

---

## 🧮 Corrección de respuestas

- Se aceptan **coma o punto decimal**, espacios y separadores de millares:
  `12,5`, `12.5`, `1 234`, `1.234,5`…
- Ambigüedad hispana resuelta: `3,901` se acepta como **3 901** y como **3,901**,
  de modo que teclear exactamente lo que muestra la app nunca cuenta como fallo.
- Entradas no numéricas se marcan como «no interpretable» y cuentan como error,
  mostrando siempre la respuesta correcta.
- Tolerancias deliberadas (documentadas en cada tarjeta):
  * **Estimación**: ±8–15 % según nivel (se corrige contra el valor exacto).
  * **Raíces aproximadas**: ±1 entero.
  * **Regla de tres difícil**: ±2 % (redondeo mental de céntimos).
  * **Porcentajes difíciles**: ±0,5 cuando el resultado tiene decimales.

---

## ⏭️ Avance automático

Por defecto, al comprobar una respuesta **el siguiente ejercicio llega solo**:
~0,95 s si aciertas y ~2,6 s si fallas (tiempo para leer la solución y la pista).
Puede desactivarse con el interruptor «Avance automático» del panel
**Apariencia**; con él apagado se vuelve al flujo manual (`Enter` o botón).
`Enter` o «Siguiente» siempre permiten adelantar la espera, y la pausa la cancela.

## 🎨 Temas y paletas

Todo el aspecto visual vive en el panel **Apariencia** —la **configuración
general** de la app, con un **engranaje** como distintivo—: en el catálogo es el
*sidebar* que acompaña a las categorías (lado a lado desde 1024 px) y en el
dashboard ocupa la columna derecha, separado a propósito del entrenamiento:

- **Temas** — tres opciones: `claro`, `oscuro` y `lectura` (papel cálido con
  tipografía serif, sin brillos ni degradados de fondo, pensado para sesiones
  largas). **El tema por defecto es `claro`** (decisión de diseño: es el que
  define la identidad visual original de la app); el botón de la cabecera los
  cicla (☀ → ☾ → ) y el panel los ofrece segmentados bajo la etiqueta «Temas».
- **Paleta de color** — dieciocho paletas: Turquesa (por defecto), Índigo,
  Bosque, Ámbar, Fucsia, Océano, Violeta, Cian, Lima, Rubí, Coral, Grafito,
  Azul, Magenta, Menta, Petróleo, Rojo y Noche. Se eligen con los puntos de
  color (rejilla de 6 × 3) y tiñen botones, enlaces, focos, cronómetro,
  progresos y degradados.
- **Cronómetro visible**, **Avance automático** y **Pistas de estrategia**:
  interruptores de comodidad con el mismo efecto que sus teclas rápidas.
- **Atajos de teclado** siempre consultables al pie del panel.
- Toda la combinación tema × paleta × categoría se resuelve con tokens CSS y
  `color-mix()`, incluida la adaptación de los acentos de categoría al fondo
  oscuro (con alternativa automática para navegadores sin soporte).
- Tema y paleta se guardan en `localStorage` y se restauran al abrir la app.

## 💾 Persistencia (`localStorage`)

Clave única `menteagil.v1` con:

```jsonc
{
  "cats": { "mul11": { "ok": 12, "wrong": 3, "sessions": 2, "bestStreak": 7, "lastPlayed": 1730000000000 } },
  "totalMs": 483000,          // tiempo total practicado
  "history": [ { "cat": "mul11", "level": "medio", "ok": 9, "total": 10, "ms": 96000, "when": "29 oct" } ],
  "prefs": { "level": "facil", "length": 10, "timer": true, "hints": true, "lastCat": "chain",
             "autoNext": true, "theme": "claro", "palette": "turquesa",
             "catOpts": { "chain": { "op": "mixtas", "digits": "auto" } } }
}
```

- El catálogo muestra aciertos/fallos/precisión **por categoría** y el resumen global.
- Si `localStorage` no está disponible (navegadores muy restrictivos), la app degrada
  a un almacenamiento en memoria sin romperse.
- «Borrar datos» resetea todo previa confirmación.

---

## ♿ Accesibilidad y rendimiento

- `aria-live` en el feedback y en un anunciador oculto para lectores de pantalla.
- Contraste AA en textos secundarios; foco visible (`:focus-visible`) en todo control.
- `role="progressbar"`, `radiogroup` para el nivel, etiquetas y `sr-only` donde procede.
- `prefers-reduced-motion` desactiva animaciones; `forced-colors` respeta bordes.
- Cero peticiones de red: tipografía del sistema, iconos SVG inline y emojis nativos;
  el peso total ronda los 85 KB sin comprimir.

---

---

Hecho con HTML, CSS y JavaScript vanilla. Sin dependencias, sin build, sin excusas. 🌿
