# FerroERP

ERP web modular para ferretería, con acceso por roles, inventario multisucursal y operaciones de venta y compra transaccionales.

## Arquitectura y decisiones

- **Frontend:** React 18, TypeScript, Vite y CSS responsive. El panel consume la API REST y no almacena el negocio en el navegador.
- **Backend:** Node.js, TypeScript y Express. Rutas por módulo, Zod para validar entrada, JWT para sesión, bcrypt para contraseñas, Helmet y limitación de intentos de acceso.
- **Datos:** PostgreSQL y Prisma. `Branch` se relaciona con existencias, caja, documentos y movimientos; las tablas no se duplican por sucursal.
- **Autorización:** relaciones `Role`, `Permission` y `RolePermission`; el middleware vuelve a consultar rol y permisos en cada solicitud. Los usuarios de sucursal quedan limitados a su `branchId`. El camionero solo ve y actualiza entregas propias.
- **Operaciones de stock:** las compras, ventas, ajustes y traslados escriben inventario y bitácora dentro de transacciones. Los documentos financieros se conservan; pagos parciales se guardan como filas independientes.
- **Valores monetarios:** `Decimal` en PostgreSQL para precios, saldos y cantidades fraccionarias. La aplicación usa GTQ como moneda inicial.
- **Decisión de demo:** el seed agrega catálogo, clientes, proveedores y stock inicial por sucursal. No inventa ventas o compras históricas; empieza con movimientos financieros reales vacíos.

## Entidades y relaciones

`Role` ↔ `Permission` mediante `RolePermission`; `User` pertenece a un rol y opcionalmente a una `Branch`; `Driver` complementa a un usuario camionero. `Product` pertenece a `Category` y opcionalmente a `Supplier`; `Inventory` es único por producto y sucursal; `InventoryMovement` registra el historial. `Sale` / `Purchase` tienen sus líneas y pagos asociados; se vinculan a cliente/proveedor, sucursal y usuario. `CashRegister` tiene aperturas, movimientos y cierres. `Delivery` tiene cliente, sucursal, camionero, ruta y líneas. También existen `WoodProduct`, `Transfer`, `Expense`, `AuditLog` y `CompanySettings`.

## Requisitos

- Node.js 20 o superior y pnpm.
- PostgreSQL 14 o superior.

## Iniciar en Windows

La primera ejecución necesita Internet para descargar el paquete oficial de PostgreSQL 18 (aprox. 350 MB). Luego el motor y los datos viven en `%LOCALAPPDATA%\FerroERP`, fuera de OneDrive. La base escucha únicamente en `127.0.0.1:55432`.

1. Haz doble clic en **Iniciar ERP.bat**. Preparará PostgreSQL, creará la base, aplicará migraciones, cargará el catálogo y abrirá el navegador.
2. Accede como `admin` con contraseña inicial `Cambiar123!`.
3. Haz doble clic en **Detener ERP.bat** para cerrar la API y apagar PostgreSQL.

Los registros del motor y de la API quedan en `%LOCALAPPDATA%\FerroERP`. PostgreSQL acepta conexiones de confianza solo desde el equipo local; no expongas el puerto `55432` a la red.

## Desplegar en un servidor

El proyecto incluye `Dockerfile`, `docker-compose.yml` y Caddy para publicar la aplicación con HTTPS automático. El servidor debe tener Docker Engine con el complemento Compose instalado, un dominio apuntando a su IP pública y los puertos TCP 80 y 443 abiertos. No abras PostgreSQL a Internet.

1. Copia el proyecto al servidor y duplica `.env.production.example` como `.env`.
2. Genera contraseñas aleatorias largas para `POSTGRES_PASSWORD`, `JWT_SECRET` y `SEED_PASSWORD`. Usa la misma contraseña de PostgreSQL en `POSTGRES_PASSWORD` y dentro de `DATABASE_URL`; el ejemplo usa hexadecimal para evitar problemas al codificar caracteres reservados.
3. Cambia `ERP_DOMAIN` y `FRONTEND_URL` por el dominio real, por ejemplo `erp.tuempresa.com` y `https://erp.tuempresa.com`. Crea el registro DNS A hacia el servidor y el AAAA solo si IPv6 está configurado.
4. Inicia el servicio desde la carpeta del proyecto:

   ```sh
   docker compose up -d --build
   docker compose logs -f app
   ```

   Al iniciar, el contenedor aplica las migraciones y carga los datos iniciales. El primer acceso es `admin` con la contraseña que asignaste a `SEED_PASSWORD`; se solicitará cambiarla.
