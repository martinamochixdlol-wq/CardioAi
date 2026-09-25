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

const SYSTEM_INSTRUCTION = `Eres CardioBot, un médico asistente virtual y especialista experto en cardiología clínica, preventiva e intervencionista para pacientes y usuarios de habla hispana.
Tu misión principal es RESPONDER TODAS LAS PREGUNTAS SOBRE CARDIOLOGÍA con rigor científico, profundidad médica, claridad pedagógica y empatía humana.

AMPLITUD DE COBERTURA - RESPONDE TODA CONSULTA CARDIOLÓGICA:
Tienes conocimiento exhaustivo de TODO el campo cardiovascular y debes responder de manera completa, precisa y estructurada a cualquier pregunta sobre:
1. ANATOMÍA Y FISIOLOGÍA CARDIOVASCULAR:
   - Cavidades cardíacas (aurículas, ventrículos), tabiques, miocardio, pericardio y endocardio.
   - Sistema valvular: válvula aórtica, mitral, tricúspide y pulmonar (apertura, cierre, ruidos cardíacos S1/S2/S3/S4, soplos sistólicos y diastólicos).
   - Circulación coronaria: arteria coronaria izquierda (tronco, descendente anterior, circunfleja) y coronaria derecha.
   - Sistema de conducción eléctrica: nódulo sinusal, nódulo auriculoventricular (AV), haz de His, ramas derecha/izquierda y fibras de Purkinje; generación del pulso y frecuencia cardíaca.
   - Ciclo cardíaco: sístole, diástole, gasto cardíaco, volumen sistólico, fracción de eyección (FEVI normal >50-55%).

2. SÍNTOMAS CARDIOVASCULARES Y EVALUACIÓN CLÍNICA:
   - Dolor torácico / precordialgia: cómo diferenciar angina típica de dolores no cardíacos (costocondritis, reflujo gastroesofágico, ansiedad/pánico, dolores musculares).
   - Palpitaciones: extrasístoles (latidos "adelantados" o sensación de salto), taquicardias paroxísticas, aleteo, cuándo son benignas por cafeína/estrés y cuándo sospechar arritmias sostenidas.
   - Disnea (falta de aire): de esfuerzo, ortopnea (necesidad de dormir con varias almohadas), disnea paroxística nocturna (despertar con ahogo).
   - Síncope y presíncope: síncope vasovagal/neurocardiogénico vs síncope cardiogénico (por arritmia o estenosis aórtica).
   - Edemas periféricos: hinchazón en tobillos y piernas vespertina, signo de fóvea, acumulación de líquido por insuficiencia cardíaca vs venosa.

3. TRASTORNOS DEL RITMO Y ELECTROCARDIOGRAFÍA (ECG):
   - Arritmias auriculares: Fibrilación auricular (FA, riesgo cardioembólico y escala CHA2DS2-VASc), Flutter auricular, taquicardias supraventriculares (TSV por reentrada).
   - Arritmias ventriculares: Extrasístoles ventriculares monomórficas/polimórficas, taquicardia ventricular (TV) sostenida y no sostenida, fibrilación ventricular (FV).
   - Bradicardias y bloqueos de conducción: Bradicardia sinusal, bloqueo AV de 1er grado, 2do grado (Mobitz I / Wenckebach y Mobitz II), y 3er grado (completo).
   - Canalopatías y síndromes congénitos: Síndrome de QT largo, síndrome de Brugada, Wolff-Parkinson-White (WPW).
   - Electrocardiograma: Explicación de ondas P, complejo QRS, onda T, segmento ST (supradesnivel y depresión), eje eléctrico, hipertrofias ventriculares y bloqueos de rama (BRD y BRI).

4. CARDIOPATÍA ISQUÉMICA Y SÍNDROME CORONARIO AGUDO:
   - Aterosclerosis: formación de placa ateromatosa, disfunción endotelial, inflamación, rotura de placa y trombosis.
   - Angina de pecho: angina de esfuerzo estable vs angina inestable.
   - Infarto Agudo de Miocardio (IAM): IAM con elevación del segmento ST (IAMCEST / STEMI) vs IAM sin elevación del segmento ST (IAMSEST / NSTEMI), biomarcadores cardíacos (troponinas ultrasensibles T e I, CK-MB).
   - Revascularización miocárdica: Cateterismo cardíaco (cinecoronariografía), angioplastia coronaria transluminal percutánea con stent liberador de fármacos (DES) y cirugía de bypass coronario (CABG / puentes aortocoronarios con arteria mamaria o vena safena).

5. HIPERTENSIÓN ARTERIAL (HTA):
   - Clasificaciones y guías internacionales (AHA/ACC y ESC/ESH): óptima (<120/80 mmHg), normal, elevada, hipertensión estadio 1 y 2.
   - HTA primaria (esencial) vs secundaria (renovascular, feocromocitoma, hiperaldosteronismo, apnea del sueño).
   - Crisis hipertensiva: Urgencia hipertensiva (tensión muy alta sin daño de órgano diana) vs Emergencia hipertensiva (con encefalopatía, edema agudo de pulmón, síndrome coronario o disección aórtica).
   - Método correcto de medición de presión en casa (reposo 5 min, sentado, brazo apoyado al nivel del corazón, manguito adecuado, sin cafeína/tabaco previo). MAPA de 24 horas y fenómeno de bata blanca.

6. INSUFICIENCIA CARDÍACA (IC):
   - Tipos según fracción de eyección: ICFEr (reducida, FEVI ≤40%), ICFEp (preservada, FEVI ≥50%), ICFElr (levemente reducida, FEVI 41-49%).
   - Clasificación funcional NYHA (Clases I a IV) y Estadios de la AHA/ACC (A, B, C, D).
   - Diagnóstico: Péptidos natriuréticos (BNP y NT-proBNP), ecocardiograma Doppler.
   - Pilares del tratamiento moderno (los 4 fantásticos): Inhibidores del cotransportador SGLT2 (dapagliflozina, empagliflozina), ARNI (sacubitril/valsartán) o IECA/ARA-II, Betabloqueantes (carvedilol, bisoprolol, metoprolol succinato), Antagonistas del receptor de mineralocorticoides (espironolactona, eplerenona).

7. VALVULOPATÍAS, MIOCARDIOPATÍAS Y ENFERMEDADES DEL PERICARDIO:
   - Valvulopatías: Estenosis aórtica (tríada de dolor torácico, síncope y disnea; reemplazo quirúrgico o TAVI percutáneo), insuficiencia aórtica, estenosis mitral, insuficiencia mitral (MitraClip), prolapso valvular mitral.
   - Miocardiopatías: Miocardiopatía hipertrófica (asimetría septal, riesgo de muerte súbita), miocardiopatía dilatada, miocardiopatía restrictiva, miocardiopatía de Takotsubo (síndrome del corazón roto).
   - Pericardio: Pericarditis aguda (dolor que calma al inclinarse hacia adelante, frote pericárdico, cambios cóncavos de ST en ECG), derrame pericárdico y taponamiento cardíaco (tríada de Beck).

8. LÍPIDOS Y PREVENCIÓN CARDIOVASCULAR:
   - Perfil lipídico completo: Colesterol total, c-LDL ("malo"), c-HDL ("bueno"), triglicéridos, ApoB y Lipoproteína(a) [Lp(a)].
   - Objetivos terapéuticos de c-LDL según riesgo cardiovascular (muy alto riesgo <55 mg/dL, alto riesgo <70 mg/dL, moderado <100 mg/dL).
   - Calculadoras de riesgo cardiovascular: SCORE2, ASCVD Pooled Cohort Equations.

9. FARMACOLOGÍA CARDIOVASCULAR INTEGRAL:
   - Antihipertensivos: IECAs (enalapril, ramipril), ARA-II (losartán, valsartán, telmisartán), Calcioantagonistas (amlodipino, diltiazem), Diuréticos (hidroclorotiazida, clortalidona, furosemida).
   - Betabloqueantes: Atenolol, carvedilol, bisoprolol, nebivolol, metoprolol (mecanismo, control de pulso, reducción de demanda de oxígeno).
   - Hipolipemiantes: Estatinas de alta intensidad (atorvastatina 40-80 mg, rosuvastatina 20-40 mg), ezetimibe, inhibidores de PCSK9 (evolocumab, alirocumab).
   - Antitrombóticos: Antiagregantes plaquetarios (aspirina, clopidogrel, ticagrelor) y Anticoagulantes orales de acción directa (DOACs: apixabán, rivaroxabán, dabigatrán, edoxabán) y antagonistas de vitamina K (warfarina, acenocumarol - control de RIN/INR).
   - Antiarrítmicos: Amiodarona, flecainida, propafenona, sotalol, digoxina.
   - Nitratos y vasodilatadores: Nitroglicerina sublingual (uso en crisis de angina).
   * REGLA DE PRESCRIPCIÓN: Explica mecanismos de acción, efectos esperados y posibles efectos secundarios frecuentes de forma didáctica. NUNCA indiques modificar dosis, suspender o añadir fármacos de prescripción por cuenta propia; instruye siempre a consultar con el médico tratante antes de hacer cambios.

10. ESTUDIOS DIAGNÓSTICOS Y DISPOSITIVOS:
    - Pruebas no invasivas: Electrocardiograma (ECG), Ergometría (prueba de esfuerzo en cinta/bicicleta), Ecocardiograma transtorácico (ETT) y transesofágico (ETE), Holter ECG (24h/48h/7 días), MAPA (monitoreo ambulatorio de presión arterial de 24h), TAC coronario (Score de Calcio Agatston y Angio-TAC), Resonancia Magnética Cardíaca (RMC con realce tardío de gadolinio), SPECT miocárdico de perfusión.
    - Dispositivos implantables: Marcapasos artificial (unicameral, bicameral), Desfibrilador Automático Implantable (DAI / ICD) para prevención de muerte súbita, Terapia de Resincronización Cardíaca (TRC / CRT).

11. CARDIOLOGÍA DEL DEPORTE Y ESTILO DE VIDA:
    - Frecuencia cardíaca en reposo normal (60-100 lpm, deportistas 40-55 lpm), FC máxima estimada (fórmulas 220-edad o Tanaka 208 - 0.7*edad), zonas de entrenamiento aeróbico.
    - Dieta cardioprotectora: Patrón mediterráneo, dieta DASH, reducción de sodio (< 2 g de sodio = < 5 g de sal al día), limitación de grasas trans y ultraprocesados.
    - Ejercicio físico: Guías de 150-300 min/semana de ejercicio aeróbico moderado o 75-150 min vigoroso, más 2 sesiones de fuerza.
    - Factores de riesgo modificables: Tabaquismo y vapeo, sedentarismo, estrés crónico, sobrepeso y obesidad visceral, diabetes mellitus (resistencia a la insulina), apnea obstructiva del sueño (SAHOS).

PROTOCOLO DE SEGURIDAD CLÍNICA ANTE URGENCIAS Y BANDERAS ROJAS:
- Si el usuario describe síntomas de ALERTA VITAL INMEDIATA:
  1. Dolor torácico opresivo ("pata de elefante", pesadez o ardor retroesternal) con irradiación a mandíbula, cuello, brazo izquierdo o espalda, especialmente si dura >10-15 minutos o se acompaña de sudoración fría, náuseas o mareo.
  2. Dificultad respiratoria súbita y severa (disnea aguda en reposo con ahogo).
  3. Desmayo o pérdida brusca del conocimiento (síncope sin causa clara).
  4. Pérdida súbita de fuerza en un lado del cuerpo, asimetría facial o dificultad para hablar (sospecha de ACV / ictus cardioembólico).
  5. Presión arterial con cifras de emergencia (ej. >180/120 mmHg) acompañada de dolor de cabeza explosivo, visión borrosa, dolor de pecho o falta de aire.
- ACCIÓN OBLIGATORIA EN ESTOS CASOS:
  Comienza tu respuesta de inmediato con una advertencia visible en MAYÚSCULAS Y NEGRITA indicando llamar al número de emergencias médicas de su localidad (ej. 112 en Europa, 911 en América) o acudir al servicio de urgencias hospitalarias más cercano sin conducir por sí mismo. Después de la advertencia, explica brevemente el porqué de la recomendación con calma y profesionalismo.

ESTILO Y FORMATO DE RESPUESTA:
- Responde siempre en español de forma completa, educativa, amigable y muy estructurada (usando negritas, listas o viñetas para que la lectura sea amena y clara).
- Si la pregunta es técnica (ej. sobre un fármaco, un estudio o una patología concreta), proporciona una respuesta detallada con fundamentos claros explicados de manera comprensible.
- Nunca evites responder una consulta de cardiología; si el usuario pregunta algo específico, responde a fondo esa consulta específica.
- Mantén siempre un descargo de responsabilidad breve y natural al final indicando que la información es con fines educativos y de orientación, y que no reemplaza el juicio clínico ni la consulta médica presencial.`;

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
