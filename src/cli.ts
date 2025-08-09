import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import { load as loadCheerio } from "cheerio";
// Simple concurrency limiter to avoid ESM-only deps
function createLimiter(concurrency: number) {
  let active = 0;
  const queue: { fn: () => Promise<void>; resolve: () => void; reject: (e: any) => void }[] = [];
  const tryRun = () => {
    if (active >= concurrency) return;
    const item = queue.shift();
    if (!item) return;
    active++;
    item
      .fn()
      .then(() => {
        active--;
        item.resolve();
        tryRun();
      })
      .catch((e) => {
        active--;
        item.reject(e);
        tryRun();
      });
  };
  return (fn: () => Promise<void>) =>
    new Promise<void>((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      tryRun();
    });
}
import { decodeISO88591, normalizeWhitespace, toSearch, parseTimeToMinutes, dayNameToNum, extractSedeFromAulaCode, buildSectionId } from "./utils";
import { Catedra, Materia, Meet, ProgramCode, Section, SectionRequirement } from "./types";
import { SEDES } from "./sedes";

const BASE = "http://academica.psi.uba.ar";

const PROGRAMS: { code: ProgramCode; name: string; tabId: string }[] = [
  { code: "PS", name: "Licenciatura en Psicología", tabId: "#PS" },
  { code: "PR", name: "Profesorado en Psicología", tabId: "#PR" },
  { code: "LM", name: "Licenciatura en Musicoterapia", tabId: "#LM" },
  { code: "TE", name: "Licenciatura en Terapia Ocupacional", tabId: "#TE" },
];

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

async function fetchISO(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return decodeISO88591(buf);
}

function parseListPage(html: string) {
  const $ = loadCheerio(html);
  const results: {
    program: ProgramCode;
    programName: string;
    entries: { catedraId: number; materiaCode: number; materiaName: string; chairLabel: string; docente: string }[];
  }[] = [];

  for (const p of PROGRAMS) {
    const tab = $(p.tabId);
    if (tab.length === 0) continue;
    const entries: any[] = [];
    tab.find("table tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (tds.length < 4) return;
      const catText = normalizeWhitespace($(tds[0]).text());
      const catedraId = parseInt(catText, 10);
      const materiaName = normalizeWhitespace($(tds[1]).text());
      const docenteRaw = normalizeWhitespace($(tds[2]).text()).replace(/^[-–]\s*/, "");
      // Labels appear as: "I - Prof. ..." or "A - Prof. ...". Require the hyphen to avoid matching prefixes like "Prof." or "Dr."
      const chairLabelMatch = docenteRaw.match(/^((?:[IVXLCDM]+|[A-Z]))\s*-\s*/);
      const chairLabel = chairLabelMatch ? normalizeWhitespace(chairLabelMatch[1]) : "";
      const docente = docenteRaw
        .replace(/^((?:[IVXLCDM]+|[A-Z]))\s*-\s*/, "")
        .replace(/<br\s*\/?>/gi, "")
        .trim();

      // Try extract materia code from detail link if present in href
      // Fallback: not available on list; will be filled from detail page
      const materiaCode = NaN;

      if (!Number.isFinite(catedraId)) return;
      entries.push({ catedraId, materiaCode, materiaName, chairLabel, docente });
    });
    results.push({ program: p.code, programName: p.name, entries });
  }
  return results;
}

function parseOblig(oblig: string): SectionRequirement[] {
  if (!oblig) return [];
  const parts = oblig.split(/\s*-\s*/).map((s) => s.trim()).filter(Boolean);
  return parts.map<SectionRequirement>((label) => {
    // Heuristic: letters like A..Z -> Sem, roman numerals -> Teo
    const isRoman = /^[IVXLCDM]+$/i.test(label);
    return { tipo: isRoman ? "Teo" : "Sem", label };
  });
}