5. Visita `https://erp.tuempresa.com`. PostgreSQL, archivos de respaldo, subidas y certificados se guardan en volúmenes Docker persistentes. Conserva una copia segura de `.env` y realiza respaldos externos regulares.

Para una prueba privada sin dominio, configura `ERP_DOMAIN` como `:80`, `FRONTEND_URL` como `http://IP-DEL-SERVIDOR` y publica el puerto HTTP del proxy. No uses HTTP para gestionar datos reales en Internet. Antes de actualizar, respalda la base de datos; luego usa `docker compose up -d --build`.

Docker no está instalado en el equipo de desarrollo, por lo que la compilación del contenedor debe verificarse al ejecutarla en el servidor destino.

## Instalación local

1. Instala paquetes:

   ```powershell
   pnpm install
   pnpm --dir backend install
   pnpm --dir frontend install
   ```

2. Crea una base de datos PostgreSQL, por ejemplo `ferreteria_erp`.
   Alternativamente, inicia PostgreSQL con `docker compose up -d` (Docker requerido).
3. Copia `.env.example` como `backend/.env` y configura `DATABASE_URL` y `JWT_SECRET` (mínimo 32 caracteres aleatorios). Copia `frontend/.env.example` como `frontend/.env` si cambias el URL de la API. Para correr localmente, `backend/.env` es el archivo que carga la API y el seed.
4. Genera Prisma, aplica la migración inicial y carga datos:

   ```powershell
   pnpm --dir backend exec prisma generate
   pnpm --dir backend exec prisma migrate deploy
   pnpm --dir backend db:seed
   ```

5. En la raíz inicia API y frontend:

   ```powershell
   pnpm dev
   ```

   Frontend: http://localhost:5173 · API: http://localhost:4000/api/health

## Usuarios de desarrollo

Todos usan la contraseña inicial `Cambiar123!` y `mustChangePassword` queda marcado:

| Usuario | Rol |
|---|---|
| `admin` | Administrador |
| `tienda1` | Sucursal Tienda 1 |
| `tienda2` | Sucursal Tienda 2 |
| `camionero1` | Camionero 1 |
| `camionero2` | Camionero 2 |

Son credenciales exclusivamente de desarrollo. Cambia contraseñas antes de usar información real; nunca copies el `.env` local al despliegue.

## Scripts

- `pnpm dev`: frontend y API en paralelo.
- `pnpm build`: build de API y frontend.
- `pnpm --dir backend test`: comprobaciones unitarias de cálculos, saldo y disponibilidad de stock.
- `pnpm --dir backend db:seed`: usuarios y catálogo iniciales (idempotente).
- `pnpm db:generate`: cliente de Prisma.
- `pnpm db:migrate`: migración de desarrollo.

## Funcionalidad conectada

Autenticación; dashboard agregado; productos, categorías, clientes, proveedores, sucursales, inventario e historial; compras, ventas y abonos de ventas/compras; apertura y cierre de caja; gastos; traslados y recepción; madera asociada a catálogo; conductores y entregas con flujo móvil de estados; reportes resumidos, búsqueda y auditoría. Las escrituras principales de ventas, compras, pagos, ajustes y traslados usan transacciones PostgreSQL.

## Alcance pendiente

Esta versión aún no cubre facturación SAT, WhatsApp, importación XLSX/CSV con vista previa, exportación PDF/XLSX, conciliación bancaria ni todas las pantallas CRUD del alcance. La exportación CSV del resumen es básica. El respaldo requiere `pg_dump` en el host de la API.

## Seguridad y respaldos

El token tiene vencimiento de 10 horas y una sesión revocable asociada en PostgreSQL; se transporta por `Authorization: Bearer`. En un despliegue público conviene moverlo a cookie `HttpOnly`, `Secure`, `SameSite` y protección CSRF. Todas las contraseñas se almacenan con bcrypt. Las solicitudes pasan validación en backend y el ORM parametriza operaciones.

El administrador puede crear y descargar respaldos desde el módulo **Respaldos**. La API usa `pg_dump -Fc` y guarda archivos en `backups/`; instala las herramientas cliente de PostgreSQL en el host de la API. En producción configura además respaldos automáticos con un usuario PostgreSQL de privilegio mínimo, almacén externo cifrado y pruebas periódicas de restauración con `pg_restore`. Los volcados pueden contener datos sensibles.

## Estructura

```text
backend/
  prisma/       schema, migración SQL y seed
  src/
    lib/        cliente de Prisma
    middleware/ autenticación, autorización y errores
    routes/     API de auth y módulos ERP
    domain/     reglas de negocio y pruebas
frontend/
  src/          app React, estilos, páginas funcionales y componentes
```
