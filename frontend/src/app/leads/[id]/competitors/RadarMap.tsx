"use client";

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Navigation, Star } from 'lucide-react';

const clientIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Custom HTML Icons for Competitors to color code them
const createCompetitorIcon = (color: string) => L.divIcon({
  className: 'custom-comp-marker',
  html: `<div style="background-color: ${color}; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 10px ${color};"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
  popupAnchor: [0, -10]
});

const redIcon = createCompetitorIcon('#ef4444');
const orangeIcon = createCompetitorIcon('#f97316');
const greenIcon = createCompetitorIcon('#10b981');

function MapUpdater({ clientLat, clientLng, competitors }: any) {
  const map = useMap();
  useEffect(() => {
    if (competitors && competitors.length > 0) {
      const bounds = L.latLngBounds([
        [clientLat, clientLng],
        ...competitors.map((c: any) => [c.lat, c.lng] as [number, number])
      ]);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [clientLat, clientLng, competitors, map]);
  return null;
}

export default function RadarMap({ clientLat, clientLng, competitors, clientName }: any) {
  if (!clientLat || !clientLng) return <div className="h-full w-full flex items-center justify-center bg-black/20 text-slate-500">Loading Map Data...</div>;

  return (
    <div className="w-full h-full relative z-0 rounded-[1.8rem] overflow-hidden">
      <MapContainer 
        center={[clientLat, clientLng]} 
        zoom={12} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
        className="z-0 bg-black/20"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        
        <MapUpdater clientLat={clientLat} clientLng={clientLng} competitors={competitors} />

        {/* Radar Radius Circle */}
        <Circle 
          center={[clientLat, clientLng]} 
          radius={5000} // 5km radius
          pathOptions={{ color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.05, weight: 1, dashArray: '5, 5' }}
        />

        {/* Client Center Marker */}
        <Marker position={[clientLat, clientLng]} icon={clientIcon}>
          <Popup>
            <div className="font-bold text-slate-800">{clientName || 'Your Client'} (Center)</div>
          </Popup>
        </Marker>

        {/* Competitor Markers */}
        {competitors.map((comp: any) => {
          const icon = comp.pin_color === 'red' ? redIcon : comp.pin_color === 'orange' ? orangeIcon : greenIcon;
          
          return (
            <Marker key={comp.place_id || comp.id} position={[comp.lat, comp.lng]} icon={icon}>
              <Popup className="custom-popup">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{comp.name}</h3>
                  <div className="text-xs text-slate-500 mb-2">{comp.address}</div>
                  
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-slate-100 p-2 rounded">
                      <div className="text-[9px] text-slate-500 uppercase font-bold">Distance</div>
                      <div className="text-sm font-black text-slate-800">{comp.distance_km}km</div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded">
                      <div className="text-[9px] text-slate-500 uppercase font-bold">Market Score</div>
                      <div className="text-sm font-black text-slate-800">{comp.market_size_score}/100</div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded">
                      <div className="text-[9px] text-slate-500 uppercase font-bold">Team</div>
                      <div className="text-sm font-black text-slate-800">{comp.team_size_estimate}</div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded">
                      <div className="text-[9px] text-slate-500 uppercase font-bold">Overlap</div>
                      <div className="text-sm font-black text-slate-800">{comp.overlap_pct}%</div>
                    </div>
                  </div>
                  
                  {comp.maps_url && (
                    <a href={comp.maps_url} target="_blank" rel="noreferrer" className="block text-center w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-600 py-1.5 rounded text-xs font-bold transition-colors">
                      View on Maps ↗
                    </a>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
