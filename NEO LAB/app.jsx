// app.jsx — assembles the page + tweaks
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "bright",
  "doorPriority": "balanced",
  "lang": "en",
  "country": "PH",
  "scale": "growth",
  "refArrival": true,
  "mapView": "philippines"
}/*EDITMODE-END*/;

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  useEffectA(() => {
    document.documentElement.dataset.theme = t.theme;
  }, [t.theme]);

  const [door, setDoor] = useStateA(null);
  const [refDismissed, setRefDismissed] = useStateA(false);
  const [showStickyCTA, setShowStickyCTA] = useStateA(false);
  const [selectedCreator, setSelectedCreator] = useStateA(null);
  const [selectedBusiness, setSelectedBusiness] = useStateA(null);
  const [beFirstCity, setBeFirstCity] = useStateA(null);

  const [filter, setFilter] = useStateA("all");
  const [category, setCategory] = useStateA("All");
  const [search, setSearch] = useStateA("");
  const [listMode, setListMode] = useStateA(false);

  const T = window.STRINGS[t.lang] || window.STRINGS.en;
  const counters = window.COUNTERS[t.scale] || window.COUNTERS.growth;

  const pickDoor = (d) => {
    setDoor(d);
    try { localStorage.setItem("nd-door", d); } catch (e) {}
  };

  useEffectA(() => {
    try {
      const saved = localStorage.getItem("nd-door");
      if (saved) setDoor(saved);
    } catch (e) {}
  }, []);

  useEffectA(() => {
    const onScroll = () => { setShowStickyCTA(window.scrollY > 640); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToMap = () => {
    const el = document.getElementById("map-anchor");
    if (el) window.scrollTo({ top: el.offsetTop - 40, behavior: "smooth" });
  };

  useEffectA(() => {
    if (door) return;
    if (t.doorPriority === "creator-first") setDoor("creator");
    else if (t.doorPriority === "business-first") setDoor("business");
  }, [t.doorPriority]);

  const refName = "Mark";
  const refCity = "Cebu";

  return (
    <>
      {t.refArrival && !refDismissed && (
        <ReferralBanner
          refName={refName} refCity={refCity}
          onDismiss={()=>setRefDismissed(true)}
        />
      )}
      <TopBar
        lang={t.lang} country={t.country}
        onLangChange={(v)=>setTweak("lang", v)}
        onCountryChange={(v)=>setTweak("country", v)}
      />

      <Hero T={T} counters={counters} onPickDoor={pickDoor} />

      <div id="map-anchor"></div>
      <MapSection
        T={T}
        filter={filter} setFilter={setFilter}
        category={category} setCategory={setCategory}
        search={search} setSearch={setSearch}
        listMode={listMode} setListMode={setListMode}
        mapView={t.mapView} setMapView={(v)=>setTweak("mapView", v)}
        theme={t.theme}
        onSelectCreator={setSelectedCreator}
        onSelectBusiness={setSelectedBusiness}
        onBeFirst={setBeFirstCity}
      />

      <HowItWorks door={door} />

      <TheProcess />

      <Manifesto />

      <Directory
        counters={counters} T={T}
        onSelectCreator={setSelectedCreator}
        onSelectBusiness={setSelectedBusiness}
      />

      <FAQ />

      <FinalCTA onPickDoor={pickDoor} />

      <Footer
        lang={t.lang} country={t.country}
        onLangChange={(v)=>setTweak("lang", v)}
        onCountryChange={(v)=>setTweak("country", v)}
      />

      <StickyCTA visible={showStickyCTA} onPickDoor={pickDoor} door={door} />

      <CreatorSheet creator={selectedCreator} onClose={()=>setSelectedCreator(null)} />
      <BusinessSheet business={selectedBusiness} onClose={()=>setSelectedBusiness(null)} />

      <BeTheFirstModal
        city={beFirstCity}
        onClose={()=>setBeFirstCity(null)}
        onPickDoor={pickDoor}
      />

      <ChatBot />

      {/* Tweaks panel */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme" />
        <TweakRadio
          label="Mode" value={t.theme}
          options={["bright", "ink"]}
          onChange={(v)=>setTweak("theme", v)}
        />
        <TweakSection label="Audience priority" />
        <TweakRadio
          label="Order"
          value={t.doorPriority}
          options={["balanced", "business-first", "creator-first"]}
          onChange={(v)=>setTweak("doorPriority", v)}
        />
        <TweakSection label="Locale" />
        <TweakRadio
          label="Language" value={t.lang}
          options={["en", "tl"]}
          onChange={(v)=>setTweak("lang", v)}
        />
        <TweakSelect
          label="Country" value={t.country}
          options={["PH", "ID", "MX", "VN"]}
          onChange={(v)=>setTweak("country", v)}
        />
        <TweakSection label="Stage" />
        <TweakRadio
          label="Platform scale" value={t.scale}
          options={["early", "growth"]}
          onChange={(v)=>setTweak("scale", v)}
        />
        <TweakSection label="Referral" />
        <TweakToggle
          label="Show ?ref= arrival" value={t.refArrival}
          onChange={(v)=>{ setTweak("refArrival", v); setRefDismissed(false); }}
        />
        <TweakSection label="Map" />
        <TweakRadio
          label="Default view" value={t.mapView}
          options={["philippines", "manila", "globe"]}
          onChange={(v)=>{
            setTweak("mapView", v);
            if (v === "philippines") window.LiveMap?.fitPhilippines?.();
            else if (v === "globe") window.LiveMap?.fitGlobe?.();
            else if (v === "manila") window.LiveMap?.focusCity?.("Manila");
          }}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
