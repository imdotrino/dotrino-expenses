# dotrino-expenses — tus ingresos y gastos del mes, en tu almacén

> Pedido por el dueño el 2026-10-18. Decisiones tomadas ese día: **el correo entra por las
> tres vías** (agente en el PC, Gmail por OAuth desde el navegador, y pegar el correo a
> mano), **el dictado tiene dos motores y el usuario elige** (Whisper local en el aparato, o
> la llave de IA del usuario), y **`@dotrino/ai` nace con tres familias de proveedores**
> (OpenAI-compatible, Anthropic, Gemini).

## 1. Qué es

Una app para llevar **lo que entra y lo que sale cada mes**: se anota un movimiento, se ve
en un **calendario**, y el mes se resume por categoría. Lo anotado vive en el almacén del
usuario (`@dotrino/store`), separado por perfil y respaldado en su bóveda si la tiene.

Lo que la distingue de una hoja de cálculo son tres entradas que ahorran teclear:

| Entrada | Qué hace | Dónde corre |
|---|---|---|
| **Texto libre** | «almuerzo 4.50», «cobré 1200 del sueldo» → un movimiento | en el aparato, por reglas; con la llave de IA del usuario, por el modelo que él eligió |
| **Dictado** | hablar en vez de escribir → texto → lo de arriba | Whisper **en el aparato**, o el proveedor de IA del usuario |
| **Correo** | las notificaciones del banco → movimientos **por confirmar** | un agente en el PC del usuario, Gmail por OAuth, o el correo pegado a mano |

**Nada de esto es requisito.** Sin llave de IA, sin micrófono y sin correo la app hace todo
lo demás: anotar, ver, resumir, exportar.

## 2. Las reglas que no se negocian

1. **Sin llave de IA la app funciona entera.** La IA afina (entiende texto libre, categoriza,
   resume en lenguaje llano); no sostiene nada. El parser por reglas (`src/lib/parse.js`) es
   el camino sin IA y existe primero.
2. **Lo que sale del aparato lo decide el usuario, y lo ve.** Mandar texto a un proveedor de
   IA, mandar la voz, o leer un buzón: cada uno se enciende en Ajustes, dice a quién va lo que
   va, y se apaga desde el mismo sitio. Nada se enciende solo.
3. **La llave de IA y las credenciales van selladas con la llave de la cuenta**
   (`identity.sealContent`), nunca en claro ni selladas al aparato. Las credenciales IMAP no
   entran a la PWA: viven en un cajón de la bóveda y las lee el agente.
4. **Nunca la Web Speech API del navegador.** Chrome manda el audio a Google y Safari a Apple
   sin que la app pueda decir que no. Dictar es Whisper en el aparato o el proveedor que el
   usuario eligió a propósito.
5. **Lo que llega del correo no entra solo.** Cae en una bandeja «Por confirmar»; el usuario
   acepta, corrige o descarta. Un parser que se equivoca no toca el registro.
6. **El dinero son enteros** (centavos). Nunca `float`. Se formatea al pintar.
7. **Ningún agente es requisito** («el aparato cumple el rol», `CLAUDE.md`). Con el PC
   apagado la app anda igual: solo deja de llegar correo nuevo.
8. **Las reglas del ecosistema, sin excepción**: `<dotrino-topbar>` con `profile` y `theme`,
   `@dotrino/theme`, `@dotrino/store` con identidad, prerender, bilingüe es/en con tuteo,
   lenguaje llano, código y logs en inglés, `data-testid` en lo que se toca.

## 3. Datos

Todo en `@dotrino/store`, `Store.connect({ identity, maxPerThread: 50000 })`. Hilos:

```
expenses.movements.aaaa-mm   un movimiento por entrada, un hilo POR MES; id = uuid
expenses.settings            { id: 'recurring:<uuid>', … }  una regla de movimiento recurrente
                             { id: 'category:<key>', … }    una categoría propia del usuario
                             { id: 'prefs', currency, … }   preferencias
                             { id: 'ai', envelope }          la llave de IA, SELLADA (F2)
                             { id: 'mail', … }               ajustes de correo, sin credenciales (F4)
expenses.inbox               lo que llega del correo y espera confirmación (F4)
```

Un movimiento:

