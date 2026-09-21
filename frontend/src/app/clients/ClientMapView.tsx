"use client";

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Briefcase, Globe, Users, Navigation } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Fix for default marker icons in Leaflet with Next.js
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// Since clients don't have lat/lng in the schema yet, we generate stable pseudo-random coordinates around a center point
const generateCoordinates = (id: number) => {
  const baseLat = 37.7749; // SF Base
  const baseLng = -122.4194;
  
  // Use client ID to deterministically offset
  const latOffset = (Math.sin(id * 10) * 0.5);
  const lngOffset = (Math.cos(id * 10) * 0.5);
  
  return [baseLat + latOffset, baseLng + lngOffset] as [number, number];
};

interface Client {
  id: number;
  projectName: string;
  category: string;
  email: string;
  status: string;
  keywords: string[];
  website?: string;
  websiteUrl?: string;
  services_offered?: string;
  services_requested?: string;
  companyName?: string;
  lastActivity?: string;
  lastActivityDate?: string;
  assignedEmployeeName?: string;
}

interface ClientMapViewProps {
  clients: Client[];
  statuses: { id: number; name: string; color: string }[];
}

function MapUpdater({ clients }: { clients: Client[] }) {
  const map = useMap();
  useEffect(() => {
    if (clients.length > 0) {
      const coords = clients.map(c => generateCoordinates(c.id));
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [clients, map]);
  return null;
}

export default function ClientMapView({ clients, statuses }: ClientMapViewProps) {
  const router = useRouter();

  const parseServices = (str?: string) => {
    if (!str) return null;
    try {
      const parsed = JSON.parse(str);
      if (Array.isArray(parsed)) return parsed.map((s: any) => s.name || s).join(', ');
      return str;
    } catch {
      return str;
    }
  };

  if (!clients || clients.length === 0) {
    return (
      <div className="w-full h-[600px] glass-card rounded-[2.5rem] flex items-center justify-center border border-white/10 dark:border-white/5">
        <p className="text-slate-400 font-bold">No clients to display on map.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] glass-card rounded-[2.5rem] overflow-hidden border border-white/10 dark:border-white/5 relative z-0">
      <MapContainer 
        center={[37.7749, -122.4194]} 
        zoom={10} 
        scrollWheelZoom={true} 
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" // Dark theme tile layer
        />
        <MapUpdater clients={clients} />
        
        {clients.map((client) => {
          const coords = generateCoordinates(client.id);
          const statusObj = statuses.find(s => s.name === client.status);
          const servicesOffered = parseServices(client.services_offered);

          return (
            <Marker key={client.id} position={coords} icon={icon}>
              <Popup className="custom-popup">
                <div className="p-1 min-w-[200px]">
                  <h3 className="font-bold text-lg text-slate-800 mb-1">{client.companyName || client.projectName || 'Unnamed Client'}</h3>
                  
                  <div className="flex items-center gap-1.5 mb-3">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusObj?.color.replace('bg-', '') || '#6366f1' }} />
                    <span className="text-xs font-semibold text-slate-600">{client.status}</span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Globe className="w-3.5 h-3.5" />
                      <span className="truncate">{client.website || client.websiteUrl || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5" />
                      <span className="truncate">{client.assignedEmployeeName || 'Unassigned'}</span>
                    </div>
                    {servicesOffered && (
                      <div className="flex items-start gap-2 text-xs text-slate-500">
                        <Briefcase className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{servicesOffered}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={(e) => { e.stopPropagation(); router.push(`/admin/clients/${client.id}`); }}
                      className="flex-1 bg-indigo-50 text-indigo-700 py-2 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors"
                    >
                      Open Client
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); router.push(`/admin/clients/${client.id}/competitors`); }}
                      className="flex-[1.5] bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2 rounded-lg text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1"
                    >
                      <Navigation className="w-3 h-3" /> Radar
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
      
      {/* Custom styles to make leaflet popup dark/glassmorphic friendly if we want, or at least rounded */}
      <style>{`
        .leaflet-popup-content-wrapper {
          border-radius: 1rem;
          box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .leaflet-popup-content {
          margin: 12px 14px;
        }
      `}</style>
    </div>
  );
}
