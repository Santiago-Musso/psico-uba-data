# psico-uba-data

Repositorio de datos estáticos para el [PsicoUBA](https://github.com/santiago-musso/psico-uba) planificador de cursada. Scrapea el portal académico de la Facultad de Psicología (UBA), normaliza los datos y los publica en GitHub Pages como archivos JSON estáticos.

**Data URL:** `https://santiago-musso.github.io/psico-uba-data`

## Stack

- Node.js 20+, TypeScript 5, ts-node
- cheerio (HTML parsing), node-fetch 2, iconv-lite (charset ISO-8859-1 del portal UBA)

## Estructura del repo

```
src/
├── cli.ts        # Scraper principal y generador de JSON
├── types.ts      # Tipos compartidos (Term, Materia, Catedra, Section, Meet, Sede)
├── utils.ts      # Funciones auxiliares (parsing de días, horarios, aulas)
└── sedes.ts      # Constantes de sedes (HY, IN, SI, AV, EC)

2025-2/           # Datos del cuatrimestre 2025-2 (publicados en Pages)
├── materias.json
├── catedras.json
├── sections.json
├── meets.json
├── sedes.json
└── indexes/
    ├── byProgram.json
    ├── byCatedra.json
    ├── byMateria.json
    ├── byDaySede.json
    └── bySectionId.json

.github/workflows/deploy.yml   # Publica term folders a GitHub Pages en cada push a main
```

## Uso

```bash
npm ci

# Scrapear y generar datos para un cuatrimestre
npm run fetch:2025-2
```

El CLI genera los JSON en el directorio del cuatrimestre (e.g., `2025-2/`). Commitear y pushear a `main` los publica automáticamente.

## Deploy a GitHub Pages

El workflow `.github/workflows/deploy.yml` corre en cada push a `main` y publica todos los directorios con formato de cuatrimestre (e.g., `2025-2/`) a GitHub Pages.

**Habilitar Pages (una sola vez):**
1. GitHub → Settings → Pages
2. Source: "GitHub Actions"

**URLs de ejemplo:**
- `https://santiago-musso.github.io/psico-uba-data/2025-2/sections.json`
- `https://santiago-musso.github.io/psico-uba-data/2025-2/indexes/byMateria.json`

## Agregar un nuevo cuatrimestre

```bash
npm run fetch:2026-1   # scrapea y genera 2026-1/
git add 2026-1/
git commit -m "add 2026-1 data"
git push
```

El workflow se encarga del deploy. En el frontend, actualizar `TERM` en `psico-uba/src/app/schedule/page.tsx`.

## Programas soportados

| Código | Nombre |
|--------|--------|
| PS | Licenciatura en Psicología |
| PR | Profesorado en Psicología |
| LM | Licenciatura en Musicoterapia |
| TE | Licenciatura en Terapia Ocupacional |

## Sedes

| Código | Nombre |
|--------|--------|
| HY | Hipólito Yrigoyen |
| IN | Independencia |
| SI | Sin sede / Virtual |
| AV | Av. de Mayo |
| EC | Echeverría |

## Entidades principales

- **Materia** — Asignatura (programa, código, nombre)
- **Catedra** — Cátedra/comisión (titular, materia)
- **Section** — Sección de cursada: Teórico (`Teo`), Seminario (`Sem`), Práctico (`Prac`)
- **Meet** — Encuentro individual (día 1–7, horario, aula, sede)
- **Sede** — Campus físico

## Notas

- Los días van de `1` (lunes) a `7` (domingo). El campo `dayName` usa el texto del portal (e.g., `"miercoles"`, `"domingo"`).
- La lógica de `requires` (qué Teo/Sem requiere cada Prac) se parsea del campo `oblig` del portal.
- El campo `chairLabel` (`I`, `II`, etc.) solo se extrae cuando el portal lo formatea explícitamente como `LABEL - ...`.
