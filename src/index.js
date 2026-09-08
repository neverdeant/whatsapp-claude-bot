require("dotenv").config();
const pino = require("pino");
const readline = require("readline");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestWaWebVersion,
  jidNormalizedUser,
} = require("@whiskeysockets/baileys");

const { generarRespuesta } = require("./ai");
const { obtenerHistorial, agregarMensaje } = require("./memory");

process.on("unhandledRejection", (err) => {
  console.error("⚠️ Error no manejado (el bot sigue corriendo):", err);
});
process.on("uncaughtException", (err) => {
  console.error("⚠️ Excepción no capturada (el bot sigue corriendo):", err);
});

const IGNORE_GROUPS = (process.env.IGNORE_GROUPS || "true") === "true";
const TYPING_DELAY_MAX = parseInt(process.env.TYPING_DELAY_MAX || "4", 10);

const PALABRAS_CLAVE_HUMANO = [
  "victor",
  "víctor",
  "dante",
  "hablar con el humano",
  "hablar con una persona",
  "hablar contigo",
  "eres un bot",
  "eres una ia",
  "eres una inteligencia artificial",
  "no eres tu",
  "no eres tú",
];

const ultimoAvisoPorChat = {};
const MINUTOS_ENTRE_AVISOS = 10;

function pareceQuererHablarConHumano(texto) {
  const normalizado = texto.toLowerCase();
  return PALABRAS_CLAVE_HUMANO.some((frase) => normalizado.includes(frase));
}

let codigoYaSolicitado = false;
let intentosReconexion = 0;
const MAX_INTENTOS = 5;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function preguntar(pregunta) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(pregunta, (respuesta) => {
    rl.close();
    resolve(respuesta.trim());
  }));
}

async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_session");

  let version;
  try {
    const infoVersion = await fetchLatestWaWebVersion();
    version = infoVersion.version;
    console.log(`ℹ️ Usando WhatsApp Web versión ${version.join(".")}`);
  } catch (err) {
    console.warn("⚠️ No se pudo obtener la última versión de WA Web, usando la versión por defecto.");
  }

  const sock = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    browser: Browsers.ubuntu("Chrome"),
    defaultQueryTimeoutMs: undefined,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (
      !codigoYaSolicitado &&
      !sock.authState.creds.registered &&
      (connection === "connecting" || qr)
    ) {
      codigoYaSolicitado = true;
      let numero = process.env.WHATSAPP_PHONE_NUMBER;
      if (!numero) {
        numero = await preguntar(
          "\n📱 Escribe tu número de WhatsApp con código de país, sin '+' ni espacios (ej. 521234567890): "
        );
      }

      await sleep(3000);

      try {
        const codigo = await sock.requestPairingCode(numero.replace(/[^0-9]/g, ""));
        console.log("\n🔑 Tu código de vinculación es:\n");
        console.log(`   ${codigo}\n`);
        console.log("En tu teléfono: Ajustes → Dispositivos vinculados → Vincular un dispositivo");
        console.log("→ '¿No puedes escanear el código QR?' → ingresa este código.");
        console.log("Tienes unos minutos antes de que expire.\n");
      } catch (err) {
        console.error("❌ No se pudo generar el código de vinculación:", err.message);
        codigoYaSolicitado = false;
      }
    }

    if (connection === "close") {
      const motivo = lastDisconnect?.error?.output?.statusCode;
      const yaEstaVinculado = sock.authState.creds.registered;
      const debeReconectar = motivo !== DisconnectReason.loggedOut;

      if (!yaEstaVinculado && !debeReconectar) {
        console.log("🔌 Sesión cerrada antes de vincular. Borra 'auth_session' y vuelve a correr 'npm start'.");
        return;
      }

      console.log("🔌 Conexión cerrada. Reconectando en 3 segundos...");
      intentosReconexion++;
      if (intentosReconexion >= MAX_INTENTOS) {
        console.log(`\n❌ Se alcanzó el máximo de ${MAX_INTENTOS} intentos. Deteniendo el bot.`);
        console.log("Revisa tu conexión a internet y vuelve a correr 'npm start'.\n");
        process.exit(1);
      }
      await sleep(3000);
      if (debeReconectar) iniciarBot().catch((err) => console.error("⚠️ Error al reconectar:", err));
    } else if (connection === "open") {
      intentosReconexion = 0;
      console.log("✅ Bot conectado a WhatsApp y listo para responder.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await procesarMensaje(sock, msg);
      } catch (err) {
        console.error("❌ Error procesando mensaje:", err);
      }
    }
  });
}

async function procesarMensaje(sock, msg) {
  if (!msg.message || msg.key.fromMe) return;

  const chatId = msg.key.remoteJid;

  const noEsConversacionReal =
    chatId === "status@broadcast" ||
    chatId.endsWith("@newsletter") ||
    chatId.endsWith("@broadcast");
  if (noEsConversacionReal) return;

  const esGrupo = chatId.endsWith("@g.us");
  if (esGrupo && IGNORE_GROUPS) return;

  const texto = extraerTexto(msg);
  if (!texto) return;

  console.log(`💬 [${chatId}] ${texto}`);

  if (pareceQuererHablarConHumano(texto)) {
    await avisarQueQuierenHablarConmigo(sock, chatId, texto);
  }

  await sock.sendPresenceUpdate("composing", chatId);
  if (TYPING_DELAY_MAX > 0) {
    const espera = 1000 + Math.random() * TYPING_DELAY_MAX * 1000;
    await sleep(espera);
  }

  const historial = obtenerHistorial(chatId);
  const historialActualizado = [...historial, { role: "user", content: texto }];

  const respuesta = await generarRespuesta(historialActualizado);

  agregarMensaje(chatId, "user", texto);
  agregarMensaje(chatId, "assistant", respuesta);

  await sock.sendPresenceUpdate("paused", chatId);
  await sock.sendMessage(chatId, { text: respuesta });

  console.log(`🤖 [${chatId}] ${respuesta}`);
}

function extraerTexto(msg) {
  const m = msg.message;
  if (!m) return null;
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    null
  );
}

async function avisarQueQuierenHablarConmigo(sock, chatId, texto) {
  const ahora = Date.now();
  const ultimoAviso = ultimoAvisoPorChat[chatId] || 0;
  const minutosDesdeUltimoAviso = (ahora - ultimoAviso) / 60000;
  if (minutosDesdeUltimoAviso < MINUTOS_ENTRE_AVISOS) return;
  ultimoAvisoPorChat[chatId] = ahora;

  try {
    const miPropioNumero = jidNormalizedUser(sock.user.id);
    const numeroDelContacto = chatId.split("@")[0];
    await sock.sendMessage(miPropioNumero, {
      text: `🔔 Alguien (${numeroDelContacto}) quiere hablar contigo directamente, no con el bot:\n\n"${texto}"`,
    });
  } catch (err) {
    console.error("⚠️ No se pudo enviar el aviso a tu propio número:", err.message);
  }
}

iniciarBot().catch((err) => console.error("⚠️ Error al iniciar el bot:", err));
