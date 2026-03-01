# Contrato: Income v1

**Versión:** 1.0  
**Alcance:** Shopify → income con precisión financiera (México primero).  
**Fuente de verdad:** Shopify Admin API GraphQL.

## Serie diaria v2 (canónico)

El contrato canónico de la API de series (`/internal/income/daily-v2`) vive en:

`docs/metrics/income_daily_v2_contract.md`

---

## 1. Glosario

| Término                 | Definición                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| **income_bruto**        | Ingreso antes de refunds: después de descuentos, incluye envío, excluye impuestos.                         |
| **income_neto**         | income_bruto − refunds. Métrica principal v1.                                                              |
| **refunds**             | Suma de reembolsos aplicados a la orden (en moneda de la tienda).                                          |
| **shipping_amount**     | Monto cobrado por envío (incluido en income).                                                              |
| **tax_amount**          | Impuestos cobrados; reportables por separado, **excluidos** del income.                                    |
| **discount_amount**     | Descuentos aplicados (códigos, automáticos, etc.); ya descontados del subtotal en la definición de income. |
| **line_items_subtotal** | Subtotal de ítems de línea (antes de descuentos de línea; los descuentos se aplican según lógica Shopify). |
| **currency_code**       | Moneda de la tienda (shop currency); único para todos los agregados v1.                                    |
| **shop_timezone**       | Zona horaria IANA de la tienda (ej. `America/Mexico_City`); usada para bucketing diario.                   |

**Nota:** “Categorías” en este contrato = componentes del total (shipping, tax, discount, refunds, subtotal, etc.), no categorías de producto.

---

## 2. Fórmulas exactas

- **income_bruto** (por orden, en moneda tienda):
    - `income_bruto = (subtotal_after_discounts + shipping_amount) − tax_amount`
    - Equivalente: tomar total cobrado, restar impuestos. Subtotal ya va “después de descuentos”; envío incluido; impuestos excluidos.

- **refunds** (por orden):
    - `refunds = suma de montos de refunds aplicados a la orden` (en moneda tienda).

- **income_neto** (por orden):
    - `income_neto = income_bruto − refunds`

- **Agregado diario** (por día en `shop_timezone`):
    - `income_bruto_día = Σ income_bruto` de órdenes con `processedAt` en ese día.
    - `refunds_día = Σ refunds` de refunds atribuidos a ese día (ver §7).
    - `income_neto_día = income_bruto_día − refunds_día`

**Qué entra y qué no:**

- Entra: ventas cobradas (después de descuentos), envío.
- No entra en income: impuestos (solo reportables), refunds (métrica separada que reduce income_neto).
- Órdenes excluidas: canceladas, test, 100% reembolsadas (ver §5).

---

## 3. Fuente de datos Shopify GraphQL

**Source of truth:** Shopify Admin API GraphQL (Orders, Refunds).

### Campos a usar (preferir MoneySet / shopMoney cuando existan)

| Componente                     | Origen preferido                                                                                 | Fallback / notas                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Subtotal después de descuentos | `Order.subtotalPriceSet.shopMoney`                                                               | Si falta: calcular desde `Order.lineItems` + `Order.discountApplications`; nunca floats.   |
| Envío                          | `Order.shippingLine.priceSet.shopMoney` o total envío en `Order.totalShippingPriceSet.shopMoney` | Si hay múltiples líneas de envío, sumar con NUMERIC.                                       |
| Impuestos                      | `Order.totalTaxSet.shopMoney`                                                                    | Si falta: sumar `Order.taxLines` en moneda tienda.                                         |
| Descuentos (para reporte)      | `Order.totalDiscountsSet.shopMoney`                                                              | Solo informativo; el subtotal ya refleja descuentos.                                       |
| Total cobrado (referencia)     | `Order.totalPriceSet.shopMoney`                                                                  | Para validación: total ≈ subtotal + shipping − discounts + tax (según estructura Shopify). |
| Moneda tienda                  | `Order.currencyCode` o `Shop.currencyCode`                                                       | Debe coincidir en toda la orden.                                                           |
| Fecha “pagado”                 | `Order.processedAt`                                                                              | **Único** para bucketing diario (P3).                                                      |
| Refunds                        | `Order.refunds` → `Refund.totalRefundedSet.shopMoney`; por línea si se necesita detalle          | Si falta `totalRefundedSet`: sumar `refundLineItems` + envío reembolsado en moneda tienda. |
| Orden cancelada                | `Order.canceledAt` (presente = excluir)                                                          | —                                                                                          |
| Orden test                     | `Order.test` === true → excluir                                                                  | —                                                                                          |

