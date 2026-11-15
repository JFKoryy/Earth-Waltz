"""
pipeline.py - NISAR GSLC -> toda la información que consume la app
Zona: manglares de la Ciénaga Grande de Santa Marta

Uso:      python pipeline.py
Entrada:  escenas/    los .h5 de NISAR (GSLC), con el nombre original de ASF
Salida:   salida/resultados.json   todo lo que lee la API
          salida/informe.md        texto del informe, generado a partir de los números
          salida/catalogo.json     escenas ya procesadas (permite correr de nuevo sin repetir trabajo)
          salida/datos/            arreglos .npy en dB por fecha y polarización (caché)
          salida/imagenes/         PNG por fecha (HV y HH) y mapas de cambio

Funciona con cualquier cantidad de escenas: cuando lleguen más .h5 a escenas/,
se vuelve a correr y solo se procesan las nuevas.
"""
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

import h5py
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from pyproj import Transformer
from scipy.ndimage import label

# ------------------------------------------------------------ configuración
RAIZ = Path(__file__).resolve().parent
ENTRADA = RAIZ / "escenas"
SALIDA = RAIZ / "salida"
DATOS = SALIDA / "datos"
IMAGENES = SALIDA / "imagenes"

BASE = "/science/LSAR/GSLC/grids/frequencyA"
LON_MIN, LON_MAX = -74.6231, -74.437
LAT_MIN, LAT_MAX = 10.7316, 10.9686

FACTOR = 4           # se promedian bloques de FACTOR x FACTOR píxeles (reduce el ruido granulado)
UMBRAL_DB = -20.78   # separa agua de no agua en HV (Otsu sobre la escena del 29-10-2025)
MIN_PIX = 25         # tamaño mínimo de un parche para contarlo como cambio
DIAS_CICLO = 12      # separación entre pasadas consecutivas de NISAR
PARES_EXTRA = []     # comparaciones adicionales, por ejemplo [("20251029", "20251204")]

# rangos de color fijos, para que las imágenes de distintas fechas sean comparables
RANGO_PNG = {"HV": (-30, -5), "HH": (-30, 0)}

for carpeta in (ENTRADA, DATOS, IMAGENES):
    carpeta.mkdir(parents=True, exist_ok=True)


# ------------------------------------------------------------ utilidades
def fecha_legible(f):
    return datetime.strptime(f, "%Y%m%d").strftime("%d-%m-%Y")


def dias_entre(fa, fb):
    return (datetime.strptime(fb, "%Y%m%d") - datetime.strptime(fa, "%Y%m%d")).days


def num(x, dec=1):
    return f"{x:.{dec}f}".replace(".", ",")


def leer_nombre(nombre):
    p = nombre.replace(".h5", "").split("_")
    if len(p) < 15 or p[0] != "NISAR" or p[3] != "GSLC":
        raise ValueError(f"nombre no reconocido como GSLC de NISAR: {nombre}")
    return {
        "archivo": nombre, "ciclo": p[4], "trayecto": p[5], "direccion": p[6],
        "marco": p[7], "polarizacion": p[9], "fecha": p[11][:8],
        "version": p[13], "codigo": p[14],
    }


