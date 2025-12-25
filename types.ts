
export interface WindingStats {
  ratedTurns: number | null;
  maxTurns: number | null;
  minTurns: number | null;
  type: string | null;
  discVal: number | null;
  lyrsVal: number | string | null;
  ksCircle: number | null;
  ksWidth: number | null;
  ksThk: string | null; // Added
  id: number | null;
  od: number | null;
  meanTurn: number | null;
  lineVoltage: string | number | null; // Added for Short Circuit table
  coilVoltage: string | number | null; // Coil Voltage (phase voltage)
  lossStr: string | null;
  totalLoss: number | null;
  paperInsul: string | number | null;
  bareThk: string | number | null;
  bareWidth: string | number | null;
  radial: string | number | null;
  i2r: string | number | null;
  wattsOA: string | number | null;
  wattsMax: string | number | null;
  gradOA: string | number | null;
  gradMax: string | number | null;
  sGradOA: string | number | null;
  sGradMax: string | number | null;
  pullsW: string | number | null;
  pullsH: string | number | null;
  strands: string | number | null;
  parallelGroups: string | number | null;
  ratedAmps: string | number | null;
  wireSpaceMech: string | number | null;
}

export interface TubeRow {
  material: string;
  thk: string;
  qty: string;
}

export interface TubeTable {
  title: string;
  rows: TubeRow[];
}

export interface CoreRow {
  col1: string;
  col2: string;
  col3: string;
  col4: string;
  isTotal?: boolean;
  isDuct?: boolean;
}

export interface CoreStats {
  weight: string | null;
  fluxDen: string | null;
  feCircle: string | null;
  windowHt: string | null;
  windowWidth: string | null;
  legCenter: string | null;
  coreLength: string | null;
  coreHt: string | null;
  lamWidth: string | null;
  coreGrad: string | null; // Added
}

export interface TankStats {
  clearanceRight: string | null;
  clearanceLeft: string | null;
  clearanceFront: string | null;
  clearanceBack: string | null;
  width: string | null;
  depth: string | null;
  height: string | null;
}

export interface ExtractedData {
  wdg1: WindingStats;
  wdg2: WindingStats;
  wdg3: WindingStats;
  tubeTables: TubeTable[];
  coreTable: CoreRow[];
  core: CoreStats;
  tank: TankStats;
  mva: string | null;
  maxMva: string | null;
  allKvaValues?: number[]; // Array of all kVA values extracted from PDF (e.g., [12000, 18000, 20000])
  voltsPerTurn: string | null; // Added
  impedance: { percentZ: string | null };
  brackets: { wdgSpace: number | null; top: number | null; bottom: number | null };
  keepBack: number | null;
  nllExp: string | null;
  debugLog?: string[];
  designElecHt?: number[]; // Design Electrical Height values from PDF (e.g., [40.012, 41.958, 41.981])
  addKSColGrp?: number; // Add #OfKS/Col/Grp value from PDF (deprecated, use addKSPerWinding)
  addKSPerWinding?: Record<number, number>; // Add #OfKS/Col/Grp per winding index (0-based: inner windings and outmost)
  [key: string]: any;
}

export interface PdfTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ProcessedRow {
  y: number;
  items: PdfTextItem[];
  textLine: string;
  lowerLine: string;
}

// State interface for FLD12 (Page 4) persistence
export interface DiscDistributionState {
  numGroups: 1 | 2;
  numSections: number;
  tapDiscs: 4 | 8;
  splitTapMode: boolean; // Enable split tap (2 tap zones in single group)
  numGroupsManuallySet: boolean;
  discOverrides: Record<number, number>;
  topDropOverride: number | null;
  disabledDropIndices: number[];
  // New Calculation Table State
  kvaTable: number[];
  hvVolts: number;
  lvVolts: number;
  tapPercent: number;
  lvTurns: number;
  vtWindingIndex: number; // Index of winding to use for V/T calculation (0-based)
  targetTurnsDifference: number | null; // Target difference in turns between taps (e.g., 24, 25)
  turnsParity: null | 'even' | 'odd'; // Enforce all turns to be even or odd (null = disabled)
  outermostDiscs: number | null; // Manual override for outermost winding disc count (null = use from PDF)
  atConductorWidth: Record<number, number>; // Conductor width from AT table per winding index (for HT calc): {0: 0.413, 1: 0.413, 2: 0.613}
  // HT Calculation State
  extraKSPerSegment: Record<number, number>; // Extra KS per segment index (for outmost winding segments)
  lockedKSSegments: number[]; // Segment IDs that are manually locked (won't auto-adjust)
  extraKSPerSegmentPerWinding: Record<number, Record<number, number>>; // Extra KS per segment per winding: {windingIndex: {segmentId: value}}
  /* Corrected type from literal 0 to number */
  totalAddKSColGrp: number; // Total Add #OfKS/Col/Grp from design (deprecated, use extraKSPerWinding)
  extraKSPerWinding: Record<number, number>; // Extra KS per winding index (0-based: inner windings and outmost)
  designElecHt: number[]; // Design Electrical Height values [40.012, 41.958, 41.981]
}