**Regla general:** Si un campo `*Set.shopMoney` falta, usar el equivalente en moneda tienda (ej. `presentmentMoney` solo para display; no mezclar monedas en agregados). Documentar fallback usado en auditoría.

**Payload crudo:** Guardar el payload completo de Order (y Refunds) en JSONB por orden/refund. Permite auditoría, reprocesado y reconciliación sin depender solo de campos derivados.

---

## 4. Bucketing diario

- **Día del evento:** Definido por `processedAt` de la orden convertido a la zona horaria IANA de la tienda.
- **Cálculo:** `día = luxon.DateTime.fromISO(processedAt, { zone: 'utc' }).setZone(shop_timezone).toISODate()` (solo fecha `YYYY-MM-DD`).
- **shop_timezone:** Obtener de `Shop.timezone.abbreviation` + offset o preferiblemente de configuración/API que exponga IANA (ej. `America/Mexico_City`). Guardar en tabla `shop` o equivalente para no recalcular.
- **currencyCode:** De `Shop.currencyCode` o de la orden; guardar en `shop` para consistencia. Nunca mezclar monedas en un mismo agregado diario.

---

## 5. Reglas de inclusión/exclusión

| Condición                                                    | Inclusión en income                                      |
| ------------------------------------------------------------ | -------------------------------------------------------- |
| Orden cancelada (`Order.canceledAt` presente)                | **No** incluir.                                          |
| Orden test (`Order.test === true`)                           | **No** incluir.                                          |
| Orden 100% reembolsada (refunds ≥ total cobrado de la orden) | **Excluir** la orden del income (no aporta income_neto). |
| Resto de órdenes con `processedAt` presente                  | Incluir; bucketing por `processedAt` según §4.           |

---

## 6. Redondeo y precisión

- **Almacenamiento:** NUMERIC (por ej. `NUMERIC(20,6)`). Nunca floats; ningún cálculo de dinero en cliente.
- **Display:** 2 decimales en MXN (y en general en moneda tienda). Regla de redondeo: **half-up** (redondeo aritmético 0.5 → 1).
- Los montos que vienen de GraphQL ya en string/decimal se persisten como NUMERIC; las sumas y restas se hacen en SQL/backend con NUMERIC.

---

## 7. Reembolsos

- **Métrica separada (P2):** Se almacenan y reportan `income_bruto`, `refunds` e `income_neto = income_bruto − refunds`.
- **Día del refund:** Usar el timestamp del refund cuando exista (ej. `Refund.createdAt` o campo equivalente en GraphQL) convertido a `shop_timezone`; mismo criterio de día que §4. Si no hay timestamp de refund, política v1: atribuir al mismo día que `Order.processedAt` (documentar en código).
- **Series temporales:** Para un día dado, `refunds_día` suma todos los refunds cuyo “día de refund” es ese día; `income_neto_día = income_bruto_día − refunds_día`. Así income_bruto y refunds son series separadas y reconciliables.

---

## 8. Reconciliación con Shopify

