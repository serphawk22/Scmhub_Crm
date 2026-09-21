'use client';
import React, { useEffect, useRef } from 'react';

interface Competitor {
  place_id: string;
  name: string;
  lat: number;
  lng: number;
  address: string;
  distance_km: number;
  market_size_score: number;
  team_size_estimate: string;
  overlap_pct: number;
  matched_services: string[];
  pin_color: string;
  rating?: number;
  reviews?: number;
  maps_url?: string;
  website?: string;
  category?: string;
}

interface Target {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  rating?: number;
  reviews?: number;
  phone?: string;
  website?: string;
}

interface RadarMapProps {
  target: Target | null;
  competitors: Competitor[];
  radiusKm: number;
  onCompetitorClick?: (c: Competitor) => void;
}

const PIN_SVG: Record<string, string> = {
  red:    'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#ef4444"/><circle cx="16" cy="16" r="6" fill="white"/></svg>'),
  orange: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#f97316"/><circle cx="16" cy="16" r="6" fill="white"/></svg>'),
  yellow: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#eab308"/><circle cx="16" cy="16" r="6" fill="white"/></svg>'),
  green:  'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#22c55e"/><circle cx="16" cy="16" r="6" fill="white"/></svg>'),
  blue:   'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 24 16 24s16-12 16-24C32 7.16 24.84 0 16 0z" fill="#6366f1"/><circle cx="16" cy="16" r="6" fill="white"/><circle cx="16" cy="16" r="3" fill="#6366f1"/></svg>'),
};

export default function RadarMap({ target, competitors, radiusKm, onCompetitorClick }: RadarMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    if (!target) return;

    const center = { lat: target.lat, lng: target.lng };

    if (!mapInstanceRef.current) {
      mapInstanceRef.current = new google.maps.Map(mapRef.current, {
        center,
        zoom: radiusKm <= 2 ? 15 : radiusKm <= 5 ? 14 : radiusKm <= 10 ? 13 : 12,
        mapTypeId: 'roadmap',
        styles: [
          { featureType: 'all', elementType: 'geometry', stylers: [{ color: '#1a1a2e' }] },
          { featureType: 'all', elementType: 'labels.text.fill', stylers: [{ color: '#a0aec0' }] },
          { featureType: 'all', elementType: 'labels.text.stroke', stylers: [{ color: '#000000' }] },
          { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2d3748' }] },
          { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
          { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
          { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
        ],
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: false,
        streetViewControl: false,
      });
    } else {
      mapInstanceRef.current.panTo(center);
      mapInstanceRef.current.setZoom(radiusKm <= 2 ? 15 : radiusKm <= 5 ? 14 : radiusKm <= 10 ? 13 : 12);
    }

    const map = mapInstanceRef.current;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (circleRef.current) circleRef.current.setMap(null);
    if (infoWindowRef.current) infoWindowRef.current.close();
    infoWindowRef.current = new google.maps.InfoWindow();

    // Radius circle
    circleRef.current = new google.maps.Circle({
      map,
      center,
      radius: radiusKm * 1000,
      strokeColor: '#6366f1',
      strokeOpacity: 0.5,
      strokeWeight: 2,
      fillColor: '#6366f1',
      fillOpacity: 0.05,
    });

    // Target pin (blue star)
    const targetMarker = new google.maps.Marker({
      position: center,
      map,
      icon: { url: PIN_SVG.blue, scaledSize: new google.maps.Size(40, 50), anchor: new google.maps.Point(20, 50) },
      title: target.name,
      zIndex: 1000,
    });
    targetMarker.addListener('click', () => {
      infoWindowRef.current?.setContent(`
        <div style="background:#1e293b;color:#f1f5f9;padding:12px 16px;border-radius:10px;min-width:220px;font-family:sans-serif">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <div style="background:#6366f1;color:white;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px">TARGET</div>
          </div>
          <div style="font-size:15px;font-weight:800;margin-bottom:4px">${target.name}</div>
          ${target.address ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${target.address}</div>` : ''}
          ${target.rating ? `<div style="font-size:12px;color:#fbbf24">⭐ ${target.rating} (${target.reviews || 0} reviews)</div>` : ''}
          ${target.phone ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">📞 ${target.phone}</div>` : ''}
        </div>`);
      infoWindowRef.current?.open(map, targetMarker);
    });
    markersRef.current.push(targetMarker);

    // Competitor pins
    competitors.forEach(c => {
      const marker = new google.maps.Marker({
        position: { lat: c.lat, lng: c.lng },
        map,
        icon: { url: PIN_SVG[c.pin_color] || PIN_SVG.green, scaledSize: new google.maps.Size(28, 36), anchor: new google.maps.Point(14, 36) },
        title: c.name,
      });
      marker.addListener('click', () => {
        const colorBadge: Record<string, string> = { red: '#ef4444', orange: '#f97316', yellow: '#eab308', green: '#22c55e' };
        const bg = colorBadge[c.pin_color] || '#6b7280';
        const label = c.overlap_pct >= 70 ? 'Direct Competitor' : c.overlap_pct >= 50 ? 'Strong Competitor' : c.overlap_pct >= 30 ? 'Moderate Competitor' : 'Weak Competitor';
        infoWindowRef.current?.setContent(`
          <div style="background:#1e293b;color:#f1f5f9;padding:12px 16px;border-radius:10px;min-width:240px;font-family:sans-serif">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <div style="background:${bg};color:white;border-radius:6px;padding:4px 8px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px">${label}</div>
            </div>
            <div style="font-size:15px;font-weight:800;margin-bottom:4px">${c.name}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:6px">${c.address || ''}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:8px">
              <div style="background:#0f172a;border-radius:6px;padding:4px 8px"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Distance</div><div style="font-size:13px;font-weight:700">${c.distance_km} km</div></div>
              <div style="background:#0f172a;border-radius:6px;padding:4px 8px"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Market Score</div><div style="font-size:13px;font-weight:700">${c.market_size_score}/100</div></div>
              <div style="background:#0f172a;border-radius:6px;padding:4px 8px"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Team Size</div><div style="font-size:13px;font-weight:700">${c.team_size_estimate}</div></div>
              <div style="background:#0f172a;border-radius:6px;padding:4px 8px"><div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Overlap</div><div style="font-size:13px;font-weight:700">${c.overlap_pct}%</div></div>
            </div>
            ${c.matched_services.length > 0 ? `<div style="font-size:10px;color:#818cf8;margin-bottom:4px">Services: ${c.matched_services.join(', ')}</div>` : ''}
            ${c.maps_url ? `<a href="${c.maps_url}" target="_blank" style="color:#818cf8;font-size:11px;text-decoration:underline">View on Google Maps ↗</a>` : ''}
          </div>`);
        infoWindowRef.current?.open(map, marker);
        if (onCompetitorClick) onCompetitorClick(c);
      });
      markersRef.current.push(marker);
    });
  }, [target, competitors, radiusKm]);

  return (
    <div
      ref={mapRef}
      className="w-full h-full rounded-2xl overflow-hidden"
      style={{ minHeight: '500px' }}
    />
  );
}
