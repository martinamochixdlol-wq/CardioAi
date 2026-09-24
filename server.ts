import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialize Gemini client to avoid crashes if key is missing during startup
let genAIClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing");
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return genAIClient;
}

const SYSTEM_INSTRUCTION = `Eres CardioBot, un médico asistente virtual y especialista en cardiología preventiva y clínica para pacientes de habla hispana.
Tu propósito es responder dudas frecuentes sobre el corazón con empatía, rigor científico, claridad y un lenguaje cercano y fácil de comprender para cualquier paciente.

DIRECTIVAS ESENCIALES DE SEGURIDAD CLÍNICA (BANDERAS ROJAS / RED FLAGS):
- Si el usuario describe síntomas de ALERTA CRÍTICA:
  * Dolor torácico opresivo ("sensación de pata de elefante" o peso en el centro del pecho) que se irradia al brazo izquierdo, cuello, mandíbula, espalda o estómago.
  * Dificultad súbita y severa para respirar (disnea aguda).
  * Desmayo, pérdida de conocimiento o desvanecimiento súbito (síncope).
  * Sudoración fría profusa con náuseas y mareo.
  * Presión arterial sistólica superior a 180 mmHg o diastólica superior a 120 mmHg con síntomas (visión borrosa, dolor de cabeza intenso, confusión).
  -> EN ESTOS CASOS: DEBES INICIAR TU RESPUESTA INMEDIATAMENTE con una advertencia de URGENCIA destacada en negrita y mayúsculas, instruyendo al paciente a llamar urgentemente al servicio de emergencias médicas (112 en Europa, 911 en América) o acudir al hospital más cercano de inmediato, y NO conducir por su cuenta.

DIRECTIVAS DE COMUNICACIÓN CON EL PACIENTE:
1. Explica los términos médicos con metáforas o palabras sencillas:
   * Ejemplo: La presión arterial sistólica es la fuerza cuando el corazón bombea; la diastólica cuando descansa entre latidos.
   * Las extrasístoles son "latidos adelantados" que la gente siente como un salto o vacío en el pecho.
2. Temas frecuentes a resolver:
   * Hipertensión arterial y crisis hipertensiva vs pico emocional.
   * Palpitaciones, taquicardias y arritmias (cuándo suelen ser benignas por estrés/cafeína y cuándo investigar).
   * Colesterol (LDL "malo", HDL "bueno"), placas ateromatosas y prevención de infartos.
   * Medicamentos cardiológicos comunes: antihipertensivos (IECA, ARA-II, calcioantagonistas), betabloqueantes, estatinas, anticoagulantes y aspirina.
     * ADVERTENCIA: NUNCA indiques modificar la dosis, cambiar ni suspender medicamentos recetados. Aconseja siempre validar cualquier cambio con su cardiólogo o médico de cabecera.
   * Estudios diagnósticos: Electrocardiograma (ECG), Ergometría (prueba de esfuerzo), Ecocardiograma Doppler, Holter de 24 horas y MAPA.
   * Hábitos de vida cardiosaludables: Dieta mediterránea o DASH, reducción de sodio (< 2 g/día de sodio / < 5 g de sal), 150 min semanales de actividad aeróbica moderada, cese del tabaco y descanso reparador.
3. Estilo de respuesta:
   * Responde de forma directa, clara, concreta y empática a la duda planteada por el paciente.
   * Usa viñetas breves si la explicación lo requiere.
   * Evita rodeos innecesarios y NO agregues listas largas de preguntas recomendadas o de seguimiento al final de cada mensaje; concéntrate en resolver bien la consulta puntual del paciente.
4. Tono: Respetuoso, tranquilizador, humano y profesional.
5. Descargo de responsabilidad breve: Recuerda con naturalidad cuando sea pertinente que tus respuestas son de orientación educativa y no sustituyen la consulta presencial con un cardiólogo.`;

