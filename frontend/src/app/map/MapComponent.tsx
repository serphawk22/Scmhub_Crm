"use client";
import { useEffect, useRef } from "react";
import type { MapPin } from "./page";

// Geocode via Nominatim (free)
async function geocodeAddress(address: string): Promise<[number, number] | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`,
      { headers: { "User-Agent": "SerpHawk-CRM/1.0" } }
    );
    const data = await res.json();
    if (data && data[0]) {
      return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
    }
  } catch { }
  return null;
}

const PIN_COLORS: Record<string, string> = {
  client: "#22c55e",
  lead: "#3b82f6",
  competitor: "#ef4444",
};

export default function MapComponent({ pins }: { pins: MapPin[] }) {
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const initMap = async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (!containerRef.current) return;
      if (mapRef.current) {
        mapRef.current.remove();
      }

      const map = L.map(containerRef.current, {
        center: [20, 0],
        zoom: 2,
        zoomControl: true,
      });
      mapRef.current = map;

      // Dark tile layer that looks great
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© OpenStreetMap contributors © CARTO',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      // Clear old markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      // Add pins
      for (const pin of pins) {
        let lat = pin.lat, lng = pin.lng;

        if (!lat && !lng && pin.address) {
          const coords = await geocodeAddress(pin.address);
          if (coords) { lat = coords[0]; lng = coords[1]; }
        }

        if (!lat || !lng) continue;

        const color = PIN_COLORS[pin.type] || "#6366f1";

        const icon = L.divIcon({
          className: "",
          html: `
            <div style="
              width: 32px; height: 32px;
              background: ${color};
              border: 3px solid white;
              border-radius: 50% 50% 50% 0;
              transform: rotate(-45deg);
              box-shadow: 0 4px 12px rgba(0,0,0,0.4);
              display: flex; align-items: center; justify-content: center;
            ">
              <div style="transform: rotate(45deg); font-size: 12px; color: white; font-weight: bold;">
                ${pin.type === "client" ? "C" : pin.type === "lead" ? "L" : "X"}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          popupAnchor: [0, -36],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.bindPopup(`
          <div style="font-family: system-ui, sans-serif; min-width: 180px;">
            <div style="font-weight: 800; font-size: 14px; margin-bottom: 4px; color: #1e293b;">${pin.name}</div>
            <div style="display: inline-block; padding: 2px 8px; border-radius: 999px; background: ${color}22; color: ${color}; font-size: 11px; font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">
              ${pin.type}${pin.status ? " · " + pin.status : ""}
            </div>
            ${pin.address ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 4px;">📍 ${pin.address}</div>` : ""}
            ${pin.url ? `<a href="${pin.url}" style="font-size: 12px; color: #3b82f6; font-weight: 600; text-decoration: none;">View Details →</a>` : ""}
          </div>
        `);

        markersRef.current.push(marker);
      }
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [pins]);

  return (
    <div ref={containerRef} className="w-full h-full" style={{ minHeight: 400 }} />
  );
}
