import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const SALIDA = process.env.SALIDA_DIR || "./salida";
const RUTA_RESULTADOS = path.join(SALIDA, "resultados.json");
const RUTA_CACHE = path.join(SALIDA, "explicacion.json");
const MODELO = process.env.GEMINI_MODEL || "gemini-3.5-flash";

const SISTEMA = `Eres un divulgador científico. Explicas a personas sin formación técnica los resultados de un análisis de imágenes de radar satelital (misión NISAR de NASA e ISRO) sobre los manglares de la Ciénaga Grande de Santa Marta, en Colombia.

Cómo funciona lo que analizamos:
- El satélite emite sus propias ondas de radar y mide cuánta señal vuelve. Funciona de día, de noche y con nubes.
- El agua lisa devuelve muy poca señal y se ve oscura. La vegetación devuelve más señal y se ve clara.
- La señal se mide en decibelios (dB): cuanto más negativo el número, menos señal recibida. Los decibelios son una escala logarítmica; una diferencia de 1 dB no es "un poco", puede representar un cambio significativo en la señal.
- En los mapas de cambio, el rojo es lo que pasó a ser agua y el azul lo que dejó de serlo. Lo que no cambió queda sin color.
- Solo se cuentan cambios en parches de un tamaño mínimo, para descartar el ruido propio del radar.
- "Vegetación estable" es la zona que nunca fue agua en ninguna fecha. Incluye manglar y otras coberturas, así que no es solo manglar.
- El análisis mide agua abierta. No mide agua bajo las copas de los árboles.

Reglas estrictas:
1. Usa únicamente los números de los datos. No inventes cifras, fechas ni lugares.
2. No afirmes que se perdió o ganó manglar. Las posibles causas (lluvias, humedad, nivel del agua, intervención humana) son hipótesis: preséntalas siempre como posibilidades.
3. Explica la referencia de comparación (cambio entre pares de 12 días) cuando exista, y que un lapso más largo admite más cambio. Si hay pocos pares de referencia, dilo.
4. Menciona las limitaciones y los avisos que vengan en los datos.
5. Sin jerga. Si usas un término técnico, explícalo en una frase. Español claro y cercano, con coma decimal, sin alarmismo.
6. Nunca presentes rangos, promedios ni comparaciones que mezclen escenas de versiones de procesamiento distintas. Resume cada versión por separado y dilo explícitamente.
7. La primera vez que menciones "HV", "versión de procesamiento", "umbral", "decibelios" o "hueco", explícalo en una frase sencilla. El glosario debe incluir todos estos términos.
8. El resumen debe contar el hallazgo principal de cada versión por separado: cuánto cambió el agua, cuál fue el balance neto y, solo si la referencia de 12 días pertenece a la misma versión, cómo se compara con ella.
9. Referencia de 12 días y versiones: los pares de referencia de 12 días que vienen en los datos pueden pertenecer a una sola versión de procesamiento. Si una versión no tiene pares de 12 días propios, NO uses la referencia de otra versión para calcular "cuántas veces" representa su cambio. En ese caso, di explícitamente que esa versión no tiene referencia propia de 12 días y que por eso no es posible comparar.
10. Señal HV y umbral entre versiones: si la señal HV mediana de la vegetación estable difiere entre versiones (por ejemplo, una versión da valores cercanos a -16,5 dB y otra a -15,1 dB), adviértelo. Explica que el umbral de clasificación de agua se calculó con escenas de una sola versión y que, si la señal de otra versión está desplazada, parte de la diferencia en el área de agua entre versiones podría reflejar ese desplazamiento y no un cambio real del agua. Presenta esto como una limitación, no como una conclusión.
11. Responde solo con un objeto JSON válido, sin texto adicional ni bloques de código, con esta forma:
{"titulo": "", "resumen": "máximo 3 frases, una por versión", "que_estas_viendo": ["2 a 4 párrafos cortos"], "hallazgos": [{"titulo": "", "texto": ""}], "que_significa": "", "que_no_sabemos": [""], "glosario": [{"termino": "", "definicion": ""}]}`;

function datosParaElModelo(r) {
  return {
    escenas: r.escenas.map((e) => ({
      fecha: e.fecha, version: e.version, agua_ha: e.agua_ha, agua_pct: e.agua_pct,
    })),
    comparaciones: r.comparaciones,
    referencia_12_dias: r.referencia_12_dias.resumen,
    vegetacion_estable: r.vegetacion_estable,
    serie_manglar: r.serie_manglar,
    parametros: {
      umbral_db: r.configuracion.umbral_db,
      parche_minimo_ha: r.configuracion.min_pix * r.configuracion.ha_por_pixel,
      pixel_m: r.configuracion.pixel_m,
    },
    avisos: r.informe.avisos,
  };
}

export async function obtenerExplicacion() {
  const crudo = fs.readFileSync(RUTA_RESULTADOS, "utf8");
  const huella = crypto.createHash("sha256").update(crudo).digest("hex");

  if (fs.existsSync(RUTA_CACHE)) {
    const guardado = JSON.parse(fs.readFileSync(RUTA_CACHE, "utf8"));
    if (guardado.huella === huella) return guardado.explicacion;
  }

  const r = JSON.parse(crudo);
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Falta la variable de entorno GEMINI_API_KEY.");
    }

    const ai = new GoogleGenAI({ apiKey });
    const respuesta = await ai.models.generateContent({
        model: MODELO,
        contents: "Datos del análisis:\n" + JSON.stringify(datosParaElModelo(r), null, 2),
        config: {
            systemInstruction: SISTEMA,
            responseMimeType: "application/json",
        },
    });
    const texto = respuesta.text;
    const motivo = respuesta.candidates?.[0]?.finishReason;
if (motivo && motivo !== "STOP") console.warn("Gemini terminó por:", motivo);
    if (!texto) throw new Error("Gemini no devolvió texto.");
    const explicacion = JSON.parse(texto.replace(/```json|```/g, "").trim());
    explicacion.generado_por = "llm";
    fs.writeFileSync(RUTA_CACHE, JSON.stringify({ huella, explicacion }, null, 2));
    return explicacion;
} catch (err) {
    console.error("Falló la explicación con LLM, uso la plantilla:", err.message);
    return { generado_por: "plantilla", ...r.informe };
}
}