```js
{
  id: 'uuid',
  date: '2026-10-18',          // día local del aparato: es un diario personal, no un comprobante
  amount: 450,                 // centavos, siempre positivo
  type: 'expense' | 'income',
  category: 'food',            // clave de una categoría fija o propia
  note: 'almuerzo',
  source: 'manual' | 'text' | 'voice' | 'mail' | 'recurring',
  recurringId: 'uuid',         // si lo generó una regla
  pending: true,               // generado o llegado, aún sin confirmar
  ts: 1760812345678,
}
```

Un hilo por mes porque el almacén recorta cada hilo a un tope descartando lo más viejo sin
avisar, y un año de gastos diarios de una familia pasa de mil entradas sin esfuerzo.

**Recurrentes.** Una regla dice `{ name, amount, type, category, day, startMonth, endMonth? }`.
Al abrir un mes que ya empezó, cada regla activa sin movimiento en ese mes genera uno con
`pending: true` y `source: 'recurring'`. Confirmar quita el `pending`; descartar lo borra, y
no se vuelve a generar porque la regla deja constancia (`skipped: ['aaaa-mm']`).

## 4. Fases

| Fase | Qué | Pieza nueva |
|---|---|---|
| **F0** | esqueleto con todas las convenciones, repo, Pages, catálogo `wip` | — |
| **F1** | movimientos, calendario, recurrentes, resumen por categoría, CSV, parser por reglas | — |
| **F2** | llave de IA en Ajustes; texto libre → movimiento; categorizar; resumen llano | **`@dotrino/ai`** |
| **F3** | botón de micrófono; Whisper local o proveedor | **`@dotrino/dictation`** |
| **F4** | correo: pegar a mano → agente IMAP → Gmail OAuth; bandeja por confirmar | **`@dotrino/expenses-agent`** |
| **F5** | recordatorios de recurrentes (`@dotrino/notifications`), wiki, quitar `wip` | — |

### F2 — `@dotrino/ai`

Pilar isomórfico sin dependencias: **la llave es del usuario y la llamada sale de donde él
está** (su navegador, su PC). Adaptadores:

- `openai-compatible`: OpenAI, DeepSeek, Groq, Ollama local (`baseUrl` + `model`). Un
  adaptador cubre los cuatro. Es lo que ya usan `dotrino-bots` y `dotrino-social-bot` por su
  cuenta (`brain.js`, `llm.js`): se migran a este paquete y desaparecen las dos copias.
- `anthropic`: desde el navegador exige la cabecera `anthropic-dangerous-direct-browser-access`.
- `gemini`.

API: `ask`, `askJson` (pide JSON y lo valida), `transcribe` (audio → texto, donde el
proveedor lo dé). Errores con `code`: `no-llm-key`, `llm-http`, `llm-empty`, `llm-json`,
`llm-cors` (el proveedor no deja llamar desde el navegador: se dice, no se tapa).

### F3 — `@dotrino/dictation`

`<dotrino-dictation>`: un botón de micrófono que devuelve texto (`dotrino-dictation-text`).
Motor **local**: Whisper por `@huggingface/transformers` (WebGPU o WASM), modelo multilingüe
pequeño que se descarga una vez (~40–75 MB) con aviso y se cachea; todo en el aparato. Motor
**proveedor**: `transcribe` de `@dotrino/ai` con la llave del usuario. El componente no decide:
le dicen cuál (`engine="local|provider"`), y la app lo saca de Ajustes.

**Hecho así** (2026-10-21):

- Modelo `onnx-community/whisper-base` en 8 bits (encoder 23 MB + decoder 54 MB), en un
  **worker** y por WASM de un solo hilo (Pages no deja poner las cabeceras de aislamiento).
  Una frase de 4 s se transcribe en ~3 s en un portátil. `whisper-tiny` entiende mal el
  español y `whisper-small` pesa ~250 MB.
- El runtime de ONNX (`.wasm`, 14 MB) lo sirve la app desde sus assets: la librería lo bajaría
  de jsDelivr. La caché del modelo y del runtime es la Cache API del navegador, así que el
  dictado local funciona sin conexión una vez bajado.
- `prefs.dictation`: `off` (por defecto) · `local` · `provider`. «Con tu IA» se ve siempre y
  sale deshabilitada con el motivo si no hay IA o el proveedor no transcribe.