// State interface for 2.0 (Page 5) persistence
export interface Page5State {
  inputText: string;
  // Tracks original indices deleted from the Primary rows (R1/R2) - causes upshift
  deletedPrimaryIndices: Record<string, number[]>;
  // Tracks specific excluded cells in Secondary rows (R3/R4). Format: "tableId-rowIndex-colIndex"
  excludedCells: string[];
  // Stores the index of the winding selected for Column 1 reference
  col1WindingIndex: number | null;
  // Selected Arrangement Table Type
  selectedTableType: 'autotransformer';
}

export interface StackItem {
  id: string;
  name: string;
  thk: number;
  length: string;
  calculatedH?: number; // Added
  qty: string;
  type: 'core' | 'insulation' | 'winding';
  isTube: boolean;
  roundingMode?: 'M' | 'F' | 'C' | null;
}

export interface WindingAccessoryData {
  // KS Data
  vtcPart: string;
  ksQty: string;
  extraKS: number;
  // Angle Sector
  asItemIndex: number;
  asT: number;
  asH: number;
  asR: number;
  asS: number;
  asBAdjust: number;
  asVtcPart: string;
  // Angle Cap
  acItemIndex: number;
  acT: number;
  acH: number;
  acR: number;
  acS: number;
  acBAdjust: number;
  acVtcPart: string;
}

export interface HeadSheetData {
  vtcPart: string;
  qty: number;
  t: number;
  d: number;
}

export interface Page6State {
  isInitialized: boolean;
  baseOD: number;
  items: StackItem[];
  selectedVendor: 'ENPAY' | 'WEIDMAN';
  washerWindingIndex: number; // Currently selected winding for UI view
  calculationMethod: 'mround' | 'ceiling';
  tubeTolerance: number; // Added

  // Per-Winding Configurations
  windingAccessories: Record<number, WindingAccessoryData>;

  // ID Seal
  idSealState: Record<string, { qtyOpt: 3 | 5 | 7, t: number, c: number, vtcPart: string }>;
  idSealRounding: { id: 'C' | 'F' | 'M', od: 'C' | 'F' | 'M' };
  // OD Seal
  odSealState: Record<string, { t: number, c: number, vtcPart: string }>;
  odSealRounding: { id: 'C' | 'F' | 'M', od: 'C' | 'F' | 'M' };

  // Top & Bottom Head Sheet
  headSheet: HeadSheetData;
}

export interface Page7State {
  isInitialized: boolean;
  // Core Inputs
  r1: number; // LV Width
  r2: number; // Gap
  r3: number; // HV Width
  vt: number; // Volts/Turn
  height: number; // Electrical Height
  mva: number; // MVA (converted to kVA for formula)

  // Calibration Params
  meanTurnLvRef: number;
  r1Ref: number;
  calibConst: number;
}

export interface Page8State {
  nomMva: number;
  oaMax: number;
  maxMva: number;
  nll: number;
  strayPct: number;
  // Nominal Tap
  lvLoss1: number; // New editable LV1
  lvLoss: number;  // LV2 (Main)
  hvLoss: number;
  // Min Tap
  lvLoss1Min: number; // New editable LV1 Min
  lvLossMin: number;
  hvLossMin: number;

  // Adders
  addLl: number;
  addNll: number;

  // Configs for Formula
  user1: number;
  user2: number;

  // New LV Calc
  useLvMinCalc: boolean;
  lvMaxCurrent: number;
  lvNomCurrent: number;
}

// Extend Window for PDF.js
declare global {
  interface Window {
    pdfjsLib: any;
  }
}
