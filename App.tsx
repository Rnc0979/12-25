
import React, { useState, useEffect, useRef } from 'react';
import { FileText, Upload, AlertCircle, Table, Calculator, Plus, Minus, Zap, Layers, Copy, Check, Grid, Box, FileUp, Settings, FilePlus, X, Disc, Percent, BarChart3, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, List } from 'lucide-react';
import { ExtractedData, DiscDistributionState, Page5State, Page6State, Page7State, Page8State, WindingAccessoryData } from './types';
import { processPdfFile } from './services/pdfService';
import Page3 from './components/Page3';
import Page4 from './components/Page4';
import Page5 from './components/Page5';
import Page6 from './components/Page6';
import Page7 from './components/Page7';
import Page8 from './components/Page8';
import Page9 from './components/Page9';
import PageBOM from './components/PageBOM';
import ErrorBoundary from './components/ErrorBoundary';
import {
    calculateTurnsDrop, calculateBayDrop, getBayDropColor,
    calculateKSFactor, calculateIDSpaceFactor, getFactorColor,
    calculateODSpaceFactor
} from './utils/calculations';

const DEFAULT_DISC_DIST_STATE: DiscDistributionState = {
    numGroups: 1,
    numSections: 3,
    tapDiscs: 8,
    splitTapMode: false, // Split tap disabled by default
    numGroupsManuallySet: false,
    discOverrides: {},
    topDropOverride: null,
    disabledDropIndices: [],
    kvaTable: [15000, 16800, 20000, 22400, 25000, 28000],
    hvVolts: 67000,
    lvVolts: 7621.02,
    tapPercent: 2.5,
    lvTurns: 113,
    vtWindingIndex: 0, // Default: will be set based on winding count
    targetTurnsDifference: null, // No target difference initially
    turnsParity: null, // Turns parity enforcement (null = disabled, 'even' = all even, 'odd' = all odd)
    outermostDiscs: null, // Manual override for outermost winding disc count (null = use from PDF)
    atConductorWidth: {}, // Conductor width from AT table per winding index
    extraKSPerSegment: {}, // Extra KS per segment index (for outmost winding segments)
    lockedKSSegments: [], // Manually locked segments
    extraKSPerSegmentPerWinding: {}, // Extra KS per segment per winding: {windingIndex: {segmentId: value}}
    totalAddKSColGrp: 0, // Total Add #OfKS/Col/Grp from design (deprecated, use extraKSPerWinding)
    extraKSPerWinding: {}, // Extra KS per winding index (0-based: inner windings and outmost)
    designElecHt: [40.012, 41.958, 41.981] // Design Electrical Height values
};

const DEFAULT_PAGE5_STATE: Page5State = {
    inputText: "",
    deletedPrimaryIndices: {},
    excludedCells: [],
    col1WindingIndex: null,
    selectedTableType: 'autotransformer'
};

const DEFAULT_ACCESSORY_DATA: WindingAccessoryData = {
    vtcPart: "12LS", // Updated default to 12LS (Inner)
    ksQty: "6710",
    extraKS: 12,
    asItemIndex: -1,
    asT: 0.118,
    asH: 4,
    asR: 0.375,
    asS: 4,
    asBAdjust: 0,
    asVtcPart: "12RZ",
    acItemIndex: -1,
    acT: 0.118,
    acH: 6,
    acR: 0.375,
    acS: 4,
    acBAdjust: 0,
    acVtcPart: "12RC"
};

const DEFAULT_PAGE6_STATE: Page6State = {
    isInitialized: false,
    baseOD: 0,
    items: [],
    selectedVendor: 'ENPAY',
    washerWindingIndex: 0,
    calculationMethod: 'ceiling',
    tubeTolerance: 1.375,
    windingAccessories: {
        0: { ...DEFAULT_ACCESSORY_DATA, vtcPart: "12LS", asVtcPart: "12RZ", acVtcPart: "12RC" },
        1: { ...DEFAULT_ACCESSORY_DATA, vtcPart: "12HS", asVtcPart: "12RZ", acVtcPart: "12RC" }, // Default assumption for 2 windings
        2: { ...DEFAULT_ACCESSORY_DATA, vtcPart: "12HS", asVtcPart: "12RZ", acVtcPart: "12RC" }
    },
    idSealState: {},
    idSealRounding: { id: 'C', od: 'F' }, // Default for ID Seal
    odSealState: {},
    odSealRounding: { id: 'C', od: 'F' },  // Default for OD Seal
    headSheet: {
        vtcPart: "12118855T",
        qty: 12,
        t: 0.079,
        d: 6
    }
};

const DEFAULT_PAGE7_STATE: Page7State = {
    isInitialized: false,
    r1: 2.0758,
    r2: 2.2830,
    r3: 3.1185,
    vt: 64.8598,
    height: 48.75,
    mva: 15,
    meanTurnLvRef: 73.9273,
    r1Ref: 2.0758,
    calibConst: 1.211081
};

const DEFAULT_PAGE8_STATE: Page8State = {
    nomMva: 12000,
    oaMax: 20000,
    maxMva: 22400,
    nll: 11356,
    strayPct: 13,
    lvLoss1: 0,
    lvLoss: 17323,
    hvLoss: 24376,
    lvLoss1Min: 0,
    lvLossMin: 17323,
    hvLossMin: 25659,
    addLl: 0,
    addNll: 0,
    user1: 2,
    user2: 2.5,
    useLvMinCalc: false,
    lvMaxCurrent: 0,
    lvNomCurrent: 0
};

