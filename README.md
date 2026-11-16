# Análisis NISAR de la Ciénaga Grande de Santa Marta

Proyecto para procesar escenas de radar satelital NISAR GSLC, estimar cambios en agua abierta en la Ciénaga Grande de Santa Marta y publicar los resultados mediante una API local. La API puede solicitar a Gemini una explicación en lenguaje sencillo; si esa llamada falla, entrega el informe calculado por el pipeline.

> **Interpretación:** el análisis mide agua abierta a partir de la señal de radar. No determina por sí solo pérdida o ganancia de manglar, no mide el agua bajo las copas y no identifica la causa de los cambios.

## Contenido

- [Qué hace](#qué-hace)
- [Estructura](#estructura)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configurar Gemini](#configurar-gemini)
- [Ejecutar el análisis](#ejecutar-el-análisis)
- [Iniciar la API](#iniciar-la-api)
- [Endpoints](#endpoints)
- [Archivos generados](#archivos-generados)
- [Método y criterios](#método-y-criterios)
- [Limitaciones](#limitaciones)
- [Solución de problemas](#solución-de-problemas)
- [Seguridad](#seguridad)

## Qué hace

1. Lee escenas `.h5` de NISAR en formato GSLC desde `escenas/`.
2. Recorta una zona definida por coordenadas alrededor de la Ciénaga Grande.
3. Procesa las polarizaciones HH y HV, calcula estadísticas de agua y genera imágenes.
4. Escribe resultados en JSON y un informe en Markdown dentro de `salida/`.
5. Expone los resultados mediante un servidor Express.
6. Opcionalmente, envía los datos resumidos a Gemini para generar una explicación en español.

El análisis científico se ejecuta en Python. El servidor y la integración con Gemini se ejecutan en Node.js.

## Estructura

```text
.
├── escenas/                 Escenas NISAR GSLC de entrada (.h5)
├── salida/
│   ├── datos/               Arreglos NumPy procesados (.npy)
│   ├── imagenes/            PNG HH, HV y mapas de cambio
│   ├── catalogo.json        Metadatos de escenas procesadas
│   ├── resultados.json      Datos que consume la API
│   └── informe.md           Informe automático basado en los resultados
├── nombre.py                Pipeline de análisis en Python
├── server.js                Servidor HTTP Express
├── explicacion.js           Integración con Gemini y caché de explicaciones
├── package.json             Dependencias de Node.js
├── package-lock.json        Versiones bloqueadas de Node.js
└── .env                     Configuración local; no debe compartirse
```

El pipeline está guardado actualmente como `nombre.py`. Aunque su comentario inicial menciona `pipeline.py`, el comando correcto para este proyecto es `python nombre.py`.

El servidor también configura `public/` como carpeta de archivos estáticos y `salida/imagenes/` como `/imagenes`. En el estado actual del proyecto no hay un `public/index.html`; por eso, abrir `/` puede mostrar `Cannot GET /`. Las rutas de la API descritas abajo sí son las interfaces disponibles.

## Requisitos

- Python 3 y `pip`.
- Node.js **22 o posterior** y npm. La versión instalada de `@google/genai` requiere Node.js 22+.
- Una clave de Gemini para generar explicaciones automáticas.
- Escenas NISAR GSLC `.h5` compatibles en `escenas/`.
- Espacio en disco para las escenas originales, arreglos `.npy` e imágenes generadas.

### Dependencias de Python

El repositorio no incluye actualmente un `requirements.txt`. El pipeline importa:

- `h5py`
- `matplotlib`
- `numpy`
- `pyproj`
- `scipy`

### Dependencias de Node.js

Se instalan desde `package-lock.json` con `npm ci`:

- `@google/genai`
- `dotenv`
- `express`

## Instalación

Los siguientes comandos están escritos para PowerShell en Windows y se ejecutan desde la carpeta del proyecto.

### Preparar Python

```powershell
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install h5py matplotlib numpy pyproj scipy
```

Si ya activaste el entorno virtual, también puedes usar `python` en lugar de `.\.venv\Scripts\python.exe`.

### Preparar Node.js

```powershell
npm ci
```

## Configurar Gemini

El servidor carga las variables de entorno desde `.env` al iniciar. Crea ese archivo en la raíz del proyecto y agrega tu clave:

```dotenv
GEMINI_API_KEY=PEGA_AQUI_TU_CLAVE
```

No escribas comillas alrededor de la clave. Para usar otro modelo, puedes definir también:

```dotenv
GEMINI_MODEL=ID_DEL_MODELO_DISPONIBLE
```

Si `GEMINI_MODEL` no está definido, `explicacion.js` usa `gemini-3.5-flash` como valor predeterminado. Si Gemini responde que ese modelo no está disponible para tu cuenta, configura un identificador de modelo que sí esté habilitado en tu API de Gemini.

La clave debe obtenerse desde Google AI Studio. No la pongas en archivos JavaScript, HTML, comandos que vayas a guardar, capturas de pantalla ni en el navegador. `.gitignore` excluye `.env` y otros archivos `.env.*`; conserva la excepción para `.env.example` si decides crear una plantilla sin credenciales.

## Ejecutar el análisis

Coloca las escenas `.h5` de NISAR GSLC en `escenas/`. Luego ejecuta:

```powershell
.\.venv\Scripts\python.exe .\nombre.py
```

El procesamiento puede tardar según el tamaño de las escenas y el equipo. Al finalizar, el script imprime un resumen y actualiza `salida/`.

El pipeline reutiliza los arreglos y los registros que ya existen para evitar procesar de nuevo las mismas fechas. Al agregar escenas nuevas, vuelve a ejecutar `nombre.py`. Si reemplazas un archivo por otro con la misma fecha, el pipeline puede reutilizar los datos existentes; revisa el catálogo y los arreglos de esa fecha antes de asumir que el reemplazo fue reprocesado.

## Iniciar la API

Inicia el servidor desde la raíz del proyecto para que `.env` y las rutas relativas de `salida/` se resuelvan correctamente:

```powershell
node .\server.js
```

El servidor escucha en `http://localhost:3000` de forma predeterminada. Puedes cambiar el puerto con la variable `PORT` en `.env`:

```dotenv
PORT=3001
```

Después de cambiar `.env`, detén el proceso anterior con `Ctrl+C` y vuelve a iniciar el servidor para que lea la nueva configuración.

La variable `SALIDA_DIR` permite cambiar el directorio desde el que el servidor lee resultados e imágenes. El pipeline Python escribe en la carpeta `salida/` junto a `nombre.py`; si cambias `SALIDA_DIR`, asegúrate de que apunte al mismo directorio de resultados.

## Endpoints

| Ruta | Método | Descripción |
|---|---|---|
| `/api/resultados` | GET | Devuelve `salida/resultados.json`. |
| `/api/explicacion` | GET | Devuelve la explicación de Gemini o el informe de respaldo. |
| `/imagenes/<archivo>` | GET | Sirve una imagen generada, por ejemplo `/imagenes/hv_20251029.png`. |

Prueba los endpoints en el navegador o desde PowerShell:

```powershell
Invoke-RestMethod http://localhost:3000/api/resultados
Invoke-RestMethod http://localhost:3000/api/explicacion
```

La explicación generada por Gemini tiene campos como `titulo`, `resumen`, `hallazgos`, `que_significa`, `que_no_sabemos` y `glosario`. Si Gemini falla, la API devuelve un objeto con `generado_por: "plantilla"` y el informe calculado por el pipeline.

## Archivos generados

- **`salida/resultados.json`**: configuración, escenas, área de agua estimada, comparaciones, referencia temporal de 12 días, vegetación estable, serie de señal y avisos.
- **`salida/informe.md`**: resumen legible de las comparaciones de agua, la señal de la vegetación estable y los avisos.
- **`salida/catalogo.json`**: metadatos de las escenas ya procesadas; permite reutilizar trabajo entre ejecuciones.
- **`salida/datos/`**: arreglos NumPy por fecha y polarización, por ejemplo `20251029_HV.npy`.
- **`salida/imagenes/`**:
  - `hv_<fecha>.png` y `hh_<fecha>.png`: imágenes de señal por polarización.
  - `cambio_<fecha_a>_<fecha_b>.png`: mapa de cambio de agua entre fechas. El rojo indica áreas que pasaron a agua; el azul, áreas que dejaron de clasificarse como agua.
- **`salida/explicacion.json`**: caché de la explicación de Gemini, asociada mediante una huella SHA-256 al contenido de `resultados.json`.

La caché de la explicación se invalida cuando cambian los resultados. Cambiar solo el modelo o el prompt no cambia esa huella; para solicitar una explicación nueva tras esos cambios, elimina únicamente `salida/explicacion.json` y vuelve a consultar `/api/explicacion`.

## Método y criterios

El pipeline actual aplica estos criterios, definidos en `nombre.py`:

- Zona geográfica delimitada por las coordenadas `-74.6231` a `-74.437` de longitud y `10.7316` a `10.9686` de latitud.
- Lectura de las polarizaciones HH y HV del grupo `frequencyA` de las escenas GSLC.
- Promedio de bloques de `4 x 4` píxeles para reducir el ruido granular.
- Conversión de potencia a decibelios.
- Clasificación de agua mediante un umbral de `-20.78 dB` en HV.
- Exclusión de parches de cambio menores de 25 píxeles; con los parámetros actuales, esto equivale a aproximadamente 1 ha.
- Referencia de cambios entre escenas consecutivas separadas por 12 días y con la misma versión de procesamiento.
- Comparaciones entre la primera y la última escena de cada versión de procesamiento.
- Cálculo de “vegetación estable” como píxeles que nunca se clasificaron como agua en ninguna fecha.

## Limitaciones

- Un cambio detectado representa un cambio en la clasificación de **agua abierta**, no una confirmación de cambio de manglar.
- La máscara de “vegetación estable” puede incluir coberturas distintas del manglar.
- El análisis no detecta agua bajo las copas de los árboles ni determina las causas de los cambios.
- Las diferencias entre versiones de procesamiento pueden no ser comparables; el pipeline las advierte y no debe interpretarse una comparación entre versiones como un cambio ambiental puro.
- Un intervalo más largo entre escenas admite más cambios que un intervalo de 12 días. Considera los días transcurridos y el número de pares de referencia disponibles.
- La calidad de la comparación depende de que las escenas tengan cobertura, dimensiones, alineación y parámetros compatibles.
- Los avisos que aparecen en `resultados.json` y `informe.md` son parte necesaria de la interpretación.

## Solución de problemas

### `Cannot GET /`

El servidor sirve archivos estáticos desde `public/`, pero no hay una página de inicio en esa carpeta en el estado actual. Usa directamente `/api/resultados` o `/api/explicacion`, o agrega una interfaz en `public/index.html`.

### La explicación indica que se usó la plantilla

El servidor utiliza el informe de respaldo si no puede cargar la clave, Gemini rechaza la petición, el modelo no está disponible o la respuesta no es JSON válido. Revisa la salida de la terminal del servidor y confirma que:

1. `.env` está en la raíz del proyecto y contiene `GEMINI_API_KEY`.
2. Reiniciaste `node server.js` después de cambiar `.env`.
3. La clave y el modelo están habilitados para Gemini API.
4. Hay conectividad y cuota disponibles.

### `/api/explicacion` indica que no hay resultados

Ejecuta `nombre.py` y confirma que exista `salida/resultados.json`. El mensaje de error del servidor todavía menciona `pipeline.py`; en este repositorio el archivo real del pipeline se llama `nombre.py`.

### No se procesa una escena

Comprueba que el archivo sea un producto NISAR GSLC `.h5`, conserve su nombre original y cubra la zona de estudio. Revisa los avisos de la terminal y de `salida/informe.md`; el pipeline omite escenas incompatibles o incompletas.

### `npm test` falla

El `package.json` contiene actualmente un script de prueba de marcador de posición; todavía no hay una suite de pruebas JavaScript configurada.

## Seguridad

- Mantén `GEMINI_API_KEY` únicamente en `.env` o en un gestor de secretos.
- No subas `.env` ni copies la clave a código del navegador; las llamadas a Gemini se hacen desde el servidor.
- No publiques escenas ni resultados si contienen información que no tengas autorización para compartir.
- Si una clave se expone accidentalmente, revócala y genera una nueva.


## Website update (v3)
- Menu: "Dances" is a dropdown (hover) with the five dances.
- Radar images are real NISAR scenes colored by `assets/scenes/` (generated from `salida/datos/*.npy`):
  `color/hv_*.jpg`, `color/hh_*.jpg`, `color/rgb_*.jpg` (composite) and `change/change_A_B.png` for every pair of dates in the same processing version.
  Pair numbers are stored in `data/results.json` → `pairs`.
- NISAR video: put the file at `assets/video/nisar.mp4`.
- Team photos: `assets/img/team/`. Gallery photos: `assets/photos/gallery/`.
