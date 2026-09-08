// memory.js
// Guarda el historial de conversación de cada chat para dar continuidad
// a las respuestas (no perder el "hilo"). Se persiste en un JSON simple.
//
// NOTA (futuro multi-usuario): hoy hay un único archivo conversaciones.json
// con todos los chats de un solo número de WhatsApp. Si esto se distribuye
// a varios usuarios, este archivo es el punto exacto a reemplazar por una
// base de datos con un campo adicional "tenant_id" (o una carpeta data/
// distinta por usuario/instancia). El resto del código (index.js, claude.js)
// no necesitaría cambios porque solo conoce las funciones obtenerHistorial()
// y agregarMensaje(), no cómo se guardan los datos.

const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "..", "data", "conversaciones.json");
const MAX_MENSAJES_POR_CHAT = 20; // cuántos mensajes recientes recordar

let store = {};

function cargar() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      store = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch (err) {
    console.warn("⚠️ No se pudo cargar memoria previa, empezando de cero.");
    store = {};
  }
}

function guardar() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function obtenerHistorial(chatId) {
  return store[chatId] || [];
}

function agregarMensaje(chatId, role, content) {
  if (!store[chatId]) store[chatId] = [];
  store[chatId].push({ role, content });

  // recorta el historial para no crecer indefinidamente
  if (store[chatId].length > MAX_MENSAJES_POR_CHAT) {
    store[chatId] = store[chatId].slice(-MAX_MENSAJES_POR_CHAT);
  }

  guardar();
}

cargar();

module.exports = { obtenerHistorial, agregarMensaje };
