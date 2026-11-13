# Arquitectura de despliegue

Decidido el 2026-11-10. Reemplaza el diseño anterior "solo bandeja + navegador".

## Resumen

Un solo instalador de Electron con dos modos. La oficina tiene una computadora servidor
y varias computadoras cliente en la misma red local. No se necesita internet.

| | Modo servidor | Modo cliente |
|---|---|---|
| Dónde | La computadora servidor (una por oficina) | Laptops y escritorios |
| Qué corre | API Hono + BD SQLite/SQLCipher como **servicio de Windows** | Una ventana de Electron |
| Datos locales | La BD cifrada y los respaldos | Ninguno (solo el nombre del servidor) |
| UI | Ícono de bandeja: estado, usuarios, último respaldo | Carga `http://<servidor>:3001` |

## Reglas

1. **Un solo escritor.** Solo el proceso de la API abre la BD. El archivo SQLite nunca se
   pone en una carpeta compartida. Los clientes solo hablan HTTP con el servidor.
2. **El cliente es un cascarón delgado.** No incluye la UI: carga la que sirve el servidor.
   Así la UI y la API siempre son de la misma versión y solo se actualiza el servidor.
3. **El servicio no depende de una sesión.** La API arranca con Windows aunque nadie haya
   iniciado sesión. La bandeja solo muestra estado y controla el servicio; no es su dueña.
4. **Descubrimiento por nombre.** En el primer arranque el cliente pide el nombre del
   servidor (ej. `SERVIDOR`) y lo guarda. Difusión UDP es un extra opcional. No se usa mDNS.
5. **El navegador sigue funcionando** como alternativa (`http://<servidor>:3001`).
6. **Sin modo fuera de línea.** Si el servidor no responde, el cliente muestra
   "No se puede conectar con el servidor" y reintenta.
7. **La ventana cliente captura el teclado** (F-teclas, Ctrl+N, Ctrl+P…) para la barra
   Agregar / Buscar / Modificar / Grabar / Cancelar / Imprimir, y controla la impresión.

## Pendientes para llegar a este diseño

Estado del código al 2026-11-10. Ninguno bloquea el trabajo de CONTAC.

| # | Pendiente | Dónde | Fase |
|---|---|---|---|
| 1 | ~~La URL de la API en la web apunta a `localhost:3001`~~ **Hecho:** en producción la UI llama al origen de la propia página (`apps/web/src/lib/api-base.ts`) | `apps/web` | Hecho |
| 2 | La API es hija de la bandeja y arranca al iniciar sesión; debe ser servicio de Windows. **Sigue igual en la prueba interna** (se reinicia sola si cae, pero solo corre con la sesión abierta) | `apps/tray/src/server-manager.ts` | Bandeja |
| 3 | Carpeta de datos por usuario (`%APPDATA%\MC Software\data`); debe ser `ProgramData`. **Sigue igual en la prueba interna**; no se toca al actualizar ni al desinstalar | `apps/tray/src/config.ts` | Bandeja |
| 4 | ~~El empaquetado ejecuta `node` del sistema~~ **Hecho:** la API es un solo archivo (esbuild) que corre con el runtime de Electron (`ELECTRON_RUN_AS_NODE`); los módulos nativos se empaquetan para Electron 33 | `apps/api/build`, `apps/tray` | Hecho |
| 5 | ~~Modo cliente: ventana, primer arranque, "sin conexión"~~ **Hecho** (también ventana en modo servidor, bandeja en español) | `apps/tray` | Hecho |
| 6 | ~~Selección de modo en el instalador~~ **Cambió:** el instalador es único y de un clic; el modo se elige en el primer arranque y se cambia desde el menú | `apps/tray` | Hecho (distinto) |
| 7 | Regla de firewall para el puerto en modo servidor. **Pendiente:** el instalador es por usuario (sin administrador), así que Windows pregunta la primera vez que el servidor escucha; se acepta en la prueba | NSIS | Instalador |
| 7b | ~~Actualizaciones automáticas~~ **Hecho:** `electron-updater` con feed estático genérico (`scripts/publish-update.ps1`). **Pendiente:** firma de código y feed por HTTPS | `apps/tray`, `scripts` | Hecho (sin firma) |
| 8 | Respaldo diario automático de la BD (copia cifrada) | `apps/api` | Después de CONTAC |

## Decisión abierta: la llave de cifrado bajo un servicio

Hoy la llave vive en el Administrador de credenciales de Windows (keytar), que es **por
usuario**. Un servicio que corre como LocalSystem no puede leerla.

- **Propuesta:** el servicio corre con una cuenta local dedicada y sin privilegios, y la
  llave queda en el almacén de esa cuenta. Se mantiene la regla "la llave nunca en `.env`".
- **Alternativa:** DPAPI con alcance de máquina. Más simple, pero cualquier proceso de la
  máquina puede descifrarla.
- **En ambos casos falta una llave de recuperación.** Si se reinstala Windows o muere el
  disco, la llave se pierde y los respaldos no se pueden abrir. La configuración inicial
  debe mostrar una llave de recuperación para que el cliente (o nosotros) la guarde.

## Transporte

HTTP sin TLS dentro de la red local. Aceptable para la primera versión; las cookies de
sesión viajan en claro dentro de la oficina. Revisar si algún cliente usa Wi-Fi abierto
o compartido.