// Helper to clean up table titles in the sidebar
const cleanTableTitle = (title: string) => {
    let clean = title.toUpperCase();

    // Remove "Total -> ... Details" pattern, keeping only the Details name
    // e.g. "Total -> 12.563 139.188 10073 Cover Details" -> "Cover Details"
    if (clean.includes("TOTAL") && clean.includes("DETAILS")) {
        const detailsMatch = clean.match(/([A-Z\s]+DETAILS)/);
        if (detailsMatch) return detailsMatch[1].trim();
    }

    // Remove leading numbers/spaces (e.g. "12 2 24 1743 MAJOR DETAILS" -> "MAJOR DETAILS")
    clean = clean.replace(/^[\d\s\.]+/, '').trim();

    return clean || title;
};

// Helper to clean row material names in the sidebar
const cleanMaterialName = (name: string) => {
    let clean = name.trim();
    const lower = clean.toLowerCase();

    // Explicit known materials
    if (lower.includes('wdman tube')) return "Wdman Tube";
    if (lower.includes('wdman duct')) return "Wdman Duct";
    if (lower.includes('wdg stk') || lower.includes('wd stk')) return "Wd Wdg Stk";

    // Pattern: "Core Duct = ... Wdman"
    if (lower.includes('core duct') && lower.includes('wdman')) return "Wdman Duct";

    // Pattern: "Total -> ... Wdman"
    if (lower.startsWith('total') && lower.includes('->')) {
        if (lower.includes('wdma')) return "Wdman Tube";
        // Clean garbage "Total -> 12.55 ..."
        clean = clean.replace(/^total\s*->\s*[\d\.\s]+/i, '');
    }

    // Pattern: "+ 0.1875 Wdman Duct"
    if (clean.startsWith('+')) {
        clean = clean.replace(/^\+\s*[\d\.]+\s*/, '');
    }

    // Pattern: "Each ... = ..."
    if (clean.includes('=')) {
        const parts = name.split('=');
        if (parts[1]) {
            clean = parts[1].trim();
        }
    }

    // Generic cleanup of leading numbers
    clean = clean.replace(/^[\d\.\s]+(thk)?\s*/i, '');

    return clean;
};

