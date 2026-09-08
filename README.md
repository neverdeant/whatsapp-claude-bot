# 🤖 WhatsApp Claude Bot

Bot de WhatsApp que responde automáticamente a los mensajes recibidos usando la
API de Claude (Anthropic), con personalidad configurable y memoria de
conversación por chat. Corre en **Termux (Android)**, se vincula a WhatsApp
por **código de 8 dígitos** (sin escanear QR), y el código vive en GitHub.

Usa [Baileys](https://github.com/WhiskeySockets/Baileys), que se conecta al
protocolo de WhatsApp Web sin necesitar un navegador — por eso funciona bien
en un teléfono.

---

## Paso 0 — Requisitos previos

- Tener **Termux** instalado (desde F-Droid, no Play Store — la versión de
  Play Store está descontinuada). Si no lo tienes:
  https://f-droid.org/packages/com.termux/
- Tener una **cuenta de GitHub** (gratis, en https://github.com).
- Tener una **cuenta de Anthropic** con clave de API, en
  https://console.anthropic.com/settings/keys (necesitas cargar algo de
  saldo/crédito para que la API funcione).
- Un número de WhatsApp que uses solo para el bot (puede ser tu número
  normal, pero ten en cuenta que el bot responderá TODOS tus chats a menos
  que lo configures para ignorar algunos).

---

## Paso 1 — Preparar Termux

Abre Termux y ejecuta, uno por uno:

```bash
termux-setup-storage
pkg update && pkg upgrade -y
pkg install nodejs-lts git -y
node -v
```

`node -v` debe mostrar v18 o superior. Si no, prueba `pkg install nodejs -y`
en vez de `nodejs-lts`.

## Paso 2 — Crear el repositorio en GitHub

1. Entra a https://github.com/new
2. Ponle un nombre, por ejemplo `whatsapp-claude-bot`.
3. Márcalo como **Privado** (recomendado — aunque tus claves nunca se suben
   gracias al `.gitignore`, es tu proyecto personal).
4. No marques "Add a README" (ya tenemos uno). Crea el repositorio.
5. Copia la URL que te da GitHub, algo como
   `https://github.com/TU_USUARIO/whatsapp-claude-bot.git`

### Autenticarte con GitHub desde Termux

GitHub ya no acepta contraseña normal por línea de comandos, necesitas un
**token de acceso personal**:

1. Ve a https://github.com/settings/tokens → "Generate new token (classic)".
2. Dale un nombre, marca el permiso `repo`, genera el token y **cópialo**
   (solo se muestra una vez).
3. En Termux, cuando `git push` te pida usuario y contraseña, usa tu usuario
   de GitHub como usuario, y **pega el token como contraseña**.

Configura también tu identidad para los commits:

```bash
git config --global user.name "Tu Nombre"
git config --global user.email "tu-correo@ejemplo.com"
```

## Paso 3 — Clonar tu repositorio vacío y copiar el proyecto

```bash
cd ~
git clone https://github.com/TU_USUARIO/whatsapp-claude-bot.git
cd whatsapp-claude-bot
```

Copia dentro de esta carpeta (`~/whatsapp-claude-bot`) todos los archivos de
este proyecto que te compartí: `src/`, `config/`, `package.json`,
`.env.example`, `.gitignore`, `README.md`. Puedes usar la app de archivos
de Termux o `termux-setup-storage` + mover desde tu carpeta de Descargas:

```bash
# ejemplo si descargaste el proyecto como zip a tu carpeta de Descargas
cp -r /sdcard/Download/whatsapp-claude-bot/* ~/whatsapp-claude-bot/
```

## Paso 4 — Instalar dependencias

```bash
npm install
```

Esto puede tardar unos minutos la primera vez.

## Paso 5 — Configurar tus claves y datos

```bash
cp .env.example .env
nano .env
```

Completa:
- `ANTHROPIC_API_KEY` → tu clave de https://console.anthropic.com/settings/keys
- `WHATSAPP_PHONE_NUMBER` → tu número con código de país, sin `+` ni espacios
  (ej. `521234567890`). Si lo dejas vacío, el bot te lo pedirá al arrancar.

Guarda con `Ctrl+O`, `Enter`, y sal con `Ctrl+X`.

Si quieres personalizar el nombre y personalidad del bot, edita
`config/persona.default.json` (más detalles abajo).

## Paso 6 — Ejecutar el bot y vincular por código

```bash
npm start
```

Vas a ver algo como:

```
🔑 Tu código de vinculación es:

   ABCD-1234

En tu teléfono: Ajustes → Dispositivos vinculados → Vincular un dispositivo
→ '¿No puedes escanear el código QR?' → ingresa este código.
```

En tu WhatsApp (puede ser el mismo teléfono donde corre Termux, u otro):

1. Ve a **Ajustes → Dispositivos vinculados → Vincular un dispositivo**.
2. Toca **"¿No puedes escanear el código QR?"**.
3. Ingresa el código de 8 dígitos que te mostró la terminal.

Cuando conecte verás:

```
✅ Bot conectado a WhatsApp y listo para responder.
```

A partir de ahí, cualquier mensaje que te escriban será respondido
automáticamente. La sesión queda guardada en `auth_session/`, así que no
necesitas repetir este paso cada vez (solo si borras esa carpeta o cierras
la sesión desde el teléfono).

## Paso 7 — Mantenerlo corriendo

Termux mata los procesos si cierras la app o Android lo hiberna. Para
mantenerlo activo:

```bash
termux-wake-lock
```

Para poder cerrar la terminal sin cortar el bot, usa `tmux`:

```bash
pkg install tmux -y
tmux new -s whatsapp-bot
npm start
# Ctrl+B, luego D → "desacopla" y lo deja corriendo en segundo plano
# tmux attach -t whatsapp-bot   → para volver a verlo
```

## Paso 8 — Subir tu configuración a GitHub

```bash
git add .
git commit -m "Bot funcionando con vinculación por código"
git push
```

**Importante:** `.env` y `auth_session/` nunca se suben (están en
`.gitignore`). `auth_session/` equivale a tener tu WhatsApp abierto — no lo
compartas ni lo subas a ningún repositorio público.

---

## Estructura del proyecto

```
whatsapp-claude-bot/
├── config/
│   └── persona.default.json → personalidad del bot (tono, rasgos, límites)
├── src/
│   ├── index.js      → conexión a WhatsApp (código de vinculación) y flujo principal
│   ├── claude.js      → llamadas a la API de Claude
│   ├── memory.js       → memoria de conversación por chat
│   └── persona.js       → arma el system prompt a partir del JSON de config/
├── data/
│   └── conversaciones.json  → historial guardado (se crea solo)
├── .env.example
├── .gitignore
└── package.json
```

## Personalizar la "personalidad"

El carácter del bot vive en `config/persona.default.json` (nombre, tono,
rasgos, límites). `src/persona.js` lee ese archivo y arma el system prompt.
Edita el JSON para cambiar cómo "siente" y responde el bot, sin tocar código.

Está pensado así para el futuro: si algún día distribuyes el bot a varios
usuarios, cada uno podría tener su propio `config/persona.<usuario>.json`,
indicando cuál cargar con la variable `PERSONA_PROFILE` en `.env`.

## Diseño pensado para distribución futura

Aunque hoy corre para un solo número de WhatsApp en tu Termux, dos
decisiones de diseño facilitan escalar esto después:

1. **Personalidad desacoplada** (`config/persona.*.json`) — cada usuario
   futuro podría tener la suya, sin tocar código.
2. **Memoria por `chatId`** (`src/memory.js`) — ya está organizada por chat;
   el cambio pendiente para multi-usuario sería separar los datos por
   "tenant" (usuario dueño del bot), documentado en un comentario dentro de
   ese archivo.
3. **Vinculación por código en vez de QR** — más fácil de automatizar o
   integrar en un panel web a futuro, donde cada usuario ingresaría su
   propio número y recibiría su propio código.

Cuando llegue el momento de distribuirlo: mover de Termux a un servidor/VPS
que soporte varias sesiones de WhatsApp en paralelo, y cambiar el JSON plano
por una base de datos. La lógica de conversación (`index.js`, `claude.js`)
no debería necesitar cambios mayores.

## Solución de problemas comunes

- **"Sesión cerrada"** al reconectar → borra la carpeta `auth_session/` y
  vuelve a correr `npm start` para generar un nuevo código.
- **El código expira antes de ingresarlo** → simplemente vuelve a correr
  `npm start`, se genera uno nuevo.
- **`npm install` falla en Termux** → asegúrate de tener `pkg install
  python clang make` instalados, algunas dependencias nativas los necesitan.

## Próximos pasos posibles

- Soportar mensajes de voz (transcribiéndolos antes de mandarlos a Claude).
- Responder solo a ciertos contactos (lista blanca).
- Añadir comandos especiales (ej. `/reset` para borrar el historial de un chat).
- Guardar la memoria en una base de datos en vez de un JSON plano si crece mucho.
