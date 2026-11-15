import "dotenv/config";
import express from "express";
import path from "node:path";
import fs from "node:fs";
import { obtenerExplicacion, explicarPar } from "./explicacion.js";

const app = express();
const SALIDA = path.resolve(process.env.SALIDA_DIR || "./salida");

app.use(express.json());

// API routes must come before static middleware — static middleware returns 403 on POST
app.get("/api/resultados", (req, res) => {
  res.sendFile(path.join(SALIDA, "resultados.json"));
});

app.get("/api/explicacion", async (req, res) => {
  try {
    res.json(await obtenerExplicacion());
  } catch (err) {
    res.status(500).json({ error: "Aún no hay resultados. Corre pipeline.py primero." });
  }
});

// POST /api/explicacion-par
// Body: { sceneA: { id, date, version }, sceneB: { id, date, version } }
// Reads resultados.json to enrich with HV signal, 12-day reference and warnings,
// then calls Gemini with only that pair's data.
app.post("/api/explicacion-par", async (req, res) => {
  try {
    const { sceneA, sceneB } = req.body;
    if (!sceneA?.date || !sceneB?.date) {
      return res.status(400).json({ error: "sceneA and sceneB with date are required." });
    }

    const rutaRes = path.join(SALIDA, "resultados.json");
    if (!fs.existsSync(rutaRes)) {
      return res.status(503).json({ error: "No results file found. Run nombre.py first." });
    }
    const r = JSON.parse(fs.readFileSync(rutaRes, "utf8"));

    const normalize = d => d.replace(/-/g, "");
    const findEscena = date => r.escenas.find(e => e.fecha === normalize(date)) || null;

    const eA = findEscena(sceneA.date);
    const eB = findEscena(sceneB.date);

    if (!eA || !eB) {
      return res.status(404).json({
        error: `Scene not found in results: ${sceneA.date} or ${sceneB.date}`,
      });
    }

    const version = eA.version;
    const pares12 = r.referencia_12_dias?.pares?.filter(p => {
      const epa = r.escenas.find(e => e.fecha === p.fecha_a);
      return epa?.version === version;
    }) || [];
    const brutos12 = pares12.map(p => p.bruto_ha);
    const ref12 = brutos12.length
      ? {
          n: brutos12.length,
          min: Math.min(...brutos12),
          median: brutos12.sort((a, b) => a - b)[Math.floor(brutos12.length / 2)],
          max: Math.max(...brutos12),
        }
      : null;

    const hvA = r.serie_manglar?.find(e => e.fecha === eA.fecha);
    const hvB = r.serie_manglar?.find(e => e.fecha === eB.fecha);

    const compPar = r.comparaciones?.find(
      c => (c.fecha_a === eA.fecha && c.fecha_b === eB.fecha) ||
           (c.fecha_a === eB.fecha && c.fecha_b === eA.fecha)
    );

    const days = Math.abs((new Date(sceneB.date) - new Date(sceneA.date)) / 86400000);

    const datos = {
      date_a:          sceneA.date,
      date_b:          sceneB.date,
      version,
      days,
      water_a_ha:      eA.agua_ha,
      water_a_pct:     eA.agua_pct,
      water_b_ha:      eB.agua_ha,
      water_b_pct:     eB.agua_pct,
      gained_ha:       compPar?.gano_ha   ?? null,
      lost_ha:         compPar?.perdio_ha ?? null,
      gross_ha:        compPar?.bruto_ha  ?? null,
      net_ha:          compPar?.neto_ha   ?? null,
      gross_pct:       compPar?.bruto_pct_agua_a ?? null,
      times_reference: compPar && ref12 ? +(compPar.bruto_ha / ref12.median).toFixed(2) : null,
      reference_12d:   ref12,
      stable_vegetation: r.vegetacion_estable,
      hv_signal: {
        date_a: hvA ? { hv_median_db: hvA.hv_mediana_db, hh_minus_hv_db: hvA.hh_menos_hv_mediana_db } : null,
        date_b: hvB ? { hv_median_db: hvB.hv_mediana_db, hh_minus_hv_db: hvB.hh_menos_hv_mediana_db } : null,
      },
      threshold_db:  r.configuracion.umbral_db,
      min_patch_ha:  r.configuracion.min_pix * r.configuracion.ha_por_pixel,
      pixel_m:       r.configuracion.pixel_m,
      warnings:      r.informe.avisos,
      note_no_precomputed_pair: !compPar
        ? "Gained/lost/gross/net values are not available for this specific pair because it was not pre-computed by the pipeline. Only water area per scene is shown."
        : null,
    };

    const explicacion = await explicarPar(datos);
    res.json(explicacion);
  } catch (err) {
    console.error("POST /api/explicacion-par error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Static files after API routes
app.use("/imagenes", express.static(path.join(SALIDA, "imagenes")));
app.use(express.static("public"));
app.use(express.static("."));

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`Servidor en http://localhost:${PUERTO}`));