- **Referencia:** Reconciliar contra el reporte **“Total sales” / “Ventas totales”** (o equivalente oficial) de **Shopify Admin → Analytics / Informes**, que muestra ventas por día en moneda de la tienda. Documentar el nombre exacto del reporte en la UI (ej. “Ventas por día” o “Sales by day”) y, si existe, el endpoint/API de Analytics que lo respalda.
- **Pasos para cuadrar:**
    1. Exportar o leer el reporte de Shopify para el rango de fechas y tienda.
    2. Comparar `income_neto_día` (y si aplica `income_bruto_día` y `refunds_día`) con los totales del reporte por día.
    3. Tolerancia esperada: **0** (objetivo); diferencias por redondeo deben ser nulas con NUMERIC(20,6) y half-up a 2 decimales solo en display.
- **Causas típicas de diferencias:** (1) Órdenes test o canceladas incluidas en uno y no en otro; (2) criterio de fecha distinto (processedAt vs paid_at vs created_at); (3) órdenes 100% reembolsadas tratadas distinto; (4) retraso de datos en Analytics. El documento de implementación debe referenciar este contrato y el nombre del reporte usado.

---

## 9. Ejemplos numéricos (MXN)

_Precisión: almacenamiento NUMERIC; display 2 decimales, half-up._

### Ejemplo 1: Orden normal sin descuento ni refund

- line_items_subtotal: 1000.00
- discount_amount: 0.00
- shipping_amount: 80.00
- tax_amount: 169.60

**Cálculo:**

- income_bruto = (1000 − 0) + 80 − 0 = 1080.00 (impuestos no entran).
- refunds = 0.00
- **income_neto = 1080.00 MXN**

---

### Ejemplo 2: Orden con descuento + envío + impuestos (impuestos excluidos del income)

- line_items_subtotal (antes descuento): 2000.00
- discount_amount: 200.00
- subtotal_after_discounts: 1800.00
- shipping_amount: 120.00
- tax_amount: 364.80

**Cálculo:**

- income_bruto = 1800 + 120 = 1920.00 (impuestos excluidos).
- refunds = 0.00
- **income_neto = 1920.00 MXN**
- tax_amount 364.80 solo reportable por separado.

---

### Ejemplo 3: Orden con refund parcial (income_bruto, refunds, income_neto; días)

- Día 1 (processedAt): income_bruto = 1500.00 (subtotal 1400 + envío 100; impuestos excluidos).
- Día 5 (refund createdAt): refund = 300.00.

**Métricas:**

- income_bruto = 1500.00 (día 1).
- refunds = 300.00 (día 5).
- income_neto de la orden = 1500 − 300 = 1200.00.
- En series diarias: día 1 → income_bruto_día +1500, refunds_día 0; día 5 → income_bruto_día 0, refunds_día +300.
- **income_neto_día 1 = 1500.00; income_neto_día 5 = −300.00** (o se muestra refunds como serie positiva y income_neto = income_bruto − refunds por día).

---

## 10. Limitaciones v1 / v2

**v1 (este contrato):**

- Una sola moneda: moneda de la tienda; sin FX propio; sin multi-currency/presentment en agregados.
- Bucketing solo por `processedAt`; no por fecha de pago de gateway ni por clearing.
- Refunds con fecha por `Refund.createdAt` (o fallback a processedAt de la orden).
- No incluye: chargebacks, ajustes contables manuales, otros canales fuera de Shopify Orders/Refunds.

**v2 (futuro):**

- Multi-moneda avanzada / presentment currency.
- Chargebacks y disputas.
- Ajustes contables y conciliación bancaria.
- Posible bucket por fecha de pago/clearing además de processedAt.

---

## Resumen técnico

- **Stack:** Node.js + TypeScript; dinero siempre DECIMAL/NUMERIC; validación zod; timezones Luxon; Postgres; payload crudo Shopify en JSONB para auditoría y reprocesado.
- **Implementación:** Cálculos de dinero solo en backend con NUMERIC; display a 2 decimales (half-up). Reconciliación contra el reporte de Shopify Admin Analytics indicado en §8.
