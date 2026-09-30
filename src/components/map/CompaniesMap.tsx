import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { CompanyPin } from "@/lib/marketplace";

const pin = (active: boolean) =>
  L.divIcon({
    className: "bl-green-pin-container",
    html: `
      <div style="position:relative;width:${active ? 26 : 20}px;height:${active ? 26 : 20}px;display:flex;align-items:center;justify-content:center;">
        <span style="position:absolute;width:100%;height:100%;border-radius:9999px;background:#10B981;opacity:${active ? 0.45 : 0.25};animation:pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></span>
        <span style="position:relative;display:block;width:${active ? 16 : 12}px;height:${active ? 16 : 12}px;border-radius:9999px;background:#10B981;border:2px solid #ffffff;box-shadow:0 0 10px rgba(16,185,129,0.8), 0 2px 6px rgba(0,0,0,0.35);"></span>
      </div>
    `,
    iconSize: [active ? 26 : 20, active ? 26 : 20],
    iconAnchor: [active ? 13 : 10, active ? 13 : 10],
  });

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom() < 11 ? 12 : map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function CompaniesMap({
  companies,
  selectedId,
  onSelect,
}: {
  companies: CompanyPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const withGeo = companies.filter((c) => c.lat != null && c.lng != null);
  const selected = withGeo.find((c) => c.id === selectedId);
  const first = withGeo[0];
  const center: [number, number] = selected
    ? [selected.lat!, selected.lng!]
    : first
      ? [first.lat!, first.lng!]
      : [-23.5505, -46.6333];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "var(--muted)" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=cb1_3vbc_1_24c8c04b520e28a122fbbcb2"
      />
      <Recenter center={center} />
      {withGeo.map((c) => (
        <Marker
          key={c.id}
          position={[c.lat!, c.lng!]}
          icon={pin(c.id === selectedId)}
          eventHandlers={{ click: () => onSelect(c.id) }}
        >
          <Popup>
            <div className="space-y-1.5 text-xs text-foreground min-w-[130px]">
              <div className="flex items-center gap-1.5 font-bold text-sm">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
                <span>{c.name}</span>
              </div>
              <p className="text-[11px] text-muted-foreground m-0">
                {[c.category, c.city].filter(Boolean).join(" · ")}
              </p>
              <button
                type="button"
                className="mt-1 w-full rounded-md bg-emerald-600 px-2.5 py-1 text-center text-[11px] font-semibold text-white transition hover:bg-emerald-500 cursor-pointer"
                onClick={() => onSelect(c.id)}
              >
                Ver serviços
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
