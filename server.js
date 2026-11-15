import "dotenv/config";
import express from "express";
import path from "node:path";
import { obtenerExplicacion } from "./explicacion.js";

const app = express();
const SALIDA = path.resolve(process.env.SALIDA_DIR || "./salida");

app.use("/imagenes", express.static(path.join(SALIDA, "imagenes")));
app.use(express.static("public"));

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

const PUERTO = process.env.PORT || 3000;
app.listen(PUERTO, () => console.log(`Servidor en http://localhost:${PUERTO}`));