// API routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Chat endpoint (Streamed via SSE)
app.post("/api/chat/stream", async (req, res) => {
  try {
    const { messages, userProfile } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensajes inválidos o vacíos" });
    }

    const ai = getGenAI();

    // Set headers for Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Build context if user provided data
    let extraContext = "";
    if (userProfile) {
      const { bloodPressure, restingPulse, knownConditions, medications } = userProfile;
      extraContext = `\n\n[CONTEXTO DEL PACIENTE ACTIVO]\n`;
      if (bloodPressure) extraContext += `- Última medición de Presión Arterial: ${bloodPressure.systolic}/${bloodPressure.diastolic} mmHg (${bloodPressure.category || "no clasificada"})\n`;
      if (restingPulse) extraContext += `- Frecuencia cardíaca en reposo: ${restingPulse} lpm\n`;
      if (knownConditions && knownConditions.length > 0) extraContext += `- Antecedentes informados: ${knownConditions.join(", ")}\n`;
      if (medications && medications.length > 0) extraContext += `- Medicación habitual: ${medications.join(", ")}\n`;
      extraContext += `Ten en cuenta este contexto para personalizar tus explicaciones de manera segura.\n`;
    }

    // Convert chat history format for Gemini SDK
    // The last message is the current prompt
    const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];

    // System prompt combined with extraContext
    const fullSystemInstruction = SYSTEM_INSTRUCTION + extraContext;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      contents.push({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content || msg.text || "" }],
      });
    }

    // Helper to generate stream with fallback if 503 high demand occurs
    let responseStream;
    try {
      responseStream = await ai.models.generateContentStream({
        model: "gemini-3.8-flash",
        contents: contents,
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.4,
        },
      });
    } catch (primaryErr: any) {
      console.warn("Primary model error, falling back to gemini-3.6-flash:", primaryErr?.message);
      responseStream = await ai.models.generateContentStream({
        model: "gemini-3.6-flash",
        contents: contents,
        config: {
          systemInstruction: fullSystemInstruction,
          temperature: 0.4,
        },
      });
    }

    for await (const chunk of responseStream) {
      const textChunk = chunk.text;
      if (textChunk) {
        res.write(`data: ${JSON.stringify({ text: textChunk })}\n\n`);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("Error in /api/chat/stream:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Error al procesar la consulta cardiológica" });
    } else {
      res.write(`data: ${JSON.stringify({ error: error.message || "Error en la transmisión" })}\n\n`);
      res.end();
    }
  }
});

// Non-streaming fallback endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, userProfile } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "Mensajes inválidos o vacíos" });
    }

    const ai = getGenAI();

    let extraContext = "";
    if (userProfile) {
      const { bloodPressure, restingPulse, knownConditions, medications } = userProfile;
      extraContext = `\n\n[CONTEXTO DEL PACIENTE ACTIVO]\n`;
      if (bloodPressure) extraContext += `- Última medición de Presión Arterial: ${bloodPressure.systolic}/${bloodPressure.diastolic} mmHg (${bloodPressure.category || "no clasificada"})\n`;
      if (restingPulse) extraContext += `- Frecuencia cardíaca en reposo: ${restingPulse} lpm\n`;
      if (knownConditions && knownConditions.length > 0) extraContext += `- Antecedentes informados: ${knownConditions.join(", ")}\n`;
      if (medications && medications.length > 0) extraContext += `- Medicación habitual: ${medications.join(", ")}\n`;
      extraContext += `Ten en cuenta este contexto para personalizar tus explicaciones de manera segura.\n`;
    }

    const contents = messages.map((msg: any) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content || msg.text || "" }],
    }));

    let response;
    try {
      response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION + extraContext,
          temperature: 0.4,
        },
      });
    } catch (primaryErr: any) {
      console.warn("Primary model error in /api/chat, falling back to gemini-3.6-flash:", primaryErr?.message);
      response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION + extraContext,
          temperature: 0.4,
        },
      });
    }

    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Error in /api/chat:", error);
    res.status(500).json({ error: error.message || "Error al procesar la consulta" });
  }
});

// Vite middleware for development & static fallback for production
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CardioBot server running on http://localhost:${PORT}`);
  });
}

startServer();
