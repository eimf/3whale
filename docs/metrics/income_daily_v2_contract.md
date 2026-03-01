# Contrato canónico: daily series v2 (`/internal/income/daily-v2`)

Este documento es la fuente de verdad para el contrato de series diarias/horarias del endpoint `GET /internal/income/daily-v2`.

## 1) Timezone y rango

- **Fuente de timezone:** `shop_config.timezoneIana`.
- **Interpretación de `from`/`to`:** representan **fechas locales** (`YYYY-MM-DD`) en la zona de la tienda.
- **Conversión backend:** el backend convierte ese rango local a límites UTC para filtrar DB.
    - Implementación actual: `parseLocalDateRangeToUtc(from, to, tz)`.
    - `startUtc = from@00:00:00` local convertido a UTC.
    - `endUtc = to@23:59:59.999` local convertido a UTC.

## 2) Período de comparación

- `compare=1` devuelve un período de comparación de **igual longitud**, **inmediatamente anterior**, en la **misma timezone de tienda**.
- Implementación actual: `getPreviousPeriodLocalRange(from, to, tz)` y luego conversión local→UTC con `parseLocalDateRangeToUtc`.

## 3) Selección de granularidad

- Regla efectiva en backend:
    - Si el rango es `<= 2` días locales: granularidad por defecto = `hour`.
    - Si el rango es `> 2` días locales: granularidad por defecto = `day`.
- Query param `granularity=hour|day` puede forzar explícitamente una granularidad.
- Query param `includeExcluded=true|1` incluye también órdenes marcadas como `excluded` en la agregación.
    - Default (`false`): solo `excluded=false`.

## 3.1) Semántica de métricas (`orderRevenue`)

- En `daily-v2`, el campo `orderRevenue` se alinea al comportamiento observado en Shopify para “Order Revenue”.
- Implementación actual: `orderRevenue` usa la misma base que `incomeNeto` (neto, después de refunds), por bucket.
- Implicación práctica: para un bucket dado, `orderRevenue` puede diferir de “subtotal sin shipping” y puede incluir shipping neteado por refunds según los componentes persistidos.

## 3.2) Semántica de métricas (`refunds` / Returns)

- En `daily-v2` y `summary-v2`, `refunds` se agrega por **momento del evento de refund** (`refund.createdAt`) en timezone local de tienda.
- Monto de refund por evento:
    - Base: `refund.totalRefundedSet.shopMoney.amount`.
    - Fallback: si base = `0`, usar suma de `refund.refundLineItems[].subtotalSet.shopMoney.amount`.
- Esto alinea mejor el KPI de Returns con lo observado en Shopify Analytics cuando `totalRefundedSet` llega en cero pero existen líneas de devolución.

## 4) Contrato de bucket (hour)

> Terminología: **bucketKey** = identificador temporal del bucket.
>
> En el payload actual, ese valor se entrega en `data[].date`.

- **Nombre canónico del campo:** `bucketKey` (serializado hoy en `data[].date`).
- **Formato:** `YYYY-MM-DDTHH:00:00` (local naive, sin offset ni sufijo de zona).
- **Semántica:** inicio de bucket en hora local de la tienda.
- **Orden:** `data[]` se devuelve en orden ascendente por bucket.
- **Continuidad:** para un solo día local, la respuesta contiene exactamente 24 buckets
  (`T00:00:00` … `T23:00:00`). Si faltan horas en datos fuente, se incluyen con valores cero.

### Regla para consumidores

Los clientes **NO deben** parsear `bucketKey` como UTC ni depender de la timezone del navegador.
Debe tratarse como timestamp **local de tienda** (naive).

## 5) Contrato de bucket (day)

- **Formato:** `YYYY-MM-DD` (sin hora, sin `Z`, sin offset).
- **Zona semántica:** bucket diario por día local de tienda (shop-local).
- **Orden:** ascendente por bucket (`data[]` ascendente por fecha).
- **Continuidad / zero-fill:** la serie diaria es **continua e inclusiva** para el rango solicitado;
  todos los días locales en `[from, to]` aparecen, y días sin órdenes regresan valores cero.

## 6) Ejemplo concreto

- **Timezone:** `America/Mexico_City`
- **Día local:** `2026-02-28`
- **Rango solicitado:** `from=2026-02-28&to=2026-02-28`

### Límites UTC efectivos de filtro (por conversión local→UTC)

- Inicio local `2026-02-28T00:00:00` → `2026-02-28T06:00:00.000Z`
- Fin local `2026-02-28T23:59:59.999` → `2026-03-01T05:59:59.999Z`

Por eso los límites UTC difieren del día calendario UTC. Aun así, `bucketKey` permanece local:

- Primer bucket horario: `2026-02-28T00:00:00`
- Último bucket horario: `2026-02-28T23:00:00`

Sin `Z`, sin `+/-HH:mm`, y sin reinterpretación por timezone del navegador.

### Ejemplo day continuo con ceros

- **Timezone:** `America/Mexico_City`
- **Rango local:** `from=2026-02-25&to=2026-02-28`
- **Bucket keys retornados (4):**
    - `2026-02-25`
    - `2026-02-26`
    - `2026-02-27`
    - `2026-02-28`

Aunque uno o más días no tengan órdenes, esos días se incluyen con métricas en cero.
