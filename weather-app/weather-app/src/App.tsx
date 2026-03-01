import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  cToF,
  dayOfWeek,
  fetchWeather,
  fmtTemp,
  geocode,
  weatherCodeToText,
  type GeoResult,
  type WeatherResult
} from "./lib";

type Unit = "C" | "F";

function labelForPlace(p: GeoResult) {
  const parts = [p.name, p.admin1, p.country].filter(Boolean);
  return parts.join(", ");
}

export default function App() {
  const [query, setQuery] = useState<string>("Newark");
  const [unit, setUnit] = useState<Unit>("F");
  const [places, setPlaces] = useState<GeoResult[]>([]);
  const [selected, setSelected] = useState<GeoResult | null>(null);
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const currentTemp = useMemo(() => {
    if (!weather) return null;
    const c = weather.current.temperature_2m;
    return unit === "F" ? cToF(c) : c;
  }, [weather, unit]);

  const feelsLike = useMemo(() => {
    if (!weather) return null;
    const c = weather.current.apparent_temperature;
    return unit === "F" ? cToF(c) : c;
  }, [weather, unit]);

  async function runSearch(name: string) {
    setErr(null);
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await geocode(name, ctrl.signal);
      setPlaces(res);
      setSelected(res[0] ?? null);
      if (!res[0]) {
        setWeather(null);
        setErr("No results. Try a nearby city or add a country/state.");
      }
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message ?? "Search failed");
      setWeather(null);
      setPlaces([]);
      setSelected(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadWeather(p: GeoResult) {
    setErr(null);
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const w = await fetchWeather(p.latitude, p.longitude, p.timezone, ctrl.signal);
      setWeather(w);
    } catch (e: any) {
      if (e?.name === "AbortError") return;
      setErr(e?.message ?? "Weather load failed");
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // initial
    runSearch("Newark");
  }, []);

  useEffect(() => {
    if (selected) loadWeather(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    runSearch(query.trim());
  }

  async function useMyLocation() {
    setErr(null);
    if (!navigator.geolocation) {
      setErr("Geolocation not supported in this browser.");
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          // Reverse geocode isn't in open-meteo free; we can just fetch with auto timezone and label coords
          const pseudo: GeoResult = {
            name: "Your location",
            latitude,
            longitude,
            timezone: "auto"
          };
          setPlaces([pseudo]);
          setSelected(pseudo);
        } catch (e: any) {
          setErr(e?.message ?? "Failed to use location");
        } finally {
          setLoading(false);
        }
      },
      (ge) => {
        setLoading(false);
        setErr(ge.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  const placeLabel = selected ? labelForPlace(selected) : "—";
  const status = weather ? weatherCodeToText(weather.current.weather_code) : "—";

  const daily = useMemo(() => {
    if (!weather) return [];
    return weather.daily.time.map((d, i) => {
      const maxC = weather.daily.temperature_2m_max[i];
      const minC = weather.daily.temperature_2m_min[i];
      const max = unit === "F" ? cToF(maxC) : maxC;
      const min = unit === "F" ? cToF(minC) : minC;
      const pop = weather.daily.precipitation_probability_max?.[i];
      const code = weather.daily.weather_code[i];
      return { date: d, dow: dayOfWeek(d), max, min, pop, code };
    });
  }, [weather, unit]);

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <div className="logo" aria-hidden="true" />
          <div>
            <p className="h1">Weather</p>
            <p className="sub">Real-time + 5-day forecast (Open-Meteo)</p>
          </div>
        </div>

        <div className="controls">
          <label className="badge" title="Temperature units">
            Units
            <select className="select" value={unit} onChange={(e) => setUnit(e.target.value as any)}>
              <option value="F">°F</option>
              <option value="C">°C</option>
            </select>
          </label>
        </div>
      </div>

      <div className="row">
        <div className="panel">
          <form className="controls" onSubmit={onSubmit}>
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a city (e.g., Newark, London, Tokyo)"
              spellCheck={false}
            />
            <button className="btn" disabled={loading || !query.trim()}>
              {loading ? "Loading..." : "Search"}
            </button>
            <button className="btn secondary" type="button" onClick={useMyLocation} disabled={loading}>
              Use my location
            </button>

            {places.length > 1 && (
              <select
                className="select"
                value={selected ? labelForPlace(selected) : ""}
                onChange={(e) => {
                  const p = places.find((x) => labelForPlace(x) === e.target.value);
                  if (p) setSelected(p);
                }}
                title="Multiple matches found"
              >
                {places.map((p) => (
                  <option key={`${p.latitude},${p.longitude}`} value={labelForPlace(p)}>
                    {labelForPlace(p)}
                  </option>
                ))}
              </select>
            )}
          </form>

          <div className="kpis">
            <div className="kpi">
              <div className="label">Location</div>
              <div className="value" style={{ fontSize: 18, lineHeight: 1.2 }}>{placeLabel}</div>
              <div className="hint">{weather ? `Timezone: ${weather.timezone}` : "—"}</div>
            </div>
            <div className="kpi">
              <div className="label">Now</div>
              <div className="value">{currentTemp == null ? "—" : fmtTemp(currentTemp, unit)}</div>
              <div className="hint">{status}</div>
            </div>
            <div className="kpi">
              <div className="label">Feels like</div>
              <div className="value">{feelsLike == null ? "—" : fmtTemp(feelsLike, unit)}</div>
              <div className="hint">
                {weather ? `Humidity: ${weather.current.relative_humidity_2m}% · Wind: ${Math.round(weather.current.wind_speed_10m)} km/h` : "—"}
              </div>
            </div>
          </div>

          {err && <div className="error">{err}</div>}
        </div>

        <div className="panel">
          <div className="grid">
            <div>
              <div className="label">5-day forecast</div>
              <div className="forecast">
                {daily.length === 0 ? (
                  <div className="day">Search a city to see forecast.</div>
                ) : (
                  daily.map((d) => (
                    <div key={d.date} className="day">
                      <div className="dow">{d.dow}</div>
                      <div className="temps">
                        High: <b>{fmtTemp(d.max, unit)}</b>
                        <br />
                        Low: <b>{fmtTemp(d.min, unit)}</b>
                      </div>
                      <div className="badge" title={`WMO code ${d.code}`}>
                        {weatherCodeToText(d.code)}
                      </div>
                      {typeof d.pop === "number" && (
                        <div className="hint" style={{ marginTop: 10 }}>
                          Precip chance: {d.pop}%
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="footer">
              <span>Data: Open-Meteo (no API key)</span>
              <span>
                Tip: try “Newark NJ”, “Paris France”, “San Juan PR”
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
