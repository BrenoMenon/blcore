import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import type { CompanyPin } from "@/lib/marketplace";

const pin = (active: boolean) =>
  L.divIcon({
    className: "",
    html: `<span style="display:block;width:${active ? 20 : 14}px;height:${active ? 20 : 14}px;border-radius:9999px;background:#10B981;box-shadow:0 0 0 4px rgba(16,185,129,.28),0 4px 12px rgba(0,0,0,.4);border:2px solid #fff"></span>`,
    iconSize: [active ? 20 : 14, active ? 20 : 14],
    iconAnchor: [active ? 10 : 7, active ? 10 : 7],
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
            <strong>{c.name}</strong>
            <br />
            {[c.category, c.city].filter(Boolean).join(" · ")}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
