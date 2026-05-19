// map.jsx — the spine of the page. Leaflet w/ custom pins.
const { useEffect, useRef, useState, useMemo } = React;

// ── pin SVGs ─────────────────────────────────────────────────────────────────
// Creator: circle pin (terracotta)
// Business: diamond/square pin (deep ink-blue)
// Shape signals type (a11y — color is not the only signal).
function makeCreatorIcon(active = false) {
  const fill   = "oklch(58% 0.16 35)";
  const stroke = "oklch(34% 0.10 35)";
  const size = active ? 38 : 30;
  const html = `
    <div class="pin-wrap" style="width:${size}px;height:${size}px;">
      ${active ? '<div class="pin-pulse" style="background:transparent"></div>' : ''}
      <svg class="pin-svg" width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="11" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
        <circle cx="16" cy="16" r="4" fill="white" opacity=".95"/>
      </svg>
    </div>`;
  return L.divIcon({ html, className: "pin-creator", iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function makeBusinessIcon(active = false) {
  const fill   = "oklch(34% 0.10 245)";
  const stroke = "oklch(22% 0.10 250)";
  const size = active ? 34 : 26;
  const html = `
    <div class="pin-wrap" style="width:${size}px;height:${size}px;">
      <svg class="pin-svg" width="${size}" height="${size}" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
        <rect x="6" y="6" width="20" height="20" fill="${fill}" stroke="${stroke}" stroke-width="2" transform="rotate(45 16 16)"/>
        <rect x="13" y="13" width="6" height="6" fill="white" opacity=".95" transform="rotate(45 16 16)"/>
      </svg>
    </div>`;
  return L.divIcon({ html, className: "pin-business", iconSize: [size, size], iconAnchor: [size/2, size/2] });
}

function makeClusterIcon(count, kind) {
  const isCreator = kind === "creator";
  const color = isCreator ? "oklch(58% 0.16 35)" : "oklch(34% 0.10 245)";
  const html = `
    <div style="
      width:44px;height:44px;border-radius:50%;
      background:${color};
      display:flex;align-items:center;justify-content:center;
      color:white;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;
      border:2px solid var(--paper);
      box-shadow:0 2px 8px oklch(0% 0 0 / .3);
    ">${count}</div>`;
  return L.divIcon({ html, className: "pin-cluster", iconSize: [44, 44], iconAnchor: [22, 22] });
}

// ── LiveMap component ────────────────────────────────────────────────────────
function LiveMap({
  filter,          // "all" | "creators" | "businesses"
  category,        // string
  region,          // string
  theme,           // "bright" | "ink"
  onSelectCreator,
  onSelectBusiness,
  searchQuery,
  initialView,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const layersRef = useRef({ creators: null, businesses: null });
  const [loading, setLoading] = useState(true);
  const [bounds, setBounds] = useState(null);

  // Init map once
  useEffect(() => {
    if (!elRef.current || mapRef.current) return;
    const m = L.map(elRef.current, {
      center: [12.5, 122.5],   // Philippines center
      zoom: 6,
      minZoom: 3,
      maxZoom: 16,
      zoomControl: true,
      scrollWheelZoom: false,  // avoid hijack on scroll
      attributionControl: true,
    });
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '© OpenStreetMap · © CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }
    ).addTo(m);

    mapRef.current = m;

    // simulate progressive load
    const t = setTimeout(() => setLoading(false), 700);

    // initial fit
    if (initialView === "manila") {
      m.setView([14.5995, 120.9842], 11);
    } else if (initialView === "globe") {
      m.setView([8, 30], 2);
    } else {
      // default: Philippines
      m.setView([12.5, 122.5], 6);
    }

    m.on("zoomend moveend", () => setBounds(m.getBounds()));

    return () => { clearTimeout(t); m.remove(); mapRef.current = null; };
  }, []);

  // Filter pins
  const visibleCreators = useMemo(() => {
    if (filter === "businesses") return [];
    let cs = window.CREATORS;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      cs = cs.filter(c => c.name.toLowerCase().includes(q) || c.city.toLowerCase().includes(q));
    }
    return cs;
  }, [filter, searchQuery]);

  const visibleBusinesses = useMemo(() => {
    if (filter === "creators") return [];
    let bs = window.BUSINESSES;
    if (category !== "All") bs = bs.filter(b => b.category === category);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      bs = bs.filter(b => b.name.toLowerCase().includes(q) || b.city.toLowerCase().includes(q));
    }
    return bs;
  }, [filter, category, searchQuery]);

  // Redraw markers
  useEffect(() => {
    const m = mapRef.current;
    if (!m || loading) return;

    // clear old
    if (layersRef.current.creators) m.removeLayer(layersRef.current.creators);
    if (layersRef.current.businesses) m.removeLayer(layersRef.current.businesses);

    const creatorLayer = L.layerGroup();
    visibleCreators.forEach(c => {
      const marker = L.marker([c.lat, c.lng], { icon: makeCreatorIcon(), keyboard: true, title: `${c.name} — ${c.city}` });
      marker.bindTooltip(
        `<div style="font-family:var(--sans);"><strong>${c.name}</strong> · ${c.city}<br><span style="font-family:var(--mono);font-size:10px;color:#888;letter-spacing:.08em;text-transform:uppercase;">Creator · ${c.sites} sites delivered</span></div>`,
        { direction: "top", offset: [0, -18], opacity: .95 }
      );
      marker.on("click", () => onSelectCreator && onSelectCreator(c));
      creatorLayer.addLayer(marker);
    });
    creatorLayer.addTo(m);
    layersRef.current.creators = creatorLayer;

    const businessLayer = L.layerGroup();
    visibleBusinesses.forEach(b => {
      const creator = window.CREATORS.find(c => c.id === b.creator);
      const marker = L.marker([b.lat, b.lng], { icon: makeBusinessIcon(), keyboard: true, title: `${b.name} — ${b.city}` });
      marker.bindTooltip(
        `<div style="font-family:var(--sans);"><strong>${b.name}</strong> · ${b.city}<br><span style="font-family:var(--mono);font-size:10px;color:#888;letter-spacing:.08em;text-transform:uppercase;">${b.category} · built by ${creator?.name || "—"}</span></div>`,
        { direction: "top", offset: [0, -14], opacity: .95 }
      );
      marker.on("click", () => onSelectBusiness && onSelectBusiness(b));
      businessLayer.addLayer(marker);
    });
    businessLayer.addTo(m);
    layersRef.current.businesses = businessLayer;
  }, [visibleCreators, visibleBusinesses, loading]);

  // theme swap → reset tile filter via CSS variable
  useEffect(() => {
    if (!mapRef.current) return;
    // tile filter handled by .leaflet-tile CSS rule based on html[data-theme]
    // force redraw
    setTimeout(() => mapRef.current.invalidateSize(), 50);
  }, [theme]);

  const focusCity = (cityName) => {
    const m = mapRef.current; if (!m) return;
    const c = window.CREATORS.find(c => c.city.toLowerCase().includes(cityName.toLowerCase()))
          || window.BUSINESSES.find(b => b.city.toLowerCase().includes(cityName.toLowerCase()));
    if (c) m.flyTo([c.lat, c.lng], 12, { duration: 1.0 });
  };
  // expose
  LiveMap.focusCity = focusCity;
  LiveMap.fitPhilippines = () => mapRef.current?.flyTo([12.5, 122.5], 6, { duration: 1.0 });
  LiveMap.fitGlobe = () => mapRef.current?.flyTo([8, 30], 2, { duration: 1.0 });
  LiveMap.flyTo = (center, zoom) => mapRef.current?.flyTo(center, zoom, { duration: 1.0 });

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={elRef} id="leafmap" />
      {loading && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--paper-2)", zIndex: 400,
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center" }}>
            <div className="label" style={{ marginBottom: 12 }}>
              <span className="live-dot" style={{ marginRight: 8 }}></span>
              Loading live data…
            </div>
            <div style={{
              width: 220, height: 1, background: "var(--rule)",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "var(--ink)",
                width: "30%",
                animation: "shimmer 1.6s linear infinite",
              }}></div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(400%); } }
      `}</style>
    </div>
  );
}

Object.assign(window, { LiveMap, makeCreatorIcon, makeBusinessIcon });