- Lo dictado cae en el cuadro de frases y sigue el mismo camino que lo escrito (IA o reglas),
  así que se revisa siempre. El parser entiende el importe hablado («4 dólares con 50»).
- Whisper base no acierta cada palabra (en la prueba oye «al muerto» por «almuerzo»); el
  importe sí. Por eso el usuario revisa.

### F4 — correo

Orden de llegada, de lo más simple a lo más cómodo:

1. **Pegar a mano**: un cuadro donde cae el texto del correo → parser → bandeja.
2. **Agente en el PC** (`npx @dotrino/expenses-agent`): se enrola con `@dotrino/remote-agent`
   (`label: 'expenses-agent'`), credenciales IMAP en un cajón `secrets:expenses` de la bóveda,
   lee la carpeta o etiqueta que el usuario diga, saca movimientos de las notificaciones
   bancarias (parsers por banco de Ecuador: Pichincha, Produbanco, Guayaquil, Pacífico, Diners;
   y uno genérico con `@dotrino/ai` **en el agente**, con la llave del usuario) y los manda
   **sellados** por la sesión E2E a la PWA. Cumple el estándar de agentes: `info`, `--name`,
   `@dotrino/update`, `@dotrino/compat`, `release.yml` con `roadmap check`.
3. ~~**Gmail por OAuth desde el navegador**~~ — **DESCARTADO por ahora** (dueño, 2026-10-22).
   Leer Gmail pide el permiso `gmail.readonly`, que Google clasifica como restringido: una app
   pública necesita verificación y una auditoría de seguridad de pago; sin eso, 100 usuarios de
   prueba y una pantalla de advertencia. Gmail ya entra por el agente con una contraseña de
   aplicación. Se retoma si hace falta leer el correo sin PC. Lo que decía el plan:
   **Gmail por OAuth desde el navegador**: solo Gmail, hace falta un cliente OAuth de Google
   (lo crea el dueño en Google Cloud); la PWA lee el buzón con el token en memoria. Se dice en
   pantalla que la app habla con Google directo.

**Hecho (2026-10-22): pegar a mano.** Pestaña «Por confirmar»: se pega el aviso (texto o HTML),
lo lee la IA del usuario si la hay o el **lector genérico** (`src/lib/mail.js`: el importe de la
operación y no el saldo, entró o salió, comercio, fecha, banco), y queda en `expenses.inbox` con
id `mail:<huella SHA-256 del texto>`. Aceptar, Revisar (el formulario) o Descartar; lo aceptado o
descartado se queda con su `status`, así que el mismo correo no vuelve a entrar. No hay
parsers por banco todavía: los avisos de prueba están escritos a mano, y uno real que no se lea
bien entra como caso de prueba.

**Hecho (2026-10-22): el agente del PC** (`@dotrino/expenses-agent`, repo
`dotrino-expenses-agent`). Más simple que el plan: el agente **no lee ni guarda nada por su
cuenta**. La PWA, al abrir «Por confirmar», busca los agentes encendidos (`probeAgents`, `kind:
'expenses-agent'`), abre sesión y pide `pull` con el cursor (`{ uidValidity, uid }`) que guarda en
`expenses.settings` como `mail-cursor:<agente>`; el agente lee por IMAP lo nuevo y lo devuelve. El
correo pasa por el mismo lector que el pegado (`src/lib/inbox.js`) y la huella es el Message-ID.
Las credenciales las sube el agente a su cajón (`setup` → `storeVars`) y las pide en cada lectura.
Probado de punta a punta en `dotrino-test` (`npm run smoke:expenses-mail`: bóveda, agente,
GreenMail y la PWA en Chromium).

Los parsers de banco son **puros y con prueba** (`test/mail/*.test.js` con correos de ejemplo
anonimizados): un correo real que no entra es un caso de prueba nuevo, no un parche.

## 5. Lo que queda fuera (de momento)

- Versiones nativas: solo cuando el dueño la califique (CONVENCIONES §16).
- Varias monedas en un mismo mes y cuentas bancarias separadas: una moneda por perfil
  (`prefs.currency`), sin cuentas. Se añade cuando alguien lo necesite.
- Presupuestos por categoría y metas de ahorro.
