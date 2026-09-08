const { GoogleGenAI } = require("@google/genai");
const { SYSTEM_PROMPT } = require("./persona");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function aFormatoGemini(history) {
  return history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

async function generarRespuesta(history, intento = 1) {
  try {
    const response = await ai.models.generateContent({
      model: MODEL,
      contents: aFormatoGemini(history),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 400,
      },
    });

    const texto = response.text;
    return texto ? texto.trim() : "...";
  } catch (err) {
    const esLimiteDeCuota = err.message && err.message.includes("RESOURCE_EXHAUSTED");
    console.error(`❌ Error llamando a la API de Gemini (intento ${intento}):`, err.message);

    if (esLimiteDeCuota) {
      if (intento < 2) {
        await sleep(15000);
        return generarRespuesta(history, intento + 1);
      }
      return "Uy, estoy recibiendo demasiados mensajes justo ahora 😅 dame un minuto y vuelve a escribirme.";
    }

    if (intento < 3) {
      await sleep(1500 * intento);
      return generarRespuesta(history, intento + 1);
    }

    return "Uy, tuve un problema para responder justo ahora 😅 dame un segundo e intenta de nuevo.";
  }
}

module.exports = { generarRespuesta };
