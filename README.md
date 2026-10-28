# Sistema de domicilios | Asadero Ventilador

App web (React + Vite + Firebase) para pedidos, mesas, domicilios, inventario, punto de venta (POS) y cierre de caja.

## Roles

| Puede… | Administrador | Cajero |
|---|:-:|:-:|
| Vender en el POS e imprimir la factura | ✅ | ✅ |
| Agregar gastos del día | ✅ | ✅ |
| Ver existencias de inventario | ✅ | ✅ |
| Pedidos, mesas, cocina, domicilios | ✅ | ✅ |
| Crear/editar productos, precios y existencias | ✅ | ❌ |
| Fijar la base de caja | ✅ | ❌ |
| Anular facturas POS (devuelve el inventario) | ✅ | ❌ |
| Eliminar gastos | ✅ | ❌ |
| Cerrar / reabrir caja, ver cierres de otros días | ✅ | ❌ |
| Datos de la factura (NIT, dirección…) | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |

Los permisos no dependen solo de la pantalla: `firestore.rules` los hace cumplir en el servidor, así que un cajero no puede saltárselos aunque use la consola del navegador. Las facturas nunca se borran (solo se anulan) y el consecutivo `VTA-00001` no se puede saltar.

## Puesta en marcha (una sola vez)

1. **Activar el inicio de sesión:** Firebase Console → Authentication → Sign-in method → habilitar **Correo electrónico/contraseña**.
2. **Iniciar sesión en Firebase** con la cuenta dueña del proyecto:
   ```bash
   npm install -g firebase-tools   # si no lo tienes
   firebase login
   ```
3. **Publicar las reglas y la app juntas** (si solo subes las reglas, la versión vieja de la app deja de funcionar):
   ```bash
   npm run build
   firebase deploy --only firestore:rules,hosting
   ```
4. **Crear el administrador:** al abrir la app por primera vez aparece "Crear administrador". Esa pantalla desaparece en cuanto existe uno.
5. **Crear los cajeros:** Usuarios → Nuevo usuario. Inician sesión con su *usuario* (no con correo).
6. **Cargar el menú:** Inventario → pestaña Inventario → "Cargar menú del asadero". Luego **Entrada de pollos** para los pollos enteros y el botón de entrada (📦+) de cada bebida.

## Inventario de pollos

El pollo se maneja como **un solo inventario de pollos enteros**. Cada presentación descuenta su parte:

| Producto | Gasta |
|---|---|
| 1/4 de Pollo | ¼ de pollo |
| 1/2 Pollo | ½ pollo |
| 1 Pollo Entero | 1 pollo |
| Promo Pollo y Medio | 1 ½ pollos |

Si entran 40 pollos y se venden 2 cuartos y un medio, quedan 39. El POS calcula cuántas unidades de cada presentación alcanzan con lo que queda. Para un producto nuevo de pollo, en **Editar → Descuenta de** elige "Inventario de pollos" y cuánto gasta. Las bebidas y demás productos tienen sus propias existencias.

Si ya tenías productos de pollo con existencias propias, en la pestaña Inventario aparece **Activar inventario compartido de pollos**, que conecta P001–P004 automáticamente.

> ⚠️ Desde que se publiquen las reglas, **todo el sistema pide inicio de sesión** (también Cocina, Domicilios y Escanear). Crea un usuario cajero para cada equipo que se use en el local.

## Datos en Firestore

| Colección | Qué guarda |
|---|---|
| `usuarios/{uid}` | nombre, usuario, rol (`admin`/`cajero`), activo |
| `productos/{código}` | nombre, categoría, precio, existencias o de qué inventario compartido descuenta y cuánto |
| `insumos/POLLO` | pollos enteros disponibles, guardados en cuartos (40 pollos = 160) |
| `ventas_pos/VTA-00001` | factura POS: ítems, total, método de pago, cajero, estado |
| `cajas/{AAAA-MM-DD}` | base, estado (abierta/cerrada), resumen guardado al cerrar |
| `gastos` | gastos del día con responsable |
| `movimientos_inventario` | historial de entradas y ajustes de existencias |
| `config/ventas`, `config/negocio`, `config/setup` | consecutivo, datos de la factura, primer admin |

La caja de cada día se identifica por la fecha de Colombia (America/Bogota). Por ahora **solo las ventas del POS** descuentan inventario y entran al cierre de caja; pedidos de domicilio y mesas siguen como antes.

## Desarrollo

```bash
npm install
npm run dev                 # contra la base de datos real
```

Para probar sin tocar los datos reales, con los emuladores de Firebase:

```bash
firebase emulators:start --only auth,firestore   # en una terminal
npm run dev:emuladores                           # en otra
npm run test:rules                               # pruebas de las reglas de seguridad
```