def multilook(a, fy, fx):
    ny = (a.shape[0] // fy) * fy
    nx = (a.shape[1] // fx) * fx
    a = a[:ny, :nx]
    return a.reshape(ny // fy, fy, nx // fx, fx).mean(axis=(1, 3))


def quitar_pequenos(mascara, min_pix):
    etiquetas, _ = label(mascara)
    tamanos = np.bincount(etiquetas.ravel())
    grandes = tamanos >= min_pix
    grandes[0] = False
    return grandes[etiquetas]


def cargar(fecha, pol):
    return np.load(DATOS / f"{fecha}_{pol}.npy")


# ------------------------------------------------------------ 1. procesar escenas nuevas
def procesar_escena(ruta, info):
    """Recorta la zona, promedia, pasa a dB y guarda HH y HV. Devuelve metadatos."""
    with h5py.File(ruta, "r") as f:
        g = f[BASE]
        x = g["xCoordinates"][:]
        y = g["yCoordinates"][:]
        epsg = int(g["projection"][()])
        ida = Transformer.from_crs(4326, epsg, always_xy=True)
        xa, ya = ida.transform(LON_MIN, LAT_MIN)
        xb, yb = ida.transform(LON_MAX, LAT_MAX)
        dentro = (x.min() <= min(xa, xb) and max(xa, xb) <= x.max()
                  and y.min() <= min(ya, yb) and max(ya, yb) <= y.max())
        if not dentro:
            raise ValueError("la zona queda fuera de la escena")
        c0, c1 = sorted([np.abs(x - xa).argmin(), np.abs(x - xb).argmin()])
        r0, r1 = sorted([np.abs(y - ya).argmin(), np.abs(y - yb).argmin()])
        norte_arriba = y[1] < y[0]
        for pol in ("HH", "HV"):
            bloque = g[pol][r0:r1, c0:c1]
            if not norte_arriba:
                bloque = bloque[::-1]
            suave = multilook(np.abs(bloque) ** 2, FACTOR, FACTOR)
            db = 10 * np.log10(np.where(suave > 0, suave, np.nan))
            np.save(DATOS / f"{info['fecha']}_{pol}.npy", db.astype("float32"))
        volver = Transformer.from_crs(epsg, 4326, always_xy=True)
        oeste, este = sorted([float(x[c0]), float(x[c1])])
        sur, norte = sorted([float(y[r0]), float(y[r1])])
        lon_o, lat_n = volver.transform(oeste, norte)
        lon_e, lat_s = volver.transform(este, sur)
        pixel_m = float((abs(x[1] - x[0]) + abs(y[1] - y[0])) / 2 * FACTOR)
        return {
            "forma": list(db.shape),
            "pixel_m": round(pixel_m, 2),
            "origen": [float(x[c0]), float(y[r0])],
            "limites_leaflet": [[lat_s, lon_o], [lat_n, lon_e]],
        }


def actualizar_catalogo(avisos):
    ruta = SALIDA / "catalogo.json"
    catalogo = {}
    if ruta.exists():
        catalogo = {e["fecha"]: e for e in json.loads(ruta.read_text())}

    candidatas = []
    for h5 in sorted(ENTRADA.glob("*.h5")):
        try:
            candidatas.append(leer_nombre(h5.name))
        except ValueError as e:
            avisos.append(str(e))

    llaves = Counter((e["trayecto"], e["marco"], e["direccion"], e["polarizacion"])
                     for e in list(catalogo.values()) + candidatas)
    if not llaves:
        return catalogo, 0
    referencia = llaves.most_common(1)[0][0]

    nuevas = 0
    for info in candidatas:
        llave = (info["trayecto"], info["marco"], info["direccion"], info["polarizacion"])
        if llave != referencia:
            avisos.append(f"{info['archivo']}: trayecto/marco/dirección/polarización distintos a "
                          f"los de la mayoría {referencia}; no es comparable y se omite.")
            continue
        ya_hecha = (info["fecha"] in catalogo
                    and (DATOS / f"{info['fecha']}_HV.npy").exists()
                    and (DATOS / f"{info['fecha']}_HH.npy").exists())
        if ya_hecha:
            continue
        print("Procesando", fecha_legible(info["fecha"]), "...", flush=True)
        try:
            meta = procesar_escena(ENTRADA / info["archivo"], info)
        except (OSError, KeyError, ValueError) as e:
            avisos.append(f"{info['archivo']}: no se pudo procesar ({e}). "
                          "Si aún se está descargando, vuelve a correr cuando termine.")
            continue
        info.update(meta)
        catalogo[info["fecha"]] = info
        nuevas += 1

    ruta.write_text(json.dumps(sorted(catalogo.values(), key=lambda e: e["fecha"]), indent=2))
    return catalogo, nuevas


# ------------------------------------------------------------ 2. análisis de agua
def cambio_agua(fa, fb, ha, guardar_png=False):
    a, b = cargar(fa, "HV"), cargar(fb, "HV")
    if a.shape != b.shape:
        raise ValueError(f"dimensiones distintas entre {fa} y {fb}")
    validos = ~np.isnan(a) & ~np.isnan(b)
    agua_a = (a < UMBRAL_DB) & validos
    agua_b = (b < UMBRAL_DB) & validos
    gano = quitar_pequenos(agua_b & ~agua_a, MIN_PIX)
    perdio = quitar_pequenos(agua_a & ~agua_b, MIN_PIX)
    if guardar_png:
        rgba = np.zeros(a.shape + (4,), dtype=np.uint8)
        rgba[gano] = (255, 0, 0, 200)
        rgba[perdio] = (0, 0, 255, 200)
        plt.imsave(IMAGENES / f"cambio_{fa}_{fb}.png", rgba)
    g, p = float(gano.sum() * ha), float(perdio.sum() * ha)
    agua_a_ha = float(agua_a.sum() * ha)
    bruto = g + p
    return {
        "fecha_a": fa, "fecha_b": fb, "dias": dias_entre(fa, fb),
        "agua_a_ha": round(agua_a_ha, 1), "agua_b_ha": round(float(agua_b.sum() * ha), 1),
        "gano_ha": round(g, 1), "perdio_ha": round(p, 1),
        "bruto_ha": round(bruto, 1), "neto_ha": round(g - p, 1),
        "bruto_pct_agua_a": round(100 * bruto / agua_a_ha, 2) if agua_a_ha else None,
    }


# ------------------------------------------------------------ 3. texto del informe
def redactar_agua(c, ref, ha):
    t = (f"Entre el {fecha_legible(c['fecha_a'])} y el {fecha_legible(c['fecha_b'])} "
         f"({c['dias']} días) se detectaron {num(c['bruto_ha'], 0)} ha de cambio en agua abierta "
         f"({num(c['bruto_pct_agua_a'])} % del agua inicial), en parches de al menos "
         f"{num(MIN_PIX * ha)} ha: {num(c['gano_ha'], 0)} ha pasaron a agua y "
         f"{num(c['perdio_ha'], 0)} ha dejaron de serlo (balance de {num(c['neto_ha'], 0)} ha). ")
    if ref and ref["mediana"] > 0:
        t += (f"Como referencia, entre escenas consecutivas de {DIAS_CICLO} días con el mismo "
              f"procesamiento el cambio fue de {num(ref['min'], 0)} a {num(ref['max'], 0)} ha "
              f"(valor central {num(ref['mediana'], 0)} ha, {ref['n']} pares). Este cambio equivale a "
              f"{num(c['bruto_ha'] / ref['mediana'])} veces ese valor central, pero abarca "
              f"{num(c['dias'] / DIAS_CICLO)} veces más tiempo, y un lapso más largo admite más cambio. ")
    else:
        t += "Todavía no hay pares de 12 días para saber qué es un cambio normal. "
    t += "Esto mide agua abierta y no identifica por sí solo la causa del cambio."
    return t


def redactar_manglar(serie, veg, version):
    s = [x for x in serie if x["version"] == version]
    if len(s) < 2:
        return None
    vals = [x["hv_mediana_db"] for x in s]
    return (f"Procesamiento {version}: en la vegetación estable ({num(veg['ha'], 0)} ha, "
            f"{num(veg['pct_recorte'], 0)} % del recorte) la señal HV mediana varió entre "
            f"{num(min(vals), 2)} y {num(max(vals), 2)} dB ({num(max(vals) - min(vals), 2)} dB de rango) "
            f"entre el {fecha_legible(s[0]['fecha'])} y el {fecha_legible(s[-1]['fecha'])}. "
            "Con estos datos no se puede atribuir esa variación a pérdida de manglar: puede reflejar "
            "humedad de la vegetación o del suelo, agua bajo las copas o efectos del instrumento. "
            "La vegetación estable incluye otras coberturas además del manglar.")


# ------------------------------------------------------------ principal
def main():
    avisos = []
    catalogo, nuevas = actualizar_catalogo(avisos)
    escenas = sorted((e for e in catalogo.values()
                      if (DATOS / f"{e['fecha']}_HV.npy").exists()
                      and (DATOS / f"{e['fecha']}_HH.npy").exists()),
                     key=lambda e: e["fecha"])
    if not escenas:
        print("No hay escenas procesadas. Pon los .h5 en", ENTRADA)
        for a in avisos:
            print(" AVISO:", a)
        return

    forma_ref = escenas[0]["forma"]
    for e in list(escenas):
        if e["forma"] != forma_ref:
            avisos.append(f"{e['fecha']}: dimensiones {e['forma']} distintas de {forma_ref}; se omite.")
            escenas.remove(e)
    pixel_m = escenas[0]["pixel_m"]
    for e in escenas:
        if abs(e["pixel_m"] - pixel_m) > 0.01:
            avisos.append(f"{e['fecha']}: tamaño de píxel {e['pixel_m']} m distinto de {pixel_m} m.")
        if e["origen"] != escenas[0]["origen"]:
            avisos.append(f"{e['fecha']}: el recorte no alinea con el de {escenas[0]['fecha']}.")
        if e["codigo"] != "N":
            avisos.append(f"{e['fecha']}: el nombre trae el código '{e['codigo']}' en lugar de 'N'; "
                          "revisa su significado en la guía de usuario de NISAR antes de usarla.")
    ha = pixel_m ** 2 / 10000

    for e1, e2 in zip(escenas, escenas[1:]):
        d = dias_entre(e1["fecha"], e2["fecha"])
        if d > 2 * DIAS_CICLO:
            avisos.append(f"Hueco de {d} días entre {fecha_legible(e1['fecha'])} "
                          f"y {fecha_legible(e2['fecha'])}.")
    versiones = sorted({e["version"] for e in escenas})
    if len(versiones) > 1:
        avisos.append(f"Hay {len(versiones)} versiones de procesamiento ({', '.join(versiones)}): "
                      "no se comparan entre sí.")

    # imágenes por fecha y estadísticas de agua por escena
    for e in escenas:
        for pol in ("HV", "HH"):
            png = IMAGENES / f"{pol.lower()}_{e['fecha']}.png"
            if not png.exists():
                vmin, vmax = RANGO_PNG[pol]
                plt.imsave(png, cargar(e["fecha"], pol), cmap="gray", vmin=vmin, vmax=vmax)
        hv = cargar(e["fecha"], "HV")
        validos = ~np.isnan(hv)
        agua = (hv < UMBRAL_DB) & validos
        e["agua_ha"] = round(float(agua.sum() * ha), 1)
        e["agua_pct"] = round(100 * float(agua.sum()) / max(int(validos.sum()), 1), 1)

    # referencia: pares consecutivos de 12 días con la misma versión
    referencias = []
    for e1, e2 in zip(escenas, escenas[1:]):
        if dias_entre(e1["fecha"], e2["fecha"]) == DIAS_CICLO and e1["version"] == e2["version"]:
            referencias.append(cambio_agua(e1["fecha"], e2["fecha"], ha))
    ref = None
    if referencias:
        brutos = [r["bruto_ha"] for r in referencias]
        ref = {"n": len(brutos), "min": min(brutos), "mediana": float(np.median(brutos)),
               "max": max(brutos)}

    # comparaciones: primera contra última escena de cada versión, más las extra
    pares = []
    por_version = {}
    for e in escenas:
        por_version.setdefault(e["version"], []).append(e)
    for lista in por_version.values():
        if len(lista) >= 2:
            pares.append((lista[0]["fecha"], lista[-1]["fecha"]))
    pares += [tuple(p) for p in PARES_EXTRA]

    fechas = {e["fecha"]: e for e in escenas}
    comparaciones = []
    for fa, fb in pares:
        if fa not in fechas or fb not in fechas:
            avisos.append(f"Par {fa}-{fb}: falta alguna de las dos escenas.")
            continue
        if fechas[fa]["version"] != fechas[fb]["version"]:
            avisos.append(f"Par {fa}-{fb}: versiones de procesamiento distintas; "
                          "parte de la diferencia puede venir del procesador.")
        c = cambio_agua(fa, fb, ha, guardar_png=True)
        c["veces_referencia"] = (round(c["bruto_ha"] / ref["mediana"], 2)
                                 if ref and ref["mediana"] > 0 else None)
        comparaciones.append(c)

    # manglar: vegetación estable (nunca agua en ninguna fecha) y serie de tiempo
    veg = None
    for e in escenas:
        hv, hh = cargar(e["fecha"], "HV"), cargar(e["fecha"], "HH")
        ok = ~np.isnan(hv) & ~np.isnan(hh) & (hv >= UMBRAL_DB)
        veg = ok if veg is None else (veg & ok)
    veg_info = {"ha": round(float(veg.sum() * ha), 1),
                "pct_recorte": round(100 * float(veg.mean()), 1)}
    serie = []
    if veg.sum() > 0:
        for e in escenas:
            hv, hh = cargar(e["fecha"], "HV"), cargar(e["fecha"], "HH")
            serie.append({
                "fecha": e["fecha"], "version": e["version"],
                "hv_mediana_db": round(float(np.median(hv[veg])), 2),
                "hh_menos_hv_mediana_db": round(float(np.median((hh - hv)[veg])), 2),
            })
    else:
        avisos.append("No quedan píxeles de vegetación estable; no se calcula la serie del manglar.")

    # informe en texto
    informe = {"agua": [], "manglar": [], "avisos": avisos}
    for c in comparaciones:
        informe["agua"].append(redactar_agua(c, ref, ha))
    for v in versiones:
        t = redactar_manglar(serie, veg_info, v)
        if t:
            informe["manglar"].append(t)

    resultados = {
        "generado": datetime.now().isoformat(timespec="seconds"),
        "configuracion": {
            "umbral_db": UMBRAL_DB, "min_pix": MIN_PIX, "factor": FACTOR, "pixel_m": pixel_m,
            "ha_por_pixel": ha, "zona_lonlat": [LON_MIN, LAT_MIN, LON_MAX, LAT_MAX],
            "limites_leaflet": escenas[0]["limites_leaflet"],
        },
        "escenas": escenas,
        "vegetacion_estable": veg_info,
        "serie_manglar": serie,
        "referencia_12_dias": {"resumen": ref, "pares": referencias},
        "comparaciones": comparaciones,
        "informe": informe,
    }
    (SALIDA / "resultados.json").write_text(json.dumps(resultados, indent=2, ensure_ascii=False))

    md = ["# Informe automático", "", "## Agua abierta", ""]
    md += [f"- {t}" for t in informe["agua"]] or ["- Se necesitan al menos dos escenas con el mismo procesamiento."]
    md += ["", "## Manglar (vegetación estable)", ""]
    md += [f"- {t}" for t in informe["manglar"]] or ["- Se necesitan al menos dos escenas con el mismo procesamiento."]
    md += ["", "## Avisos", ""] + ([f"- {a}" for a in avisos] or ["- Ninguno."])
    (SALIDA / "informe.md").write_text("\n".join(md), encoding="utf-8")

    print(f"\nEscenas procesadas: {len(escenas)} ({nuevas} nuevas en esta corrida)")
    print(f"Tamaño de píxel: {pixel_m} m  ->  {ha} ha por píxel")
    print(f"Vegetación estable: {veg_info['ha']} ha ({veg_info['pct_recorte']} % del recorte)")
    print(f"Pares de referencia de 12 días: {len(referencias)}", ref or "")
    for c in comparaciones:
        print(f"Comparación {c['fecha_a']} -> {c['fecha_b']}: bruto {c['bruto_ha']} ha, neto {c['neto_ha']} ha")
    for a in avisos:
        print("AVISO:", a)
    print("\nListo. Revisa salida/resultados.json y salida/informe.md")


if __name__ == "__main__":
    main()