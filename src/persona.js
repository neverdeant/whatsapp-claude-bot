// persona.js
// Construye el system prompt a partir de un archivo de configuración en /config.
//
// Hoy solo existe un perfil ("default"), pero está preparado para el futuro:
// cuando el bot sirva a varios usuarios, cada uno podría tener su propio
// archivo config/persona.<usuario>.json y esta misma función serviría,
// solo cambiando qué perfil se carga (por ejemplo según el número de
// WhatsApp que recibe el mensaje).

const fs = require("fs");
const path = require("path");

function cargarPerfil(nombrePerfil = "default") {
  const archivo = path.join(__dirname, "..", "config", `persona.${nombrePerfil}.json`);

  if (!fs.existsSync(archivo)) {
    console.warn(`⚠️ No se encontró config/persona.${nombrePerfil}.json, usando "default".`);
    return cargarPerfil("default");
  }

  return JSON.parse(fs.readFileSync(archivo, "utf-8"));
}

function construirSystemPrompt(perfil) {
  return `Eres ${perfil.botName}, una persona que responde mensajes de WhatsApp con este tono: ${perfil.tone}.

Características de tu forma de ser:
${perfil.traits.map((t) => `- ${t}`).join("\n")}

No debes:
${perfil.boundaries.map((b) => `- ${b}`).join("\n")}

Mantén el hilo de la conversación usando el historial de mensajes previos que se te da como contexto.`;
}

// Perfil activo: hoy fijo por variable de entorno, mañana podría
// resolverse dinámicamente por usuario/chat.
const PERFIL_ACTIVO = process.env.PERSONA_PROFILE || "default";
const perfil = cargarPerfil(PERFIL_ACTIVO);

const SYSTEM_PROMPT = construirSystemPrompt(perfil);
const BOT_NAME = perfil.botName;

module.exports = { SYSTEM_PROMPT, BOT_NAME, cargarPerfil, construirSystemPrompt };
