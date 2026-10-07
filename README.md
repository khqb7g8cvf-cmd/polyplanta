# Polyamsa · Control de planta

Reporte de turno contra producción teórica, operadores y amonestaciones, paros, mantenimiento, inventario de resina, análisis y órdenes (opcionales).
Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS, Realtime) + Vercel.

## Puesta en marcha

### 1. Supabase
1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor** → pega y ejecuta, en este orden:
   1. `supabase/migrations/20261007000000_init.sql` (tablas, permisos por rol, inventario)
   2. `supabase/seed.sql` (23 máquinas, parámetros por defecto, materiales iniciales)
3. **Project Settings → API**: copia `Project URL` y `anon public key`.
4. Aplica también `supabase/migrations/20261007120000_usuarios_bitacora_kardex.sql` (usuarios, bitácora, kardex).
5. Abre la app: la primera vez pide crear el **dueño** (usuario + contraseña, sin correo). Después, en la pestaña *Usuarios* creas las cuentas del equipo, les cambias la contraseña o las desactivas.

### 2. Vercel
1. *Add New → Project* → importa este repo de GitHub.
2. Variables de entorno (Production y Preview):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. Cada `git push` a `main` vuelve a desplegar.

### Desarrollo local
```bash
cp .env.example .env.local   # llena con tus llaves
npm install
npm run dev
npm test                      # cálculo de turnos, escalera de amonestaciones, inventario
npm run typecheck
```

## Roles
| Rol | Puede |
|---|---|
| Dueño | Todo: catálogo, parámetros, órdenes, materiales, amonestaciones, usuarios |
| Encargado | Capturar reportes, paros, entradas/salidas y conteos de inventario, personas, mantenimiento |
| Mecánico | Órdenes de trabajo de mantenimiento |
| Solo lectura | Ver (no ve amonestaciones) |

Los permisos se aplican en la base de datos (RLS), no solo en la interfaz.

## Inventario de resina
- Captura **manual**: entrada (sacos o kg, proveedor, lote, factura, costo/kg) y salida de bodega a producción (extrusora destino opcional).
- **Conteo físico** crea un ajuste por la diferencia contra el sistema.
- Cobertura en días = existencia ÷ consumo diario de los últimos 30 días; alerta bajo mínimo.
- Conciliación: kg que salieron de bodega vs kg extruidos en los reportes de turno.

## Fórmulas
- kg/millar = ancho(m) × largo(m) × (calibre / 2) × densidad (0.92 baja, 0.95 alta)
- Bolseo kg/h = golpes × 60 × carriles / 1000 × kg/millar
- Esperado por turno = kg/h × (horas productivas − paros justificados). Cumplimiento = reportado / esperado.


## Novedades
- **Login por usuario y contraseña** (internamente `usuario@usuarios.polyamsa.mx`; no se manda ningún correo).
- **Bitácora** (solo dueño): cada alta, cambio y borrado queda firmado con usuario y hora del servidor, es inmutable y marca alertas (kilos editados, borrados, ajustes de inventario, fechas atrasadas, cambios de meta).
- **Departamentos**: cumplimiento, disponibilidad, rendimiento, mapa de calor, ranking, turnos, pareto de paros, CSV.
- **Inventario**: kardex con saldo corrido, motivo/destino de cada salida, consumo, proveedores y precios.
