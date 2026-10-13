import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import {
  floodPoints,
  FloodPoint,
  SCENARIO_META,
} from './data/floodPoints';
import {
  CloudRain,
  Waves,
  ShieldAlert,
  Search,
  RotateCcw,
  ChevronDown,
  Navigation,
  CheckCircle2,
  Calendar,
  Layers,
  MapPin,
  ExternalLink,
  HelpCircle,
  X,
} from 'lucide-react';

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const markersMapRef = useRef<Map<number, L.Marker>>(new Map());
  const rainCanvasRef = useRef<HTMLCanvasElement>(null);

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all'); // 'all' | 'H' | 'M' | 'L'
  const [selectedScenario, setSelectedScenario] = useState<string>('all'); // 'all' | 'A' | 'B' | 'C'
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null);
  const [isLegendCollapsed, setIsLegendCollapsed] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Escape key handler to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsGuideOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Filtered Points
  const filteredPoints = useMemo(() => {
    return floodPoints.filter((point) => {
      // Search
      const search = searchTerm.toLowerCase().trim();
      const matchSearch =
        !search ||
        point.street.toLowerCase().includes(search) ||
        point.ward.toLowerCase().includes(search) ||
        point.regionName.toLowerCase().includes(search) ||
        (point.targetYear && point.targetYear.toLowerCase().includes(search));

      // Region
      const matchRegion =
        selectedRegion === 'all' || point.region === selectedRegion;

      // Severity Level
      const matchSeverity =
        selectedSeverity === 'all' || point.severityLevel === selectedSeverity;

      // Scenario Group (A, B, C)
      const matchScenario =
        selectedScenario === 'all' || point.scenarioGroup === selectedScenario;

      return matchSearch && matchRegion && matchSeverity && matchScenario;
    });
  }, [searchTerm, selectedRegion, selectedSeverity, selectedScenario]);

  // Counts
  const counts = useMemo(() => {
    return {
      total: floodPoints.length,
      severe: floodPoints.filter((p) => p.severityLevel === 'H').length,
      moderate: floodPoints.filter((p) => p.severityLevel === 'M').length,
      light: floodPoints.filter((p) => p.severityLevel === 'L').length,
      groupA: floodPoints.filter((p) => p.scenarioGroup === 'A').length,
      groupB: floodPoints.filter((p) => p.scenarioGroup === 'B').length,
      groupC: floodPoints.filter((p) => p.scenarioGroup === 'C').length,
    };
  }, []);

  // Marker Icon Generator
  const createMarkerIcon = (point: FloodPoint, isSelected: boolean) => {
    let color = '#dc2626';
    let ringHtml = '';
    const label = point.severityLevel;

    if (point.severityLevel === 'H') {
      color = '#dc2626';
      ringHtml =
        '<span class="absolute -inset-1.5 rounded-full bg-rose-500 opacity-80 pulse-severe"></span>';
    } else if (point.severityLevel === 'M') {
      color = '#ea580c';
      ringHtml =
        '<span class="absolute -inset-1 rounded-full bg-amber-500 opacity-60 pulse-moderate"></span>';
    } else {
      color = '#ca8a04';
    }

    const scaleClass = isSelected
      ? 'scale-125 ring-4 ring-sky-400'
      : 'group-hover:scale-125';

    const html = `
      <div class="relative flex items-center justify-center w-8 h-8 cursor-pointer group">
        ${ringHtml}
        <div class="relative w-6 h-6 rounded-full border-2 border-white flex items-center justify-center shadow-lg transition-transform ${scaleClass}" style="background-color: ${color}">
          <span class="text-[10px] font-black text-white leading-none font-mono">${label}</span>
        </div>
      </div>
    `;

    return L.divIcon({
      html,
      className: 'custom-flood-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -16],
    });
  };

  // Popup Content Generator (strictly original text - no additions)
  const buildPopupContent = (point: FloodPoint) => {
    let badgeHtml = '';
    if (point.severityLevel === 'H') {
      badgeHtml = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-rose-100 text-rose-700 border border-rose-300">🔴 MỨC H - NGẬP NẶNG</span>`;
    } else if (point.severityLevel === 'M') {
      badgeHtml = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-100 text-amber-800 border border-amber-300">🟠 MỨC M - NGẬP VỪA</span>`;
    } else {
      badgeHtml = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-md bg-yellow-100 text-yellow-800 border border-yellow-300">🟡 MỨC L - NGẬP NHẸ</span>`;
    }

    const rankBadge = point.stt
      ? `<span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-900 text-white">STT ${point.stt}/50</span>`
      : '';

    const targetYearHtml = point.targetYear
      ? `<div class="mt-2 text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
          ${point.targetYear}
         </div>`
      : '';

    const noteHtml = point.note
      ? `<div class="mt-2 text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
          ${point.note}
         </div>`
      : '';

    return `
      <div class="p-1 min-w-[220px] max-w-[270px]">
        <div class="flex items-center justify-between gap-1 pb-1.5 mb-1.5 border-b border-slate-100">
          <span class="text-[10px] font-bold uppercase tracking-wider text-sky-600">${point.regionName}</span>
          ${rankBadge}
        </div>
        
        <div class="mb-1.5">
          ${badgeHtml}
        </div>

        <h4 class="font-bold text-slate-900 text-sm leading-snug">${point.street}</h4>
        <div class="text-xs text-slate-600 mt-0.5">${point.ward}</div>

        <div class="text-[11px] text-slate-500 mt-1 font-medium">
          ${point.scenarioTitle}
        </div>

        ${targetYearHtml}
        ${noteHtml}
      </div>
    `;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = [10.8231, 106.6297];
      const defaultZoom = 11;

      const hcmBounds = L.latLngBounds(

          L.latLng(10.2, 106.0),  // Góc Tây Nam: rìa Vĩnh Long, Bến Tre và biên giới Tây Ninh
          L.latLng(11.6, 107.5)   // Góc Đông Bắc: khu vực Bảo Lộc (Lâm Đồng) và La Gi (Bình Thuận)
      );

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        minZoom: 10,
        maxZoom: 16,
        maxBounds: hcmBounds,
        maxBoundsViscosity: 0.1,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      if (map.attributionControl) {
        map.attributionControl.setPrefix(
          '<a href="https://leafletjs.com" target="_blank">Leaflet</a>'
        );
      }

      const osmTile = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          minZoom: 10,
          maxZoom: 16,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        }
      );

      osmTile.addTo(map);
      mapInstanceRef.current = map;

      const markersGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markersGroup;
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Synchronize Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    const layer = markersLayerRef.current;
    layer.clearLayers();
    markersMapRef.current.clear();

    filteredPoints.forEach((point) => {
      const isSelected = selectedPointId === point.id;
      const marker = L.marker([point.lat, point.lng], {
        icon: createMarkerIcon(point, isSelected),
        title: point.street,
      });

      marker.bindPopup(buildPopupContent(point));

      marker.on('click', () => {
        setSelectedPointId(point.id);
      });

      layer.addLayer(marker);
      markersMapRef.current.set(point.id, marker);
    });
  }, [filteredPoints, selectedPointId]);

  // Rain Canvas Animation
  useEffect(() => {
    const canvas = rainCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const dropCount = Math.min(Math.floor(width / 24), 45);
    const drops = Array.from({ length: dropCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 16 + 8,
      speed: Math.random() * 5 + 6,
      opacity: Math.random() * 0.25 + 0.1,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.2;

      drops.forEach((d) => {
        ctx.beginPath();
        ctx.globalAlpha = d.opacity;
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + d.length);
        ctx.stroke();

        d.y += d.speed;
        d.x -= 0.5;

        if (d.y > height) {
          d.y = -20;
          d.x = Math.random() * width;
        }
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Helper to focus point
  const focusPoint = (point: FloodPoint) => {
    setSelectedPointId(point.id);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([point.lat, point.lng], 16, { duration: 1.2 });
      const marker = markersMapRef.current.get(point.id);
      if (marker) {
        setTimeout(() => {
          marker.openPopup();
        }, 600);
      }
    }
  };

  // Helper to focus region
  const focusRegion = (regionKey: 'hcm' | 'thuduc' | 'binhduong' | 'vungtau') => {
    const map = mapInstanceRef.current;
    if (!map) return;
    if (regionKey === 'hcm') {
      map.flyTo([10.7769, 106.6909], 13);
      setSelectedRegion('hcm-old');
    } else if (regionKey === 'thuduc') {
      map.flyTo([10.84, 106.76], 13);
      setSelectedRegion('thu-duc');
    } else if (regionKey === 'binhduong') {
      map.flyTo([10.97, 106.68], 12);
      setSelectedRegion('binh-duong');
    } else if (regionKey === 'vungtau') {
      map.flyTo([10.42, 107.12], 11);
      setSelectedRegion('vung-tau');
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSearchTerm('');
    setSelectedRegion('all');
    setSelectedSeverity('all');
    setSelectedScenario('all');
    setSelectedPointId(null);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([10.8231, 106.6297], 11);
    }
  };

  return (
    <div className="selection:bg-sky-500 selection:text-white bg-slate-50 min-h-screen text-slate-800 relative">
      {/* Background ambient lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full bg-gradient-to-br from-sky-300/40 via-cyan-200/35 to-blue-200/20 blur-[120px]" />
        <div className="absolute top-[18%] -right-32 w-[620px] h-[620px] rounded-full bg-gradient-to-bl from-indigo-200/35 via-sky-200/30 to-purple-100/20 blur-[130px]" />
        <div className="absolute top-[48%] left-[5%] w-[580px] h-[580px] rounded-full bg-gradient-to-tr from-teal-200/30 via-emerald-100/30 to-sky-200/25 blur-[120px]" />
        <div className="absolute top-[72%] -right-20 w-[680px] h-[680px] rounded-full bg-gradient-to-tl from-blue-200/30 via-sky-200/25 to-indigo-100/20 blur-[140px]" />
      </div>

      {/* Rain canvas background */}
      <canvas
        ref={rainCanvasRef}
        className="fixed inset-0 pointer-events-none z-0 opacity-35"
      />

      <main className="relative z-10 min-h-screen py-3 sm:py-5">
        <section id="ban-do">
          <div className="w-full px-3 sm:px-5 lg:px-6">
            {/* Header */}
            <div className="flex flex-col gap-3.5 mb-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
                  <span className="w-3.5 h-3.5 rounded-full bg-rose-600 inline-block animate-pulse"></span>
                  50 Vị Trí Ngập Nặng (Mức H)
                </h1>
              </div>

              {/* Dàn 3 mục theo chiều ngang dưới title (bỏ tất cả vị trí) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3.5 w-full">
                <button
                  onClick={() =>
                    setSelectedSeverity(selectedSeverity === 'H' ? 'all' : 'H')
                  }
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs hover:shadow-md active:scale-95 ${
                    selectedSeverity === 'H'
                      ? 'bg-rose-600 text-white border-rose-600 ring-4 ring-rose-500/30 shadow-rose-600/30 shadow-md'
                      : 'bg-white text-rose-700 border-rose-300 hover:bg-rose-50 hover:border-rose-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600 border border-white"></span>
                    </span>
                    <span className="tracking-tight truncate">MỨC H (NGẬP NẶNG)</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tabular-nums shrink-0 ${
                      selectedSeverity === 'H'
                        ? 'bg-white/20 text-white'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}
                  >
                    {counts.severe} vị trí
                  </span>
                </button>

                <button
                  onClick={() =>
                    setSelectedSeverity(selectedSeverity === 'M' ? 'all' : 'M')
                  }
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs hover:shadow-md active:scale-95 ${
                    selectedSeverity === 'M'
                      ? 'bg-amber-600 text-white border-amber-600 ring-4 ring-amber-500/30 shadow-amber-600/30 shadow-md'
                      : 'bg-white text-amber-700 border-amber-300 hover:bg-amber-50 hover:border-amber-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500 border border-white"></span>
                    </span>
                    <span className="tracking-tight truncate">MỨC M (NGẬP VỪA)</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tabular-nums shrink-0 ${
                      selectedSeverity === 'M'
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {counts.moderate} vị trí
                  </span>
                </button>

                <button
                  onClick={() =>
                    setSelectedSeverity(selectedSeverity === 'L' ? 'all' : 'L')
                  }
                  className={`w-full px-4 sm:px-5 py-3 sm:py-3.5 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 text-xs sm:text-sm font-extrabold cursor-pointer shadow-xs hover:shadow-md active:scale-95 ${
                    selectedSeverity === 'L'
                      ? 'bg-yellow-500 text-slate-900 border-yellow-500 ring-4 ring-yellow-400/35 shadow-yellow-500/30 shadow-md'
                      : 'bg-white text-yellow-800 border-yellow-300 hover:bg-yellow-50 hover:border-yellow-400'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-500 border border-white"></span>
                    </span>
                    <span className="tracking-tight truncate">MỨC L (NGẬP NHẸ)</span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-lg text-xs font-black font-mono tabular-nums shrink-0 ${
                      selectedSeverity === 'L'
                        ? 'bg-slate-900/15 text-slate-900'
                        : 'bg-yellow-100 text-yellow-900 border border-yellow-200'
                    }`}
                  >
                    {counts.light} tuyến
                  </span>
                </button>
              </div>
            </div>

            {/* Filter Bar (Search + Region + Severity + Scenario + Reset) */}
            <div className="bg-white/80 border border-white/90 backdrop-blur-md rounded-2xl p-3.5 mb-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center shadow-lg shadow-slate-900/5">
              {/* Search */}
              <div className="md:col-span-4 relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Tìm theo tên đường (VD: Phan Văn Hớn, QL13, Calmette...)"
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all pl-9"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              </div>

              {/* Region Filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedRegion}
                  onChange={(e) => setSelectedRegion(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="all">Tất cả địa bàn</option>
                  <option value="hcm-old">TPHCM trước đây</option>
                  <option value="thu-duc">Khu vực Thủ Đức</option>
                  <option value="binh-duong">Bình Dương trước đây</option>
                  <option value="vung-tau">Bà Rịa - Vũng Tàu</option>
                </select>
              </div>

              {/* Scenario Filter */}
              <div className="md:col-span-3">
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="w-full bg-slate-50/80 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/20 transition-all"
                >
                  <option value="all">Tất cả kịch bản &amp; cụm điểm</option>
                  <option value="A">Nhóm A: Ngập khi mưa lớn (21 điểm H)</option>
                  <option value="B">Nhóm B: Ngập khi triều cường (9 điểm H)</option>
                  <option value="C">Nhóm C: Ngập kép mưa &amp; triều (20 điểm H)</option>
                  <option value="M">Cụm ngập vừa - mức M (10 điểm)</option>
                  <option value="L">Cụm ngập nhẹ - mức L (21 điểm)</option>
                </select>
              </div>

              {/* Reset Button */}
              <div className="md:col-span-2 flex items-center justify-end">
                <button
                  onClick={resetFilters}
                  className="w-full md:w-auto px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/90 border border-slate-200 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Đặt lại lọc
                </button>
              </div>
            </div>

            {/* Map and Sidebar Container (9:3 Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-stretch">
              {/* Map Column (lg:col-span-9) */}
              <div className="lg:col-span-9 rounded-2xl overflow-hidden border border-white/90 relative bg-white shadow-2xl min-h-[600px] lg:min-h-[calc(100vh-250px)] flex flex-col">
                <div
                  ref={mapContainerRef}
                  id="map"
                  className="w-full h-full flex-1 z-10 relative"
                  style={{ minHeight: '600px' }}
                />

                {/* Floating Dynamic Legend Widget on Map */}
                <div
                  id="floating-map-legend"
                  className="absolute top-3 right-3 z-20 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-3.5 max-w-[240px] sm:max-w-[280px] text-xs transition-all duration-300"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-200/80">
                    <span className="font-bold text-slate-800 tracking-tight text-[11px] uppercase truncate">
                      Chú thích mức ngập
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[10px] text-sky-600 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 tabular-nums font-semibold">
                        {filteredPoints.length}
                      </span>
                      <button
                        onClick={() => setIsLegendCollapsed(!isLegendCollapsed)}
                        aria-label="Thu gọn hoặc mở rộng chú giải"
                        className="text-slate-500 hover:text-slate-800 p-0.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                      >
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            isLegendCollapsed ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {!isLegendCollapsed && (
                    <div className="space-y-1.5 transition-all duration-300">
                      {/* Mức H */}
                      <div
                        onClick={() =>
                          setSelectedSeverity(selectedSeverity === 'H' ? 'all' : 'H')
                        }
                        className={`flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
                          selectedSeverity === 'H' ? 'bg-rose-50 ring-1 ring-rose-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
                            <span className="absolute -inset-1 rounded-full bg-rose-500 opacity-70 pulse-severe"></span>
                            <span className="relative w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-rose-700 truncate leading-tight">
                              Mức H: Ngập nặng (50 điểm)
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              Nhóm A (21), B (9), C (20)
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border text-rose-700 bg-rose-50 border-rose-200 shrink-0 tabular-nums">
                          {filteredPoints.filter((p) => p.severityLevel === 'H').length}
                        </span>
                      </div>

                      {/* Mức M */}
                      <div
                        onClick={() =>
                          setSelectedSeverity(selectedSeverity === 'M' ? 'all' : 'M')
                        }
                        className={`flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
                          selectedSeverity === 'M' ? 'bg-amber-50 ring-1 ring-amber-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
                            <span className="absolute -inset-1 rounded-full bg-amber-500 opacity-60 pulse-moderate"></span>
                            <span className="relative w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-amber-800 truncate leading-tight">
                              Mức M: Ngập vừa
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              Cụm TSN &amp; QL13
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border text-amber-800 bg-amber-50 border-amber-200 shrink-0 tabular-nums">
                          {filteredPoints.filter((p) => p.severityLevel === 'M').length}
                        </span>
                      </div>

                      {/* Mức L */}
                      <div
                        onClick={() =>
                          setSelectedSeverity(selectedSeverity === 'L' ? 'all' : 'L')
                        }
                        className={`flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ${
                          selectedSeverity === 'L' ? 'bg-yellow-50 ring-1 ring-yellow-300' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="relative flex items-center justify-center w-3 h-3 shrink-0">
                            <span className="relative w-2.5 h-2.5 rounded-full bg-yellow-500"></span>
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-yellow-800 truncate leading-tight">
                              Mức L: Ngập nhẹ
                            </div>
                            <div className="text-[10px] text-slate-500 leading-tight">
                              21 tuyến trung tâm
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border text-yellow-800 bg-yellow-50 border-yellow-200 shrink-0 tabular-nums">
                          {filteredPoints.filter((p) => p.severityLevel === 'L').length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Floating Quick Navigation buttons on Map */}
                <div className="absolute bottom-4 left-4 z-20 flex flex-wrap gap-2">
                  <button
                    onClick={() => focusRegion('hcm')}
                    className="px-3 py-1.5 text-xs font-semibold bg-white/90 text-sky-700 hover:bg-white rounded-lg border border-slate-200/90 backdrop-blur-md shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Navigation className="w-3 h-3" />
                    TPHCM trước đây
                  </button>
                  <button
                    onClick={() => focusRegion('thuduc')}
                    className="px-3 py-1.5 text-xs font-semibold bg-white/90 text-indigo-700 hover:bg-white rounded-lg border border-slate-200/90 backdrop-blur-md shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Navigation className="w-3 h-3" />
                    Thủ Đức
                  </button>
                  <button
                    onClick={() => focusRegion('binhduong')}
                    className="px-3 py-1.5 text-xs font-semibold bg-white/90 text-amber-700 hover:bg-white rounded-lg border border-slate-200/90 backdrop-blur-md shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Navigation className="w-3 h-3" />
                    Bình Dương
                  </button>
                  <button
                    onClick={() => focusRegion('vungtau')}
                    className="px-3 py-1.5 text-xs font-semibold bg-white/90 text-emerald-700 hover:bg-white rounded-lg border border-slate-200/90 backdrop-blur-md shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Navigation className="w-3 h-3" />
                    Bà Rịa - Vũng Tàu
                  </button>
                </div>
              </div>

              {/* Sidebar List (lg:col-span-3) */}
              <div className="lg:col-span-3 rounded-2xl border border-white/90 bg-white/85 backdrop-blur-md shadow-xl flex flex-col min-h-[600px] lg:max-h-[calc(100vh-250px)] overflow-hidden">
                {/* Sidebar Header */}
                <div className="p-4 border-b border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">Danh sách vị trí</h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Hiển thị {filteredPoints.length} / {floodPoints.length} vị trí
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-mono font-bold">
                      {filteredPoints.length}
                    </span>
                  </div>

                  {/* Level Filter Tabs */}
                  <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-xl text-[10px] font-bold">
                    <button
                      onClick={() => setSelectedSeverity('all')}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        selectedSeverity === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Tất cả
                    </button>
                    <button
                      onClick={() => setSelectedSeverity('H')}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        selectedSeverity === 'H'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'text-rose-700 hover:bg-rose-100/60'
                      }`}
                    >
                      Mức H
                    </button>
                    <button
                      onClick={() => setSelectedSeverity('M')}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        selectedSeverity === 'M'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-amber-700 hover:bg-amber-100/60'
                      }`}
                    >
                      Mức M
                    </button>
                    <button
                      onClick={() => setSelectedSeverity('L')}
                      className={`py-1 rounded-lg transition-all cursor-pointer ${
                        selectedSeverity === 'L'
                          ? 'bg-yellow-600 text-white shadow-xs'
                          : 'text-yellow-800 hover:bg-yellow-100/60'
                      }`}
                    >
                      Mức L
                    </button>
                  </div>
                </div>

                {/* Point Items List */}
                <div
                  id="map-point-list"
                  className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1"
                >
                  {filteredPoints.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Không tìm thấy điểm ngập nào phù hợp với bộ lọc
                    </div>
                  ) : (
                    filteredPoints.map((point) => {
                      const isSelected = selectedPointId === point.id;

                      let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
                      let dotColor = 'bg-slate-400';
                      if (point.severityLevel === 'H') {
                        badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                        dotColor = 'bg-rose-500';
                      } else if (point.severityLevel === 'M') {
                        badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
                        dotColor = 'bg-amber-500';
                      } else {
                        badgeClass = 'bg-yellow-50 text-yellow-800 border-yellow-200';
                        dotColor = 'bg-yellow-500';
                      }

                      return (
                        <div
                          key={point.id}
                          onClick={() => focusPoint(point)}
                          className={`p-2.5 rounded-xl cursor-pointer transition-all border group ${
                            isSelected
                              ? 'bg-sky-50/90 border-sky-300 shadow-xs'
                              : 'hover:bg-white hover:shadow-xs border-transparent hover:border-slate-200/80'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded border uppercase tracking-wider flex items-center gap-1 ${badgeClass}`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                  Mức {point.severityLevel}
                                </span>

                                <span className="text-[10px] font-medium text-slate-400 truncate">
                                  {point.regionName}
                                </span>
                              </div>

                              <h3 className="text-xs sm:text-sm font-bold text-slate-800 group-hover:text-sky-600 transition-colors leading-snug">
                                {point.street}
                              </h3>

                              <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {point.ward}
                              </div>

                              {point.targetYear && (
                                <div className="text-[10px] text-emerald-800 font-semibold mt-1.5 pt-1 border-t border-slate-100 flex items-center gap-1">
                                  <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span className="truncate">{point.targetYear}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sidebar Footer */}
                <div className="p-3 bg-slate-50/80 border-t border-slate-200/80 text-[11px] text-slate-500 text-center">
                  Nhấp vào một điểm để định vị trên bản đồ
                </div>
              </div>
            </div>

            {/* 3 Weather Scenarios Presentation Cards (Tone đỏ mức H, ngắt dòng rõ nghĩa, nhấn mạnh số, icon xe ngập ở góc phải) */}
            <div className="mt-5 sm:mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Nhóm A */}
              <div
                onClick={() => {
                  if (selectedScenario === 'A') {
                    setSelectedScenario('all');
                  } else {
                    setSelectedScenario('A');
                    setSelectedSeverity('H');
                  }
                }}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer backdrop-blur-md relative overflow-hidden group shadow-xs hover:shadow-md ${
                  selectedScenario === 'A'
                    ? 'bg-rose-50/95 border-rose-600 ring-4 ring-rose-500/25 shadow-rose-600/15'
                    : 'bg-white/95 border-rose-200/90 hover:border-rose-400 hover:bg-rose-50/40'
                }`}
              >
                {/* Header card */}
                <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-rose-100">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <CloudRain className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono uppercase tracking-wide">
                        Mức H
                      </span>
                      <span className="text-xs font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                        21 vị trí
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-rose-700 transition-colors mt-0.5 leading-snug">
                      Nhóm A: Ngập khi mưa lớn
                    </h3>
                  </div>
                </div>

                {/* Nội dung khuyến cáo ngắt dòng, nhấn mạnh số liệu */}
                <div className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0"></span>
                    <p>
                      Nước dâng nhanh trong cơn mưa từ{' '}
                      <strong className="text-rose-700 font-black px-1.5 py-0.5 rounded bg-rose-100 font-mono">
                        30mm trở lên
                      </strong>
                      , nước sẽ rút sau mưa.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0"></span>
                    <p>
                      Cần hạn chế đi vào hoặc chờ tạnh mưa{' '}
                      <strong className="text-rose-700 font-black px-1.5 py-0.5 rounded bg-rose-100 font-mono">
                        30 – 45 phút
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              </div>

              {/* Nhóm B */}
              <div
                onClick={() => {
                  if (selectedScenario === 'B') {
                    setSelectedScenario('all');
                  } else {
                    setSelectedScenario('B');
                    setSelectedSeverity('H');
                  }
                }}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer backdrop-blur-md relative overflow-hidden group shadow-xs hover:shadow-md ${
                  selectedScenario === 'B'
                    ? 'bg-rose-50/95 border-rose-600 ring-4 ring-rose-500/25 shadow-rose-600/15'
                    : 'bg-white/95 border-rose-200/90 hover:border-rose-400 hover:bg-rose-50/40'
                }`}
              >
                {/* Header card */}
                <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-rose-100">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <Waves className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono uppercase tracking-wide">
                        Mức H
                      </span>
                      <span className="text-xs font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                        9 vị trí
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-rose-700 transition-colors mt-0.5 leading-snug">
                      Nhóm B: Ngập khi triều cường
                    </h3>
                  </div>
                </div>

                {/* Nội dung khuyến cáo ngắt dòng, nhấn mạnh số liệu */}
                <div className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed mb-3">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0"></span>
                    <p>
                      Ngập theo chu kỳ con nước{' '}
                      <strong className="text-rose-700 font-black px-1.5 py-0.5 rounded bg-rose-100">
                        rằm
                      </strong>{' '}
                      và{' '}
                      <strong className="text-rose-700 font-black px-1.5 py-0.5 rounded bg-rose-100">
                        mồng 1 Âm lịch
                      </strong>
                      .
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-2 shrink-0"></span>
                    <p>
                      Khung giờ cao điểm:{' '}
                      <strong className="text-rose-700 font-black px-1 py-0.5 rounded bg-rose-100 font-mono">
                        5h00 – 8h00
                      </strong>{' '}
                      và{' '}
                      <strong className="text-rose-700 font-black px-1 py-0.5 rounded bg-rose-100 font-mono">
                        16h00 – 20h00
                      </strong>{' '}
                      (kể cả trời nắng ráo).
                    </p>
                  </div>
                </div>

                {/* Hộp tiến độ dự án 570km² */}
                <div className="text-xs sm:text-sm text-rose-950 bg-rose-100/80 p-3 rounded-xl border border-rose-200 font-medium leading-relaxed">
                  Dự án ngăn triều{' '}
                  <strong className="text-rose-800 font-black font-mono">
                    570km²
                  </strong>{' '}
                  hiện đạt{' '}
                  <strong className="text-rose-800 font-black font-mono">
                    93%
                  </strong>{' '}
                  khối lượng; hoàn thành chậm nhất năm{' '}
                  <strong className="text-rose-800 font-black font-mono">
                    2027
                  </strong>{' '}
                  sẽ giải quyết dứt điểm{' '}
                  <strong className="text-rose-800 font-black font-mono">
                    8/9
                  </strong>{' '}
                  vị trí ngập do triều.
                </div>
              </div>

              {/* Nhóm C */}
              <div
                onClick={() => {
                  if (selectedScenario === 'C') {
                    setSelectedScenario('all');
                  } else {
                    setSelectedScenario('C');
                    setSelectedSeverity('H');
                  }
                }}
                className={`p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer backdrop-blur-md relative overflow-hidden group shadow-xs hover:shadow-md ${
                  selectedScenario === 'C'
                    ? 'bg-rose-50/95 border-rose-600 ring-4 ring-rose-500/25 shadow-rose-600/15'
                    : 'bg-white/95 border-rose-200/90 hover:border-rose-400 hover:bg-rose-50/40'
                }`}
              >
                {/* Header card */}
                <div className="flex items-center gap-2.5 mb-3 pb-3 border-b border-rose-100">
                  <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 shadow-xs">
                    <ShieldAlert className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-black px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono uppercase tracking-wide">
                        Mức H
                      </span>
                      <span className="text-xs font-extrabold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                        20 vị trí
                      </span>
                    </div>
                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900 group-hover:text-rose-700 transition-colors mt-0.5 leading-snug">
                      Nhóm C: Ngập kép Mưa + Triều
                    </h3>
                  </div>
                </div>

                {/* Nội dung khuyến cáo ngắt dòng, nhấn mạnh */}
                <div className="space-y-2 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-2 shrink-0"></span>
                    <p>
                      Đây là nhóm{' '}
                      <strong className="text-rose-700 font-black px-1.5 py-0.5 rounded bg-rose-100 uppercase tracking-tight">
                        “điểm nóng” rủi ro cao nhất
                      </strong>
                      .
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-2 shrink-0"></span>
                    <p>
                      Mưa lớn gặp triều cường: nước từ sông rạch chảy ngược vào
                      cống làm mất khả năng tự chảy.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-600 mt-2 shrink-0"></span>
                    <p>
                      Gây ngập sâu cục bộ và kéo dài{' '}
                      <strong className="text-rose-700 font-black px-1.5 py-0.5 rounded bg-rose-100">
                        nhiều giờ
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Floating Guide Button dạng dấu chấm hỏi ở góc màn hình */}
      <button
        onClick={() => setIsGuideOpen(true)}
        className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 flex items-center gap-2.5 px-3.5 py-2.5 sm:px-4 sm:py-3 bg-white/95 hover:bg-white text-slate-800 hover:text-sky-600 font-extrabold text-xs sm:text-sm rounded-full shadow-xl shadow-slate-900/10 border border-slate-200/90 backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 group ring-4 ring-sky-500/10"
        title="Xem hướng dẫn phân loại & kịch bản thời tiết"
        aria-label="Mở hướng dẫn"
      >
        <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-700 group-hover:bg-sky-600 group-hover:text-white flex items-center justify-center transition-colors font-black text-sm">
          ?
        </span>
        <span className="tracking-tight">Hướng dẫn</span>
      </button>

      {/* Modal Hướng dẫn giải thích kịch bản thời tiết và mức độ ngập */}
      {isGuideOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsGuideOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200/80 overflow-hidden relative max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center font-black">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    Hướng Dẫn &amp; Ý Nghĩa Phân Loại
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ý nghĩa các kịch bản thời tiết (A, B, C) và phân loại mức độ ngập (H, M, L)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGuideOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-200/70 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                aria-label="Đóng cửa sổ hướng dẫn"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
              {/* PHẦN 1: MỨC ĐỘ NGẬP */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  1. Phân loại mức độ ngập (H, M, L)
                </h3>
                <div className="space-y-2.5">
                  {/* Mức H */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-start gap-3">
                    <span className="px-2.5 py-1 rounded-xl bg-rose-600 text-white font-extrabold text-xs shrink-0 font-mono shadow-xs">
                      Mức H
                    </span>
                    <div>
                      <h4 className="font-bold text-rose-950 text-xs sm:text-sm">
                        Ngập nặng / Ngập thường xuyên
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                        Các vị trí trũng thấp, ngập sâu khi lượng mưa từ 30mm trở lên hoặc triều cường dâng cao. Nước gây chết máy phương tiện và cản trở lưu thông; thời gian nước rút sau 30-45 phút khi dứt mưa hoặc theo con nước triều.
                      </p>
                    </div>
                  </div>

                  {/* Mức M */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 flex items-start gap-3">
                    <span className="px-2.5 py-1 rounded-xl bg-amber-600 text-white font-extrabold text-xs shrink-0 font-mono shadow-xs">
                      Mức M
                    </span>
                    <div>
                      <h4 className="font-bold text-amber-950 text-xs sm:text-sm">
                        Ngập vừa
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                        Ngập trong thời gian diễn ra mưa to; độ sâu ngập trung bình từ 10cm đến 15cm. Thời gian nước rút nhanh dưới 30 phút sau khi mưa giảm.
                      </p>
                    </div>
                  </div>

                  {/* Mức L */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-yellow-50/70 border border-yellow-200 flex items-start gap-3">
                    <span className="px-2.5 py-1 rounded-xl bg-yellow-500 text-slate-900 font-extrabold text-xs shrink-0 font-mono shadow-xs">
                      Mức L
                    </span>
                    <div>
                      <h4 className="font-bold text-yellow-950 text-xs sm:text-sm">
                        Ngập nhẹ
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                        Đọng nước cục bộ mép đường hoặc hố ga thu gom, độ sâu ngập dưới 10cm. Thời gian nước rút nhanh chóng dưới 30 phút, phương tiện lưu thông an toàn.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* PHẦN 2: 3 KỊCH BẢN THỜI TIẾT */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  2. Ba kịch bản thời tiết &amp; khu vực (Áp dụng cho 50 điểm ngập nặng)
                </h3>
                <div className="space-y-2.5">
                  {/* Nhóm A */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                      <CloudRain className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        Nhóm A: Ngập khi mưa lớn (21 vị trí mức H)
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                        {SCENARIO_META.A.advice}
                      </p>
                    </div>
                  </div>

                  {/* Nhóm B */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                      <Waves className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        Nhóm B: Ngập khi triều cường (9 vị trí mức H)
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                        {SCENARIO_META.B.advice}
                      </p>
                    </div>
                  </div>

                  {/* Nhóm C */}
                  <div className="p-3 sm:p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs sm:text-sm">
                        Nhóm C: Ngập kép do mưa và triều cường (20 vị trí mức H)
                      </h4>
                      <p className="text-slate-600 text-xs sm:text-sm mt-0.5 leading-relaxed">
                        {SCENARIO_META.C.advice}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Modal */}
            <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
              <button
                onClick={() => setIsGuideOpen(false)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm transition-colors cursor-pointer shadow-sm"
              >
                Đã hiểu &amp; Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