export default function App() {
    const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
    const [isPdfLoaded, setIsPdfLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [windingCount, setWindingCount] = useState(2);
    const [windingNames, setWindingNames] = useState(['Winding 1', 'Winding 2', 'Winding 3']);
    const [isDragging, setIsDragging] = useState(false);
    const [copySuccessId, setCopySuccessId] = useState<string | number | null>(null);
    const [currentPage, setCurrentPage] = useState<'page1' | 'page3' | 'page4' | 'page5' | 'page6' | 'page7' | 'page9' | 'pageBOM'>('page1');
    const [activeCalcTab, setActiveCalcTab] = useState<'z' | 'loss'>('z');

    // Modal State for Core Build Details
    const [showCoreDetails, setShowCoreDetails] = useState(false);

    // Collapsible State for Core Parameters
    const [isCoreExpanded, setIsCoreExpanded] = useState(false);

    // Persistent States
    const [fld12State, setFld12State] = useState<DiscDistributionState>(DEFAULT_DISC_DIST_STATE);
    const [page5State, setPage5State] = useState<Page5State>(DEFAULT_PAGE5_STATE);
    const [page6State, setPage6State] = useState<Page6State>(DEFAULT_PAGE6_STATE);
    const [page7State, setPage7State] = useState<Page7State>(DEFAULT_PAGE7_STATE);
    const [page8State, setPage8State] = useState<Page8State>(DEFAULT_PAGE8_STATE);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const sampleFiles = ['PDF/3.pdf', 'PDF/4.pdf'];

    const handleSampleFileClick = async (filePath: string) => {
        if (!isPdfLoaded) {
            setUploadError('PDF Engine is initializing. Please wait...');
            return;
        }

        setUploadError(null);
        setIsLoading(true);
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to fetch file: ${filePath} (${response.statusText})`);
            }
            const blob = await response.blob();
            const fileName = filePath.split('/').pop() || 'sample.pdf';
            const file = new File([blob], fileName, { type: 'application/pdf' });
            await processFile(file);
        } catch (err: any) {
            console.error(err);
            setUploadError(err.message || 'Failed to load sample file.');
        } finally {
            setIsLoading(false);
        }
    };

    // Load PDF.js from CDN (with offline fallback capability)
    useEffect(() => {
        const loadPdfLib = (src: string, workerSrc: string) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => {
                if (window.pdfjsLib) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
                    setIsPdfLoaded(true);
                } else {
                    console.warn("PDF.js script loaded but window.pdfjsLib is missing.");
                }
            };
            script.onerror = () => {
                // Fallback to CDN if local fails or initial attempt fails
                if (!src.includes('unpkg.com')) {
                    console.log("Local PDF lib not found, falling back to CDN...");
                    loadPdfLib(
                        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js',
                        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
                    );
                } else {
                    setUploadError("Failed to load PDF library. Check internet connection or place files in public/lib/.");
                }
            };
            document.body.appendChild(script);
        };

        loadPdfLib('/lib/pdf.min.js', '/lib/pdf.worker.min.js');

        return () => {
            const scripts = document.querySelectorAll('script[src*="pdf.min.js"]');
            scripts.forEach(s => s.remove());
        };
    }, []);

    useEffect(() => {
        if (copySuccessId !== null) {
            const timer = setTimeout(() => setCopySuccessId(null), 2000);
            return () => clearTimeout(timer);
        }
    }, [copySuccessId]);

    const handleDragEnter = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation(); setIsDragging(false);

        if (!isPdfLoaded) {
            setUploadError('PDF Engine is initializing. Please wait...');
            return;
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) processFile(files[0]);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isPdfLoaded) {
            setUploadError('PDF Engine is initializing. Please wait...');
            return;
        }
        const files = e.target.files;
        if (files && files.length > 0) processFile(files[0]);
    };

    const processFile = async (file: File) => {
        if (!isPdfLoaded) {
            setUploadError('PDF Engine is initializing. Please wait...');
            return;
        }

        if (file.type !== 'application/pdf') { setUploadError('Please upload a valid PDF file.'); return; }
        setUploadError(null); setIsLoading(true);
        try {
            const result = await processPdfFile(file);
            setExtractedData(result.data);
            setWindingCount(result.windingCount);
            setWindingNames(result.windingNames);
            setCurrentPage('page1');
            
            // Reset Persistent States on new file load
            setFld12State(DEFAULT_DISC_DIST_STATE);
            setPage5State(DEFAULT_PAGE5_STATE);
            setPage7State(DEFAULT_PAGE7_STATE);
            setPage8State(DEFAULT_PAGE8_STATE);

            // Initialize Page 6 State with correct KS Part Numbers dynamically
            const newWindingAccessories: Record<number, WindingAccessoryData> = {};
            for (let i = 0; i < result.windingCount; i++) {
                const isOutermost = i === result.windingCount - 1;
                // Part Number Logic: Outer = 12HS, Inner = 12LS
                const vtcPart = isOutermost ? "12HS" : "12LS"; 
                
                newWindingAccessories[i] = {
                    ...DEFAULT_ACCESSORY_DATA,
                    vtcPart: vtcPart,
                    asVtcPart: "12RZ",
                    acVtcPart: "12RC"
                };
            }

            setPage6State({
                ...DEFAULT_PAGE6_STATE,
                windingAccessories: newWindingAccessories
            });

        } catch (err) {
            console.error(err);
            setUploadError('Failed to read PDF. Ensure PDF.js is loaded.');
        } finally {
            setIsLoading(false);
        }
    };

    const updateWindingData = (windingKey: string, field: string, value: any) => {
        if (!extractedData) return;
        const newWdgData = { ...extractedData[windingKey], [field]: value };

        if (field === 'ratedTurns' || field === 'maxTurns' || field === 'discVal') {
            const baseTurns = (newWdgData.maxTurns !== null && newWdgData.maxTurns !== undefined) ?
                (field === 'maxTurns' ? value : newWdgData.maxTurns) :
                (field === 'ratedTurns' ? value : newWdgData.ratedTurns);

            const tLyr = field === 'discVal' ? value : newWdgData.discVal;
            if (baseTurns && tLyr && tLyr !== 0) {
                const newTrnsDisc = baseTurns / tLyr;
                newWdgData.lyrsVal = Number(newTrnsDisc.toFixed(2));
            }
        }
        setExtractedData({ ...extractedData, [windingKey]: newWdgData });
    };

    const incrementValue = (windingKey: string, field: string, amount: number) => {
        if (!extractedData) return;
        const currentVal = parseFloat(extractedData[windingKey][field]) || 0;
        updateWindingData(windingKey, field, Number((currentVal + amount).toFixed(2)));
    };

    const handleCopyWinding = (key: string, idx: number) => {
        if (!extractedData) return;
        const w = extractedData[key];
        const lines = [
            w.paperInsul || '-', w.pullsW || '-', w.pullsH || '-', w.strands || '-', w.bareThk || '-', w.bareWidth || '-',
            w.radial || '-', w.id || '-', w.od || '-', w.meanTurn || '-', w.i2r || '-', w.wattsOA || '-', w.wattsMax || '-',
            w.gradOA || '-', w.gradMax || '-', w.sGradOA || '-', w.sGradMax || '-'
        ];
        navigator.clipboard.writeText(lines.join('\n')).then(() => setCopySuccessId(`wdg-${idx}`));
    };

    const handleCopyCoreParams = () => {
        if (!extractedData?.core) return;
        const c = extractedData.core;
        const values = [c.fluxDen, c.feCircle, c.windowHt, c.windowWidth, c.legCenter, c.coreLength, c.coreHt, c.lamWidth, c.weight].map(v => v || '-');
        navigator.clipboard.writeText(values.join('\n')).then(() => setCopySuccessId('core-params'));
    };

    const handleCopyThk = (rows: any[], idx: number) => {
        if (!rows || rows.length === 0) return;
        const textToCopy = rows.map(r => r.thk).join('\n');
        navigator.clipboard.writeText(textToCopy).then(() => setCopySuccessId(idx));
    };

    const handleCopyCoreBuildColumn = (colKey: 'col1' | 'col2') => {
        if (!extractedData?.coreTable) return;
        const values = extractedData.coreTable.filter(row => !row.isTotal).map(row => colKey === 'col1' ? row.col1 : row.col2);
        const text = values.join('\n');

        navigator.clipboard.writeText(text).then(() => {
            setCopySuccessId(`core-build-${colKey}`);
        });
    };

    const renderEditableCell = (windingKey: string, field: string, val: any) => (
        <input
            type="number" step="any"
            className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:outline-none text-xs text-slate-700 px-1 transition-colors"
            value={val || ''}
            onChange={(e) => updateWindingData(windingKey, field, parseFloat(e.target.value))}
        />
    );

    const renderIncrementableCell = (windingKey: string, field: string, val: any, step: number) => (
        <div className="flex items-center space-x-1">
            <button onClick={() => incrementValue(windingKey, field, -step)} className="text-slate-400 hover:text-slate-600"><Minus className="w-3 h-3" /></button>
            <input
                type="number" step="any"
                className="w-16 bg-transparent text-center focus:outline-none border-b border-transparent hover:border-slate-300 focus:border-slate-500"
                value={val || ''}
                onChange={(e) => updateWindingData(windingKey, field, parseFloat(e.target.value))}
            />
            <button onClick={() => incrementValue(windingKey, field, step)} className="text-slate-400 hover:text-slate-600"><Plus className="w-3 h-3" /></button>
        </div>
    );

    const isOuterWinding = (index: number) => index === windingCount - 1;

    const renderContent = () => {
        switch (currentPage) {
            case 'page3':
                return <Page3 data={extractedData} onBack={() => setCurrentPage('page1')} windingCount={windingCount} />;
            case 'page4':
                return (
                    <Page4
                        data={extractedData}
                        onBack={() => setCurrentPage('page1')}
                        windingNames={windingNames}
                        windingCount={windingCount}
                        pageState={fld12State}
                        setPageState={setFld12State}
                    />
                );
            case 'page5':
                return (
                    <Page5
                        mainData={extractedData}
                        data={null}
                        onBack={() => setCurrentPage('page1')}
                        windingNames={windingNames}
                        windingCount={windingCount}
                        pageState={page5State}
                        setPageState={setPage5State}
                    />
                );
            case 'page6':
                return (
                    <Page6
                        data={extractedData}
                        onBack={() => setCurrentPage('page1')}
                        windingNames={windingNames}
                        windingCount={windingCount}
                        pageState={page6State}
                        setPageState={setPage6State}
                    />
                );
            case 'page7':
                return (
                    <div className="pb-12">
                        <div className="flex justify-center mb-4 sticky top-[4.5rem] z-30">
                            <div className="bg-white/90 backdrop-blur-sm p-1 rounded-xl border border-slate-200 shadow-sm flex space-x-1">
                                <button
                                    onClick={() => setActiveCalcTab('z')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center ${activeCalcTab === 'z'
                                        ? 'bg-slate-800 text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                >
                                    <Percent className="w-3 h-3 mr-1.5" />
                                    %Z Impedance
                                </button>
                                <button
                                    onClick={() => setActiveCalcTab('loss')}
                                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center ${activeCalcTab === 'loss'
                                        ? 'bg-slate-800 text-white shadow-md'
                                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                                        }`}
                                >
                                    <BarChart3 className="w-3 h-3 mr-1.5" />
                                    Loss Calculator
                                </button>
                            </div>
                        </div>
                        <div className="animate-slideIn">
                            {activeCalcTab === 'z' ? (
                                <Page7
                                    data={extractedData}
                                    onBack={() => setCurrentPage('page1')}
                                    windingNames={windingNames}
                                    windingCount={windingCount}
                                    pageState={page7State}
                                    setPageState={setPage7State}
                                />
                            ) : (
                                <Page8
                                    data={extractedData}
                                    onBack={() => setCurrentPage('page1')}
                                    windingNames={windingNames}
                                    windingCount={windingCount}
                                    pageState={page8State}
                                    setPageState={setPage8State}
                                />
                            )}
                        </div>
                    </div>
                );
            case 'page9':
                return (
                    <Page9
                        onBack={() => setCurrentPage('page1')}
                        data={extractedData}
                        windingNames={windingNames}
                        windingCount={windingCount}
                    />
                );
            case 'pageBOM':
                return (
                    <PageBOM
                        onBack={() => setCurrentPage('page1')}
                        data={extractedData}
                        page6State={page6State}
                        windingNames={windingNames}
                        windingCount={windingCount}
                    />
                );
            default:
                return (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 animate-fadeIn">
                        <div className="lg:col-span-3 space-y-4">
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-indigo-50/50">
                                    <div className="flex items-center">
                                        <Table className="w-4 h-4 mr-2 text-slate-600" />
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Winding Data</h3>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2 pl-6">Param</th>
                                                <th className="px-4 py-2 text-blue-700">{windingNames[0]}</th>
                                                <th className="px-4 py-2 text-orange-700">{windingNames[1]}</th>
                                                {windingCount === 3 && <th className="px-4 py-2 text-purple-700">{windingNames[2]}</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-medium text-slate-700">Type</td>
                                                <td className="px-4 py-2 text-slate-800">{extractedData?.wdg1.type || '-'}</td>
                                                <td className="px-4 py-2 text-slate-800">{extractedData?.wdg2.type || '-'}</td>
                                                {windingCount === 3 && <td className="px-4 py-2 text-slate-800">{extractedData?.wdg3.type || '-'}</td>}
                                            </tr>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-bold text-slate-800">Rated (Edit)</td>
                                                {['wdg1', 'wdg2', 'wdg3'].slice(0, windingCount).map((key, i) => (
                                                    <td key={key} className="px-4 py-2 font-bold text-slate-900">
                                                        {renderIncrementableCell(key, 'ratedTurns', extractedData?.[key].ratedTurns, 1)}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-medium text-slate-700">Max</td>
                                                {['wdg1', 'wdg2', 'wdg3'].slice(0, windingCount).map((key, i) => (
                                                    <td key={key} className="px-4 py-2 text-slate-800">
                                                        {isOuterWinding(i) ?
                                                            renderIncrementableCell(key, 'maxTurns', extractedData?.[key].maxTurns, 1)
                                                            :
                                                            extractedData?.[key].maxTurns || '-'
                                                        }
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="hover:bg-slate-50"><td className="px-4 py-2 pl-6 font-medium text-slate-700">Min</td><td className="px-4 py-2 text-slate-800">{extractedData?.wdg1.minTurns || '-'}</td><td className="px-4 py-2 text-slate-800">{extractedData?.wdg2.minTurns || '-'}</td>{windingCount === 3 && <td className="px-4 py-2 text-slate-800">{extractedData?.wdg3.minTurns || '-'}</td>}</tr>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-medium text-slate-700">Trns/Lyr (±2)</td>
                                                {['wdg1', 'wdg2', 'wdg3'].slice(0, windingCount).map((key) => (
                                                    <td key={key} className="px-4 py-2 text-slate-800">
                                                        {renderIncrementableCell(key, 'discVal', extractedData?.[key].discVal, 2)}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-medium text-slate-700">Trns/Disc (Auto)</td>
                                                {['wdg1', 'wdg2', 'wdg3'].slice(0, windingCount).map((key) => (
                                                    <td key={key} className="px-4 py-2 text-slate-500 font-mono bg-slate-50">
                                                        {extractedData?.[key].lyrsVal}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="hover:bg-slate-50 bg-slate-50 border-t border-slate-200">
                                                <td className="px-4 py-2 pl-6 font-extrabold text-slate-900">Turns Drop</td>
                                                <td className="px-4 py-2 font-mono font-bold text-slate-800">{calculateTurnsDrop(extractedData?.wdg1)}</td>
                                                <td className="px-4 py-2 font-mono font-bold text-slate-800">{calculateTurnsDrop(extractedData?.wdg2)}</td>
                                                {windingCount === 3 && <td className="px-4 py-2 font-mono font-bold text-slate-800">{calculateTurnsDrop(extractedData?.wdg3)}</td>}
                                            </tr>
                                            <tr className="hover:bg-slate-50 bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-extrabold text-slate-900">Bay Drop <span className="text-[9px] font-normal opacity-60 ml-1">(Target: &gt;2)</span></td>
                                                <td className={`px-4 py-2 font-mono ${getBayDropColor(calculateBayDrop(extractedData?.wdg1))}`}>{calculateBayDrop(extractedData?.wdg1)}</td>
                                                <td className={`px-4 py-2 font-mono ${getBayDropColor(calculateBayDrop(extractedData?.wdg2))}`}>{calculateBayDrop(extractedData?.wdg2)}</td>
                                                {windingCount === 3 && <td className={`px-4 py-2 font-mono ${getBayDropColor(calculateBayDrop(extractedData?.wdg3))}`}>{calculateBayDrop(extractedData?.wdg3)}</td>}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                    <div className="flex items-center">
                                        <Calculator className="w-4 h-4 mr-2 text-slate-600" />
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Dimensions & Factors</h3>
                                    </div>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2 pl-6">Parameter</th>
                                                <th className="px-4 py-2">{windingNames[0]}</th>
                                                <th className="px-4 py-2">{windingNames[1]}</th>
                                                {windingCount === 3 && <th className="px-4 py-2">{windingNames[2]}</th>}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            <tr className="hover:bg-slate-50"><td className="px-4 py-2 pl-6 font-medium text-slate-700">I.D.</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg1', 'id', extractedData?.wdg1.id)}</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg2', 'id', extractedData?.wdg2.id)}</td>{windingCount === 3 && <td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg3', 'id', extractedData?.wdg3.id)}</td>}</tr>
                                            <tr className="hover:bg-slate-50"><td className="px-4 py-2 pl-6 font-medium text-slate-700">O.D.</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg1', 'od', extractedData?.wdg1.od)}</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg2', 'od', extractedData?.wdg2.od)}</td>{windingCount === 3 && <td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg3', 'od', extractedData?.wdg3.od)}</td>}</tr>
                                            <tr className="hover:bg-slate-50"><td className="px-4 py-2 pl-6 font-medium text-slate-700">Mean Turn</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg1', 'meanTurn', extractedData?.wdg1.meanTurn)}</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg2', 'meanTurn', extractedData?.wdg2.meanTurn)}</td>{windingCount === 3 && <td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg3', 'meanTurn', extractedData?.wdg3.meanTurn)}</td>}</tr>
                                            <tr className="hover:bg-slate-50">
                                                <td className="px-4 py-2 pl-6 font-medium text-slate-700">KS/Circle (±2)</td>
                                                {['wdg1', 'wdg2', 'wdg3'].slice(0, windingCount).map((key) => (
                                                    <td key={key} className="px-4 py-2">
                                                        {renderIncrementableCell(key, 'ksCircle', extractedData?.[key].ksCircle, 2)}
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr className="hover:bg-slate-50"><td className="px-4 py-2 pl-6 font-medium text-slate-700">KS Width</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg1', 'ksWidth', extractedData?.wdg1.ksWidth)}</td><td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg2', 'ksWidth', extractedData?.wdg2.ksWidth)}</td>{windingCount === 3 && <td className="px-4 py-2 text-slate-800">{renderEditableCell('wdg3', 'ksWidth', extractedData?.wdg3.ksWidth)}</td>}</tr>
                                            <tr className="hover:bg-slate-50 bg-slate-50 font-medium">
                                                <td className="px-4 py-2 pl-6 text-slate-700">KS Factor (%)</td>
                                                <td className="px-4 py-2 text-slate-900">{calculateKSFactor(extractedData?.wdg1)}</td>
                                                <td className="px-4 py-2 text-slate-900">{calculateKSFactor(extractedData?.wdg2)}</td>
                                                {windingCount === 3 && <td className="px-4 py-2 text-slate-900">{calculateKSFactor(extractedData?.wdg3)}</td>}
                                            </tr>
                                            <tr className="hover:bg-slate-50 bg-slate-50 font-medium">
                                                <td className="px-4 py-2 pl-6 text-slate-700">ID Space Factor <span className="block text-[9px] text-slate-400 font-normal">(Target: ~3)</span></td>
                                                <td className={`px-4 py-2 ${getFactorColor(calculateIDSpaceFactor(extractedData?.wdg1), 3)}`}>{calculateIDSpaceFactor(extractedData?.wdg1)}</td>
                                                <td className={`px-4 py-2 ${getFactorColor(calculateIDSpaceFactor(extractedData?.wdg2), 3)}`}>{calculateIDSpaceFactor(extractedData?.wdg2)}</td>
                                                {windingCount === 3 && <td className={`px-4 py-2 ${getFactorColor(calculateIDSpaceFactor(extractedData?.wdg3), 3)}`}>{calculateIDSpaceFactor(extractedData?.wdg3)}</td>}
                                            </tr>
                                            <tr className="hover:bg-slate-50 bg-slate-50 font-medium">
                                                <td className="px-4 py-2 pl-6 text-slate-700">OD Space Factor <span className="block text-[9px] text-slate-400 font-normal">(Target: ~5)</span></td>
                                                <td className={`px-4 py-2 ${getFactorColor(calculateODSpaceFactor(extractedData?.wdg1), 5)}`}>{calculateODSpaceFactor(extractedData?.wdg1)}</td>
                                                <td className={`px-4 py-2 ${getFactorColor(calculateODSpaceFactor(extractedData?.wdg2), 5)}`}>{calculateODSpaceFactor(extractedData?.wdg2)}</td>
                                                {windingCount === 3 && <td className={`px-4 py-2 ${getFactorColor(calculateODSpaceFactor(extractedData?.wdg3), 5)}`}>{calculateODSpaceFactor(extractedData?.wdg3)}</td>}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* CORE PARAMETERS TABLE */}
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-4 transition-all duration-300">
                                <div
                                    className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center cursor-pointer hover:bg-slate-100 transition-colors"
                                    onClick={() => setIsCoreExpanded(!isCoreExpanded)}
                                >
                                    <div className="flex items-center">
                                        <Box className="w-4 h-4 mr-2 text-slate-600" />
                                        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Core Parameters</h3>
                                        <span className="ml-2 text-[10px] text-slate-400 font-normal">
                                            {isCoreExpanded ? '(Click to collapse)' : '(Click to expand)'}
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyCoreParams();
                                            }}
                                            className="text-slate-400 hover:text-indigo-600 transition-colors flex items-center text-xs"
                                            title="Copy Core Values"
                                        >
                                            <span className="mr-1">{copySuccessId === 'core-params' ? 'Copied' : 'Copy'}</span>
                                            {copySuccessId === 'core-params' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                        </button>
                                        {isCoreExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                    </div>
                                </div>

                                {isCoreExpanded && (
                                    <div className="p-0 animate-fadeIn">
                                        <table className="w-full text-xs text-left">
                                            <tbody className="divide-y divide-slate-100">
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100 w-1/2">Flux Den(T)</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.fluxDen || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Fe Circle</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.feCircle || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Window Ht</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.windowHt || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Window Width</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.windowWidth || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Leg Center</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.legCenter || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Core Length</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.coreLength || '-'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Core Ht</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800">{extractedData?.core.coreHt || '-'}</td>
                                                </tr>
                                                <tr className="bg-slate-50">
                                                    <td className="px-4 py-2 text-slate-500 font-medium border-r border-slate-100">Lam Width (Max)</td>
                                                    <td className="px-4 py-2 font-mono text-slate-800 font-bold">{extractedData?.core.lamWidth || '-'}</td>
                                                </tr>
                                                <tr className="bg-emerald-50">
                                                    <td className="px-4 py-2 text-emerald-700 font-bold border-r border-emerald-100">Core Weight</td>
                                                    <td className="px-4 py-2 font-mono font-bold text-emerald-800">{extractedData?.core.weight || '-'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                                {['wdg1', 'wdg2', 'wdg3'].slice(0, windingCount).map((key, idx) => (
                                    <div key={key} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                                            <div className="flex items-center">
                                                <Grid className="w-4 h-4 mr-2 text-slate-500" />
                                                <h3 className="font-bold text-xs uppercase text-slate-700">{windingNames[idx]} Specs</h3>
                                            </div>
                                            <button
                                                onClick={() => handleCopyWinding(key, idx)}
                                                className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                title="Copy All Specs"
                                            >
                                                {copySuccessId === `wdg-${idx}` ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                            </button>
                                        </div>
                                        <div className="p-3">
                                            <table className="w-full text-xs text-left">
                                                <tbody className="divide-y divide-slate-50">
                                                    <tr><td className="py-1 text-slate-500">Total Paper Insul</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].paperInsul || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Pulls Wide</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].pullsW || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Pulls High</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].pullsH || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Strands</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].strands || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Bare Cond Thk</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].bareThk || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Bare Cond Width</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].bareWidth || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Radial Build</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].radial || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">I.D.</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].id || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">O.D.</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].od || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Mean Turn</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].meanTurn || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">I2R Loss</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].i2r || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Watts/in² (OA)</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].wattsOA || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">Watts/in² (Max)</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].wattsMax || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">S_Grad (OA)</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].sGradOA || '-'}</td></tr>
                                                    <tr><td className="py-1 text-slate-500">S_Grad (Max)</td><td className="py-1 text-right font-mono text-slate-800">{extractedData?.[key].sGradMax || '-'}</td></tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="lg:col-span-1 space-y-4">

                            <button
                                onClick={() => setShowCoreDetails(true)}
                                className="w-full flex items-center justify-center space-x-2 bg-white text-indigo-600 border border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50 px-4 py-2.5 rounded-lg shadow-sm transition-all font-semibold text-xs mb-2"
                            >
                                <Box className="w-4 h-4" />
                                <span>View Core Build Details</span>
                            </button>

                            {extractedData?.tubeTables && extractedData.tubeTables.length > 0 && (
                                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                        <div className="flex items-center">
                                            <Layers className="w-4 h-4 mr-2 text-slate-600" />
                                            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-800">Tube Details</h3>
                                        </div>
                                    </div>
                                    <div className="p-0">
                                        {extractedData.tubeTables.map((table, idx) => {
                                            let wdmanTubeCounter = 0;
                                            const cleanTitle = cleanTableTitle(table.title);

                                            return (
                                                <div key={idx} className="border-b border-slate-100 last:border-b-0">
                                                    <div className="bg-slate-50/50 px-4 py-2 flex justify-between items-center border-t border-slate-100 first:border-t-0">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{cleanTitle}</span>
                                                        <button
                                                            onClick={() => handleCopyThk(table.rows, idx)}
                                                            className="text-slate-400 hover:text-indigo-600 transition-colors"
                                                            title="Copy Thickness Values"
                                                        >
                                                            {copySuccessId === idx ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-slate-50 text-[10px] text-slate-400">
                                                            <tr>
                                                                <th className="px-4 py-1 font-normal">Material</th>
                                                                <th className="px-2 py-1 font-normal text-right">Thk</th>
                                                                <th className="px-4 py-1 font-normal text-right">Qty</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-50">
                                                            {table.rows.map((r, rIdx) => {
                                                                const originalCleanName = cleanMaterialName(r.material);
                                                                let finalMaterialName = originalCleanName;

                                                                if (originalCleanName === "Wdman Tube") {
                                                                    wdmanTubeCounter++;
                                                                    const titleLower = cleanTitle.toLowerCase();
                                                                    if (titleLower.includes("core tube")) {
                                                                        finalMaterialName = "Core Tube";
                                                                    } else if (titleLower.includes("major 1") || titleLower.includes("major i")) {
                                                                        finalMaterialName = "Major 1 Tube";
                                                                    } else if (titleLower.includes("major 2") || titleLower.includes("major ii")) {
                                                                        finalMaterialName = `Major 2-${wdmanTubeCounter} Tube`;
                                                                    } else if (titleLower.includes("cover")) {
                                                                        finalMaterialName = "Cover Tube";
                                                                    } else if (titleLower.includes("major")) {
                                                                        finalMaterialName = `Major-${wdmanTubeCounter} Tube`;
                                                                    }
                                                                }

                                                                return (
                                                                    <tr key={rIdx} className="hover:bg-slate-50/50">
                                                                        <td className="px-4 py-1.5 text-slate-700 truncate max-w-[120px]" title={r.material}>{finalMaterialName}</td>
                                                                        <td className="px-2 py-1.5 text-right font-mono text-slate-600">{r.thk}</td>
                                                                        <td className="px-4 py-1.5 text-right font-mono text-slate-600">{r.qty}</td>
                                                                    </tr>
                                                                );
                                                            })}
                                                            <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                                                                <td className="px-4 py-1.5 text-slate-700 text-[10px] uppercase">Total</td>
                                                                <td className="px-2 py-1.5 text-right font-mono text-slate-800">
                                                                    {table.rows.reduce((sum, r) => sum + (parseFloat(r.thk) || 0), 0).toFixed(4).replace(/\.?0+$/, '')}
                                                                </td>
                                                                <td className="px-4 py-1.5"></td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
        }
    };

    return (
        <div
            className={`min-h-screen bg-slate-50 text-slate-900 font-sans p-2 transition-colors ${isDragging ? 'bg-slate-100' : ''}`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {isDragging && (
                <div className="fixed inset-0 z-50 bg-slate-900/10 border-4 border-slate-400 border-dashed flex items-center justify-center pointer-events-none backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-xl shadow-lg flex flex-col items-center animate-bounce">
                        <FileUp className="w-12 h-12 text-slate-600 mb-2" />
                        <span className="text-lg font-bold text-slate-800">Drop PDF Here</span>
                    </div>
                </div>
            )}

            {showCoreDetails && extractedData?.coreTable && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fadeIn">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div className="flex items-center">
                                <Box className="w-5 h-5 mr-2 text-indigo-600" />
                                <h3 className="text-lg font-bold text-slate-800">Core Build Details</h3>
                            </div>
                            <button onClick={() => setShowCoreDetails(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-200">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="overflow-x-auto rounded-lg border border-slate-100">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-800 text-white font-bold sticky top-0">
                                        <tr>
                                            <th className="px-4 py-2">
                                                <div className="flex items-center space-x-2">
                                                    <span>Lam Width</span>
                                                    <button onClick={() => handleCopyCoreBuildColumn('col1')} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700" title="Copy Column">
                                                        {copySuccessId === 'core-build-col1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </th>
                                            <th className="px-4 py-2">
                                                <div className="flex items-center space-x-2">
                                                    <span>Stack Ht</span>
                                                    <button onClick={() => handleCopyCoreBuildColumn('col2')} className="text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-slate-700" title="Copy Column">
                                                        {copySuccessId === 'core-build-col2' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                            </th>
                                            <th className="px-4 py-2">Stack Area</th>
                                            <th className="px-4 py-2 text-right">Weight</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {extractedData.coreTable.map((row, idx) => (
                                            <tr key={idx} className={row.isTotal ? "bg-slate-100 font-bold border-t-2 border-slate-300" : "hover:bg-slate-50"}>
                                                {row.isTotal ? (
                                                    <>
                                                        <td className="px-4 py-2 font-mono">Total</td>
                                                        <td className="px-4 py-2 font-mono">{row.col2}</td>
                                                        <td className="px-4 py-2 font-mono">{row.col3}</td>
                                                        <td className="px-4 py-2 font-mono text-right">{row.col4}</td>
                                                    </>
                                                ) : (
                                                    <>
                                                        <td className="px-4 py-2 font-mono text-slate-700">{row.col1}</td>
                                                        <td className="px-4 py-2 font-mono text-slate-700">{row.col2}</td>
                                                        <td className="px-4 py-2 font-mono text-slate-700">{row.col3}</td>
                                                        <td className="px-4 py-2 font-mono text-right text-slate-700">{row.col4}</td>
                                                    </>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <header className="bg-slate-800 text-white p-3 shadow-md rounded-lg mb-4 flex items-center justify-between sticky top-2 z-40">
                <div className="flex items-center space-x-2">
                    <FileText className="w-5 h-5 text-slate-400" />
                    <h1 className="text-base font-bold tracking-wide">TransformerData <span className="font-light text-slate-400">Reader V10.0</span></h1>
                </div>

                <div className="flex items-center space-x-3">

                    <button
                        onClick={() => setCurrentPage('page9')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center ${currentPage === 'page9' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-700 text-indigo-300 hover:bg-slate-600 hover:text-white border border-slate-600'}`}
                    >
                        <FileSpreadsheet className="w-3 h-3 mr-1.5" />
                        Excel Calc Demo
                    </button>

                    {(extractedData || currentPage === 'page5') && (
                        <div className="flex bg-slate-700 rounded-lg p-1 border border-slate-600">
                            <button
                                onClick={() => setCurrentPage('page1')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'page1' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                            >
                                {extractedData ? 'Main' : 'Home'}
                            </button>

                            {extractedData && (
                                <>
                                    <button
                                        onClick={() => setCurrentPage('page3')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'page3' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        LLS
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage('page4')}
                                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'page4' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        AT
                                    </button>
                                </>
                            )}

                            <button
                                onClick={() => setCurrentPage('page5')}
                                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'page5' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                            >
                                FLD 12
                            </button>

                            {extractedData && (
                                <>
                                    <button
                                        onClick={() => setCurrentPage('page6')}
                                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'page6' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        Radial
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage('page7')}
                                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'page7' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        Calculations
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage('pageBOM')}
                                        className={`flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all ${currentPage === 'pageBOM' ? 'bg-slate-600 text-white shadow-sm' : 'text-slate-300 hover:text-white'}`}
                                    >
                                        BOM
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    {uploadError && (
                        <div className="text-[10px] text-red-200 bg-red-900/50 px-2 py-1.5 rounded flex items-center border border-red-800">
                            <AlertCircle className="w-3 h-3 mr-1" /> {uploadError}
                        </div>
                    )}

                    <label className={`cursor-pointer bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-xs font-bold flex items-center transition shadow-md whitespace-nowrap ${(!isPdfLoaded || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        <Upload className="w-3 h-3 mr-1.5" />
                        {!isPdfLoaded ? 'Initializing...' : isLoading ? 'Scanning...' : 'Upload PDF'}
                        <input
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileInput}
                            disabled={!isPdfLoaded || isLoading}
                        />
                    </label>
                </div>
            </header>

            <main className="max-w-full mx-auto pb-8">
                {(!extractedData && currentPage !== 'page5' && currentPage !== 'page9') ? (
                    <div className="bg-white rounded-xl border-2 border-dashed border-slate-300 p-12 flex flex-col items-center justify-center text-slate-400 min-h-[60vh] transition-all hover:border-slate-400">
                        {/* Section 1: Upload */}
                        <div className="text-center w-full max-w-md">
                            <Upload className="w-16 h-16 mb-4 opacity-20 mx-auto" />
                            <p className="text-lg font-medium text-slate-500">Drag & Drop PDF anywhere to begin</p>
                            <p className="text-sm mt-2">or use the Upload button above</p>
                        </div>

                        {/* Section 2: Sample files */}
                        <div className="mt-8 pt-8 border-t border-slate-200 w-full max-w-lg flex flex-col items-center">
                            <p className="text-sm text-slate-400 mb-4">Or select a sample file:</p>
                            <div className="flex flex-wrap items-center justify-center gap-4">
                                {sampleFiles.map(file => (
                                    <button
                                        key={file}
                                        onClick={() => handleSampleFileClick(file)}
                                        disabled={isLoading || !isPdfLoaded}
                                        className="flex items-center space-x-2 bg-slate-100 text-slate-700 border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 px-4 py-2 rounded-lg shadow-sm transition-all font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <FileText className="w-4 h-4 text-indigo-500" />
                                        <span>{file.split('/').pop()}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Section 3: Standalone tool */}
                        <div className="mt-8 pt-8 border-t border-slate-200 w-full max-w-lg flex flex-col items-center">
                            <p className="text-sm text-slate-400 mb-3">Or access the standalone tool</p>
                            <button
                                onClick={() => setCurrentPage('page5')}
                                className="flex items-center space-x-2 bg-white text-indigo-600 border border-indigo-200 hover:border-indigo-400 px-6 py-3 rounded-lg shadow-sm transition-all font-semibold"
                            >
                                <Table className="w-5 h-5" />
                                <span>Open FLD 12 Data Input</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    renderContent()
                )}
            </main>
        </div>
    );
}