function parseDetailPage(html: string) {
  const $ = loadCheerio(html);
  const header = $("td.option1").first().text();
  // Example header contains: "Materia ( 1 - Historia de la Psicología )"
  const materiaMatch = header.match(/Materia\s*\(\s*(\d+)\s*-\s*([^\)]+)\)/i);
  const materiaCode = materiaMatch ? parseInt(materiaMatch[1], 10) : NaN;
  const materiaName = materiaMatch ? normalizeWhitespace(materiaMatch[2]) : "";

  const tables = $("table.table_tabs");
  const parseRows = (tableIdx: number, tipo: "Teo" | "Sem" | "Prac") => {
    const rows: any[] = [];
    const table = tables.eq(tableIdx);
    table.find("tr").each((i, tr) => {
      if (i === 0) return; // header
      const tds = $(tr).find("td");
      if (!tds || tds.length === 0) return;
      // Some tables may be empty
      if (tds.length < 10 && tipo !== "Sem") return;

      const label = normalizeWhitespace($(tds[0]).text()).replace(/^\u00A0/, "");
      const dayName = normalizeWhitespace($(tds[1]).text()).toLowerCase();
      const start = normalizeWhitespace($(tds[2]).text()).replace(/^\u00A0/, "");
      const end = normalizeWhitespace($(tds[3]).text()).replace(/^\u00A0/, "");
      const typeCell = normalizeWhitespace($(tds[4]).text());
      const docente = normalizeWhitespace($(tds[5]).text()).replace(/\s+<br\s*\/?>/gi, " ");
      const vacRaw = normalizeWhitespace($(tds[6]).text());
      const vacantes = vacRaw ? parseInt(vacRaw, 10) : null;
      const obligRaw = normalizeWhitespace($(tds[7]).text());
      const aulaText = normalizeWhitespace($(tds[8]).text());
      const observ = normalizeWhitespace($(tds[9]).text());
      const aulaCode = aulaText || "";
      const sedeCode = extractSedeFromAulaCode(aulaCode);

      rows.push({ tipo, label, dayName, start, end, docente, vacantes, oblig: obligRaw || null, aulaCode, sedeCode, observ: observ || null });
    });
    return rows;
  };

  // Tables: [Teóricos], [Seminarios?], [Comisiones]
  // Some detail pages have only Teóricos and Comisiones
  const teos = parseRows(0, "Teo");
  // Detect if there is a Sem table: look for header th contains "Seminarios"
  let hasSem = false;
  $("th").each((_, th) => {
    const t = normalizeWhitespace($(th).text()).toLowerCase();
    if (t.includes("seminarios")) hasSem = true;
  });
  const sems = hasSem ? parseRows(1, "Sem") : [];
  const pracTableIdx = hasSem ? 2 : 1;
  const pracs = parseRows(pracTableIdx, "Prac");

  return { materiaCode, materiaName, teos, sems, pracs };
}

