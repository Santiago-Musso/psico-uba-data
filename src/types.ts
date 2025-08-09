export type ProgramCode = "PS" | "PR" | "LM" | "TE";

export interface Term {
  id: string; // e.g., "2025-2"
  name: string; // e.g., "2025 / 2"
  updatedAt: number;
}

export interface Sede {
  id: string; // HY, IN, SI, AV, EC
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface Materia {
  id: string; // e.g., PS-0001
  program: ProgramCode;
  programName: string; // full display name
  materiaCode: number;
  materiaName: string;
  searchName: string;
}

export interface Catedra {
  id: string; // e.g., PS-34
  program: ProgramCode;
  programName: string;
  catedraId: number;
  chairLabel: string; // I | II | ...
  docenteTitular: string;
  materiaId: string;
  materiaCode: number;
  materiaName: string;
}

export interface SectionRequirement {
  tipo: "Teo" | "Sem";
  label: string; // e.g., "IV" or "H"
}

export interface Section {
  id: string; // {term}_{program}_{catedraId}_{tipo}_{sectionLabel}
  termId: string;
  program: ProgramCode;
  programName: string;
  catedraId: number;
  materiaId: string;
  materiaCode: number;
  materiaName: string;
  tipo: "Teo" | "Sem" | "Prac";
  sectionLabel: string; // I | II | A | 1 | ...
  docentes: string[];
  vacantes: number | null;
  oblig: string | null; // raw text from site
  requires: SectionRequirement[]; // parsed from oblig
  sedes: string[]; // e.g., ["HY"]
  aulas: string[]; // e.g., ["HY-014"]
  meetsCount: number;
  updatedAt: number;
}

export interface Meet {
  id: string; // {sectionId}_{n}
  sectionId: string;
  termId: string;
  program: ProgramCode;
  catedraId: number;
  tipo: "Teo" | "Sem" | "Prac";
  sectionLabel: string;
  dayName: string; // lunes..sabado (as on site)
  dayNum: number; // 1..6
  start: string; // HH:MM
  end: string; // HH:MM
  startMin: number;
  endMin: number;
  aulaCode: string; // e.g., HY-014
  sedeCode: string; // HY
  observ: string | null;
}

export interface IndexByProgram {
  [program: string]: string[]; // sectionIds
}

export interface IndexByCatedra {
  [catedraKey: string]: string[]; // sectionIds
}

export interface IndexByMateria {
  [materiaId: string]: string[]; // sectionIds
}

export interface IndexByDaySede {
  [daySede: string]: string[]; // meetIds (e.g., "sabado|SI")
}

export interface IndexBySectionId {
  [sectionId: string]: string[]; // meetIds
}

export interface DataBundle {
  termId: string;
  programs: { code: ProgramCode; name: string }[];
  sedes: Sede[];
  materias: Materia[];
  catedras: Catedra[];
  sections: Section[];
  meets: Meet[];
}


