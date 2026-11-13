# Prueba interna — instalador de MC Software

Guía para instalar y probar MC Software en unas pocas computadoras de la oficina.
Es una **prueba**, no una instalación definitiva: ver "Límites conocidos" al final.

## Cómo funciona

Un solo programa de escritorio (Electron) con dos modos, que se elige en el primer arranque:

- **Servidor:** guarda la base de datos y corre la API (usa el propio runtime de Electron; no
  necesita Node instalado). Abre la aplicación en una ventana y deja un ícono en la bandeja.
- **Cliente:** solo una ventana que carga la interfaz que sirve el servidor
  (`http://<servidor>:3001`). No guarda datos.

También se puede usar el navegador de cualquier PC de la red en `http://<servidor>:3001`.

## 1. Compilar el instalador

Requisitos en la PC de desarrollo: Node 22, pnpm 10, `pnpm install`, y acceso a internet la
primera vez (Electron y el módulo nativo de SQLite para Electron se descargan una vez).

```powershell
.\scripts\publish-update.ps1 -Version 0.1.0 -SkipUpload
```

Hace todo: empaqueta la API con esbuild (`apps/api/dist`), exporta la web (`apps/web/out`),
compila la app de escritorio y genera el instalador con electron-builder.
Resultado en `apps\tray\release\`:

| Archivo | Uso |
|---|---|
| `MC-Software-Setup-<versión>.exe` | Instalador (unos 83 MB) |
| `MC-Software-Setup-<versión>.exe.blockmap` | Descarga diferencial en las actualizaciones |
| `latest.yml` | Manifiesto del feed (solo si hay URL de actualizaciones configurada) |
| `win-unpacked\` | Versión sin instalar, para pruebas |

Sin `-SkipUpload` y sin URL configurada el script se niega a continuar. Equivalente manual:
`pnpm build:release` (usa la versión de `apps/tray/package.json`).

## 2. Instalar en la PC servidor

1. Copiar `MC-Software-Setup-<versión>.exe` a la PC y ejecutarlo. Instala **solo para el usuario
   actual, sin permisos de administrador**, crea accesos en el escritorio y el menú Inicio y abre el programa.
2. **SmartScreen** mostrará "Windows protegió su PC" porque el instalador no está firmado:
   "Más información" → "Ejecutar de todas formas".
3. Primer arranque: elegir **Esta computadora es el servidor** y "Guardar y continuar".
4. **Cortafuegos:** la primera vez que el servidor escucha, Windows pregunta si permite el acceso a
   la red. Marcar **Redes privadas** y "Permitir acceso". Sin esto otras PC no se conectan.
   (El instalador no puede crear la regla porque no corre como administrador.)
5. Se abre la ventana de la aplicación; crear el primer usuario administrador y la empresa.

El servidor arranca solo al iniciar sesión en Windows. Cerrar la ventana **no** detiene el servidor:
sigue en la bandeja (junto al reloj; se avisa una vez). Menú de la bandeja (clic derecho):
Abrir, estado y puerto, versión, Buscar actualizaciones, Reiniciar servidor, Cambiar modo / servidor, Salir.
**Salir** detiene el servidor.

Averigüe la dirección del servidor para las otras PC (nombre del equipo o IP; en PowerShell:
`hostname` e `ipconfig`). Conviene una IP fija o una reserva en el router.

## 3. Conectar otras PC

- **Cliente instalado:** instalar el mismo `.exe`, elegir **Conectarse a un servidor**, escribir el
  nombre o IP y el puerto (3001) y usar **Probar conexión**. Si el servidor no responde, el programa
  muestra "No se puede conectar con el servidor" con **Reintentar** y **Cambiar servidor**.
- **Navegador:** abrir `http://<servidor>:3001`. No requiere instalar nada.

Para cambiar de modo o de servidor después: menú Archivo → "Cambiar modo / servidor…" (o el mismo
elemento en la bandeja). El programa se reinicia.

## 4. Dónde quedan los datos

En el servidor, **fuera de la carpeta de instalación**:

| Qué | Dónde |
|---|---|
| Base de datos cifrada | `%APPDATA%\MC Software\data\accounting.db` (+ `-wal`, `-shm`) |
| Configuración (modo, servidor) | `%APPDATA%\MC Software\mc-config.json` |
| Registros | `%APPDATA%\MC Software\logs\main.log` y `server.log` |
| Programa | `%LOCALAPPDATA%\Programs\MC Software\` |

Actualizar o desinstalar reemplaza solo la carpeta del programa; **no toca `%APPDATA%\MC Software`**
(el desinstalador está configurado para no borrar datos). La llave de cifrado está en el
Administrador de credenciales de Windows del usuario (servicio `accounting-platform`).

## 5. Importar datos del sistema anterior (CONTAC)

Detalle del importador: `docs/legacy/contac/import.md`. La importación escribe en la base cifrada del
servidor, así que:

1. **Cerrar el programa por completo** (bandeja → Salir). La base solo la abre un proceso a la vez.
2. Hacer una copia de `%APPDATA%\MC Software\data` antes de importar.
3. Desde una copia del repositorio **en esa misma PC y con el mismo usuario de Windows** (la llave está
   atada al usuario):

```powershell
$env:ACCOUNTING_DATA_DIR = "$env:APPDATA\MC Software\data"
pnpm --filter @accounting/api legacy:import -- --source MCERP/CONTAC --parity --report informe.json
```

Sin `--db`, el importador usa la base cifrada de la plataforma (ver advertencia del documento del
importador: revisar primero el informe sobre una copia). Después abrir el programa de nuevo.

## 6. Actualizaciones

Las PC revisan un feed estático por HTTP: al iniciar (cuando el servidor ya está arriba) y cada 4 horas.
Cuando hay una versión nueva se descarga sola y se pregunta "Reiniciar ahora / Más tarde"; con "Más tarde" se
instala al cerrar el programa. La bandeja muestra el estado ("Sin novedades", "Descargando…", "lista para
instalar") y, cuando está lista, el elemento "Reiniciar para actualizar". Antes de instalar se detiene
el servidor de forma ordenada. Nunca se reinicia sin preguntar.

### Configurar la dirección del feed (en la PC de desarrollo)

La URL **no está en el código**: se incrusta al compilar. Una de estas opciones:

- Variable de entorno `MC_UPDATE_URL=http://updates.ejemplo.com/mc-software/`
- Parámetro `-FeedUrl` de `publish-update.ps1`
- Archivo `apps\tray\update.config.json` (no se sube a git; copiar `update.config.example.json`)