async function run(termId: string) {
  const outDir = path.resolve(process.cwd(), termId);
  ensureDir(outDir);
  ensureDir(path.join(outDir, "indexes"));

  // Save sedes
  fs.writeFileSync(path.join(outDir, "sedes.json"), JSON.stringify(SEDES, null, 2), "utf8");

  // Fetch list page
  const listHtml = await fetchISO(`${BASE}/Psi/Ope154_.php`);
  const programs = parseListPage(listHtml);

  // Build maps and placeholders
  const materiasMap = new Map<string, Materia>();
  const catedras: Catedra[] = [];
  const sections: Section[] = [];
  const meets: Meet[] = [];

  const now = Date.now();
  const byProgram: Record<string, string[]> = {};
  const byCatedra: Record<string, string[]> = {};
  const byMateria: Record<string, string[]> = {};
  const byDaySede: Record<string, string[]> = {};
  const bySectionId: Record<string, string[]> = {};

  const limit = createLimiter(4);
  const tasks: Promise<void>[] = [];

  for (const pg of programs) {
    byProgram[pg.program] = [];
    for (const entry of pg.entries) {
      const catedraId = entry.catedraId;
      tasks.push(limit(async () => {
        const detailUrl = `${BASE}/Psi/Ver154_.php?catedra=${catedraId}`;
        const html = await fetchISO(detailUrl);
        const { materiaCode, materiaName, teos, sems, pracs } = parseDetailPage(html);

        const materiaId = `${pg.program}-${String(materiaCode).padStart(4, "0")}`;
        if (!materiasMap.has(materiaId)) {
          materiasMap.set(materiaId, {
            id: materiaId,
            program: pg.program,
            programName: pg.programName,
            materiaCode,
            materiaName,
            searchName: toSearch(materiaName),
          });
        }

        const catedraKey = `${pg.program}-${catedraId}`;
        catedras.push({
          id: catedraKey,
          program: pg.program,
          programName: pg.programName,
          catedraId,
          chairLabel: entry.chairLabel || "",
          docenteTitular: entry.docente,
          materiaId,
          materiaCode,
          materiaName,
        });

        // Helper to create section + meets
        const upsert = (rows: any[], tipo: "Teo" | "Sem" | "Prac") => {
          // Group by section label
          const byLabel = new Map<string, any[]>();
          for (const r of rows) {
            const arr = byLabel.get(r.label) || [];
            arr.push(r);
            byLabel.set(r.label, arr);
          }
          for (const [label, items] of byLabel.entries()) {
            const docentes = Array.from(new Set(items.map((i) => i.docente).filter(Boolean)));
            const sedes = Array.from(new Set(items.map((i) => i.sedeCode).filter(Boolean)));
            const aulas = Array.from(new Set(items.map((i) => i.aulaCode).filter(Boolean)));
            const vacantes = items.find((i) => Number.isFinite(i.vacantes))?.vacantes ?? null;
            const obligRaw = tipo === "Prac" ? (items.find((i) => i.oblig)?.oblig ?? null) : null;
            const requires = tipo === "Prac" ? parseOblig(obligRaw || "") : [];

            const sectionId = buildSectionId(termId, pg.program, catedraId, tipo, label);
            const section: Section = {
              id: sectionId,
              termId,
              program: pg.program,
              programName: pg.programName,
              catedraId,
              materiaId,
              materiaCode,
              materiaName,
              tipo,
              sectionLabel: label,
              docentes,
              vacantes,
              oblig: obligRaw,
              requires,
              sedes,
              aulas,
              meetsCount: items.length,
              updatedAt: now,
            };
            sections.push(section);
            byProgram[pg.program].push(sectionId);
            const catIndexKey = `${pg.program}-${catedraId}`;
            (byCatedra[catIndexKey] ||= []).push(sectionId);
            (byMateria[materiaId] ||= []).push(sectionId);

            let meetSeq = 0;
            for (const it of items) {
              const meetId = `${sectionId}_${++meetSeq}`;
              const startMin = parseTimeToMinutes(it.start || "00:00");
              const endMin = parseTimeToMinutes(it.end || "00:00");
              const meet: Meet = {
                id: meetId,
                sectionId,
                termId,
                program: pg.program,
                catedraId,
                tipo,
                sectionLabel: label,
                dayName: it.dayName,
                dayNum: dayNameToNum(it.dayName),
                start: it.start,
                end: it.end,
                startMin,
                endMin,
                aulaCode: it.aulaCode,
                sedeCode: it.sedeCode,
                observ: it.observ,
              };
              meets.push(meet);
              (bySectionId[sectionId] ||= []).push(meetId);
              (byDaySede[`${it.dayName}|${it.sedeCode}`] ||= []).push(meetId);
            }
          }
        };

        upsert(teos, "Teo");
        upsert(sems, "Sem");
        upsert(pracs, "Prac");
      }));
    }
  }

  await Promise.all(tasks);

  // Output
  const materias = Array.from(materiasMap.values()).sort((a, b) => a.materiaName.localeCompare(b.materiaName));
  sections.sort((a, b) => a.id.localeCompare(b.id));
  meets.sort((a, b) => a.dayNum - b.dayNum || a.startMin - b.startMin || a.id.localeCompare(b.id));

  fs.writeFileSync(path.join(outDir, "materias.json"), JSON.stringify(materias, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "catedras.json"), JSON.stringify(catedras, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "sections.json"), JSON.stringify(sections, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "meets.json"), JSON.stringify(meets, null, 2), "utf8");

  fs.writeFileSync(path.join(outDir, "indexes", "byProgram.json"), JSON.stringify(byProgram, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "indexes", "byCatedra.json"), JSON.stringify(byCatedra, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "indexes", "byMateria.json"), JSON.stringify(byMateria, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "indexes", "byDaySede.json"), JSON.stringify(byDaySede, null, 2), "utf8");
  fs.writeFileSync(path.join(outDir, "indexes", "bySectionId.json"), JSON.stringify(bySectionId, null, 2), "utf8");

  console.log(`Done. Wrote ${sections.length} sections and ${meets.length} meets.`);
}

function parseArgs() {
  const termIdx = process.argv.indexOf("--term");
  const termId = termIdx !== -1 ? process.argv[termIdx + 1] : "2025-2";
  return { termId };
}

if (require.main === module) {
  const { termId } = parseArgs();
  run(termId).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}


