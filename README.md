# Expenses · Dotrino

**Tus ingresos y gastos del mes, en un calendario y en tu almacén.** Anotas a mano o con una
frase («almuerzo 4.50»), programas lo que se repite cada mes y ves en qué se va el dinero.
[`expenses.dotrino.com`](https://expenses.dotrino.com/)

> **Parte del ecosistema [Dotrino](https://dotrino.com).** Dotrino es un ecosistema de
> aplicaciones centradas en la privacidad de los datos: tu información es tuya, y las
> decisiones sobre ella también — qué compartes, con quién, cuándo y por qué. Sin
> anuncios, sin cookies, sin rastreo de datos, sin vender tu identidad a nadie.

**Cómo se usa:** [wiki.dotrino.com/apps/gastos](https://wiki.dotrino.com/apps/gastos/).
Este README es para quien desarrolla. El diseño y las fases están en [`docs/DISENO.md`](./docs/DISENO.md).

## Estado

| Fase | Qué | Estado |
|---|---|---|
| F1 | movimientos, calendario, recurrentes, resumen por categoría, CSV, frase libre por reglas | **hecho** |
| F2 | llave de IA del usuario (`@dotrino/ai`): la frase la entiende su modelo, resumen del mes en palabras | **hecho** |
| F3 | dictado (`@dotrino/dictation`): Whisper en el aparato o el proveedor del usuario, a elegir en Ajustes | **hecho** |
| F4 | correo: pegar a mano, agente IMAP en el PC (`@dotrino/expenses-agent`), Gmail por OAuth | pendiente |
| F5 | recordatorios, wiki, salir de «En desarrollo» | pendiente |

## Cómo funciona

| Qué | Dónde |
|---|---|
| Dinero en centavos, parseo y formato | `src/lib/money.js` |
| Frase → movimiento, sin IA | `src/lib/parse.js` |
| Reglas que se repiten cada mes | `src/lib/recurring.js` |
| Sumas del mes y por categoría | `src/lib/summary.js` |
| Qué se guarda y con qué forma | `src/lib/repo.js` (`@dotrino/store`, un hilo por mes) |
| La IA del usuario: llave sellada, frase → movimiento, el mes en palabras | `src/lib/ai.js` (`@dotrino/ai`), comprobación en `src/lib/ai-check.js` |

Pilares: `@dotrino/ai`, `@dotrino/identity`, `@dotrino/store`, `@dotrino/topbar`, `@dotrino/theme`,
`@dotrino/nav`, `@dotrino/install`, `@dotrino/reputation`, `@dotrino/prerender`.

## Desarrollo

```sh
npm install
npm run dev        # https://localhost:3150 (HTTPS autofirmado: los iframes del ecosistema lo piden)
npm test           # pruebas de las funciones puras
npm run test:e2e   # navegador real; la IA va contra un proveedor simulado
npm run build      # → dist/
```

## Deploy

GitHub Actions construye `dist/` y lo publica en Pages bajo **`https://expenses.dotrino.com/`**
(`.github/workflows/deploy.yml`).

## Licencia

MIT — © Dotrino