Sin URL el programa funciona con las actualizaciones desactivadas y el menú lo indica.

### Servidor de actualizaciones (una sola vez, en el VPS)

Igual que el otro producto: una carpeta servida por un contenedor nginx. Ejemplo (ajustar el
nombre de host y la red; `<host-del-feed>` es un marcador):

```bash
mkdir -p /var/www/updates/mcsoftware
docker run -d \
  --name mcsoftware-updates \
  --restart unless-stopped \
  --network dokploy-network \
  -v /var/www/updates/mcsoftware:/usr/share/nginx/html:ro \
  --label traefik.enable=true \
  --label 'traefik.http.routers.mcsoftware-updates-web.entrypoints=web' \
  --label 'traefik.http.routers.mcsoftware-updates-web.rule=Host(`<host-del-feed>`)' \
  --label 'traefik.http.routers.mcsoftware-updates-web.service=mcsoftware-updates-web' \
  --label 'traefik.http.services.mcsoftware-updates-web.loadbalancer.server.port=80' \
  nginx:alpine
```

Sin Traefik: `-p 8080:80` en lugar de las etiquetas. La URL del feed sería `http://<host-del-feed>/`.
El feed va por HTTP simple en esta prueba (ver límites).

### Publicar una versión

```powershell
.\scripts\publish-update.ps1 -Version 0.1.1 -Remote "mi-vps:/var/www/updates/mcsoftware"
```

Pone la versión, compila todo, genera el instalador y sube con `scp` el instalador y su `.blockmap`, y
**al final** `latest.yml` (así ningún equipo ve un manifiesto que apunte a un archivo que aún no llegó).
Los instaladores anteriores se dejan en el VPS. La versión debe ser mayor que la instalada.

### Clientes y versiones

Los clientes instalados se actualizan solos desde el mismo feed (mismo instalador). La interfaz la sirve
el servidor, así que el servidor manda: si el cascarón de un cliente es más viejo que el servidor, al
conectar muestra un aviso con la versión de cada uno y busca actualizaciones. Lo que podría fallar con un
cascarón viejo es solo lo propio de la ventana (menús, cambio de servidor, impresión futura); la pantalla
y las funciones contables son las del servidor. Un navegador no tiene este problema. Conviene actualizar
primero el servidor y dejar que los clientes lo sigan.

## 7. Desinstalar

Configuración de Windows → Aplicaciones → MC Software → Desinstalar (no pide administrador). **No borra
los datos**: para eliminarlos por completo, borrar `%APPDATA%\MC Software` y la credencial
`accounting-platform` en el Administrador de credenciales (sin la llave, la base queda ilegible).

## 8. Variables para pruebas automáticas

| Variable | Efecto |
|---|---|
| `MC_MODE` (`server`/`client`) | Fuerza el modo, sin ventana de primer arranque |
| `MC_PORT` / `MC_HOST` | Puerto / servidor |
| `MC_DATA_DIR` | Carpeta de la base de datos |
| `MC_USER_DATA` | Carpeta de configuración y registros (perfil de Electron) |
| `MC_NO_STARTUP=1` | No registra el inicio con Windows |
| `ACCOUNTING_KEYCHAIN_SERVICE` / `_ACCOUNT` | Nombre de la credencial de la llave (usar otro nombre en pruebas) |
| `MC_TEST_QUIT_AFTER_MS` | Cierra el programa normalmente tras N ms |

## Límites conocidos de esta prueba

- **No es un servicio de Windows:** el servidor corre solo mientras el usuario tiene la sesión abierta y
  el programa en marcha. Si la PC se reinicia y nadie inicia sesión, nadie puede conectarse.
- **La llave de cifrado está atada al usuario de Windows** (Administrador de credenciales). Reinstalar Windows,
  cambiar de usuario o perder el perfil deja la base ilegible. **No hay llave de recuperación todavía.**
- **Sin respaldo automático.** Copiar `%APPDATA%\MC Software\data` a mano (con el programa cerrado) y
  la copia solo se abre con la llave de este usuario de Windows (ver punto anterior).
- **Instalador sin firma de código:** SmartScreen advierte en cada instalación nueva.
- **Feed de actualizaciones por HTTP simple:** el instalador descargado se verifica con SHA-512 del
  manifiesto, pero el manifiesto no va firmado ni cifrado; usar HTTPS y firma de código antes de producción.
- El cortafuegos de Windows se configura a mano la primera vez (ver arriba).
- Compilación sin asar (la API necesita cargar módulos nativos): instalación de unos 300 MB y muchos archivos.
