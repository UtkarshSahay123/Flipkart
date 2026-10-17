import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl, useMap } from 'react-leaflet';
import { useRoadGuard } from '../../context/RoadGuardContext';
import { ISSUE_CATEGORIES } from '../../data/mockData';
import { StatusBadge } from '../../components/common/StatusBadge';
import { PriorityBadge } from '../../components/common/PriorityBadge';
import { IssueDetailDrawer } from '../issues/IssueDetailDrawer';
import {
  MapPin,
  Eye,
  Layers,
  AlertTriangle
} from 'lucide-react';
import 'leaflet/dist/leaflet.css';

function MapViewController({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 0.8 }); }, [center, zoom, map]);
  return null;
}

function createIssueIcon(priority, reportCount) {
  const colors = { Critical: '#b91c1c', High: '#ef4444', Medium: '#2563eb', Low: '#64748b' };
  const size = Math.min(52, 32 + Math.max(0, Number(reportCount || 1) - 1) * 2);
  const color = colors[priority] || colors.Medium;
  return L.divIcon({
    className: 'custom-incident-icon',
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:800;font-size:12px;box-shadow:0 2px 8px #0006">${Number(reportCount || 1)}</div>`,
    iconSize: [size, size], iconAnchor: [size / 2, size / 2]
  });
}

const userLocationIcon = L.divIcon({
  className: 'user-location-icon',
  html: '<div style="width:18px;height:18px;border:3px solid white;border-radius:50%;background:#2563eb;box-shadow:0 0 0 8px #2563eb33,0 2px 8px #0006"></div>',
  iconSize: [18, 18], iconAnchor: [9, 9]
});

export const LiveIssueMapPage = () => {
  const [searchParams] = useSearchParams();
  const { issues, activeIssues, resolvedIssuesList } = useRoadGuard();

  // Match the Command Center's initial map center (Patna fallback).
  const defaultCenter = [25.61591, 85.09529];
  const hasRequestedCenter = searchParams.has('lat') && searchParams.has('lng');
  const [mapCenter, setMapCenter] = useState(() => {
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    if (latParam === null || lngParam === null || latParam.trim() === '' || lngParam.trim() === '') return defaultCenter;
    const lat = Number(latParam);
    const lng = Number(lngParam);
    return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
      ? [lat, lng]
      : defaultCenter;
  });
  const [mapZoom, setMapZoom] = useState(13);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [showHistoricalResolved, setShowHistoricalResolved] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      position => {
        const location = [position.coords.latitude, position.coords.longitude];
        setUserLocation(location);
        if (!hasRequestedCenter) {
          setMapCenter(location);
          setMapZoom(15);
        }
      },
      error => console.info('Could not locate the browser for the admin map:', error.message),
      { enableHighAccuracy: true, maximumAge: 300000, timeout: 10000 }
    );
  }, [hasRequestedCenter]);
  // Selected Issue Drawer
  const [drawerIssue, setDrawerIssue] = useState(null);

  // Filter Active Issues for Map Markers
  const visibleIssues = useMemo(() => {
    const baseList = showHistoricalResolved ? issues : activeIssues;
    const filtered = baseList.filter(item => {
      const matchCat = categoryFilter === 'All' || item.category === categoryFilter;
      const matchPri = priorityFilter === 'All' || item.priority === priorityFilter;
      return matchCat && matchPri;
    });
    const locations = [];
    const priorityRank = { Low: 1, Medium: 2, High: 3, Critical: 4 };
    filtered.forEach(issue => {
      const lat = Number(issue.latitude), lng = Number(issue.longitude);
      const group = locations.find(location => {
        const lat1 = lat * Math.PI / 180, lat2 = location.latitude * Math.PI / 180;
        const dLat = (location.latitude - lat) * Math.PI / 180, dLng = (location.longitude - lng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
        return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= 50;
      });
      if (!group) {
        locations.push({ ...issue, latitude: lat, longitude: lng, locationIssues: [issue], reportCount: Number(issue.reportCount || 1) });
        return;
      }
      group.locationIssues.push(issue);
      group.reportCount += Number(issue.reportCount || 1);
      if ((priorityRank[issue.priority] || 0) > (priorityRank[group.priority] || 0)) group.priority = issue.priority;
    });
    return locations;
  }, [issues, activeIssues, showHistoricalResolved, categoryFilter, priorityFilter]);

  return (
    <div className="space-y-4">
      {/* Top Filter & Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-[#D9E1EF] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-[#0A2342] tracking-tight flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#0755C9]" />
            Live Hazard Map — Amaravati Command Centre
          </h1>
          <p className="text-xs text-[#52627A] mt-0.5">
            Geospatial tracking of real-time road hazards around Amaravati & VIT-AP region
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Categories ({visibleIssues.length})</option>
            {ISSUE_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-3 py-1.5 bg-[#F7F9FD] border border-[#D9E1EF] rounded-lg font-medium text-[#0A2342]"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {/* Layer Toggle: Show Resolved */}
          <button
            onClick={() => setShowHistoricalResolved(!showHistoricalResolved)}
            className={`px-3 py-1.5 rounded-lg border font-bold transition-colors flex items-center gap-1.5 ${
              showHistoricalResolved
                ? 'bg-blue-50 border-[#0755C9] text-[#0755C9]'
                : 'bg-white border-[#D9E1EF] text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Historical Layer {showHistoricalResolved ? '(ON)' : '(OFF)'}
          </button>

        </div>
      </div>

      {/* Map Container & Floating Panels */}
      <div className="relative h-[650px] bg-white rounded-xl border border-[#D9E1EF] shadow-md overflow-hidden">
        <MapContainer center={mapCenter} zoom={13} zoomControl={false} scrollWheelZoom className="w-full h-full">
          <MapViewController center={mapCenter} zoom={mapZoom} />
          <ZoomControl position="bottomleft" />
          <TileLayer
            attribution="Map data &copy; Google"
            url="https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            maxZoom={20}
            subdomains={['mt0', 'mt1', 'mt2', 'mt3']}
          />
          {userLocation && <Marker position={userLocation} icon={userLocationIcon}><Popup>Your current location</Popup></Marker>}
          {visibleIssues.map(item => <Marker key={item.id} position={[item.latitude, item.longitude]} icon={createIssueIcon(item.priority, item.reportCount)}>
            <Popup>
              <div className="space-y-2 p-2 text-xs">
                <div className="flex items-center justify-between gap-2"><strong>{item.locationIssues.length} issue(s) within 50 m</strong><PriorityBadge priority={item.priority} /></div>
                {item.locationIssues.map(issue => <div key={issue.id} className="border-t border-slate-100 pt-2">
                  <div className="flex items-center justify-between gap-2"><strong>{issue.title || issue.category}</strong><StatusBadge status={issue.status} /></div>
                  <p className="text-slate-600">{issue.reportCount || 1} reports</p>
                  {issue.photos?.[0] && <img src={issue.photos[0]} alt="Issue" className="mt-1 max-h-24 w-full rounded object-cover" />}
                  <button type="button" onClick={() => setDrawerIssue(issue)} className="mt-1 inline-flex items-center gap-1 font-bold text-blue-700"><Eye className="h-3.5 w-3.5" />View issue details</button>
                </div>)}
              </div>
            </Popup>
          </Marker>)}
        </MapContainer>

        <div className="absolute bottom-4 left-4 z-20 max-h-[45%] w-80 max-w-[calc(100%-2rem)] overflow-y-auto rounded-xl border border-[#D9E1EF] bg-white/95 p-3 shadow-lg backdrop-blur-md">
          <h3 className="mb-2 text-xs font-bold text-[#0A2342]">Reported locations</h3>
          {visibleIssues.length === 0 ? <p className="text-xs text-slate-500">No issues to show.</p> : visibleIssues.map(item => (
            <div key={item.id} className="flex items-start justify-between gap-2 border-t border-slate-100 py-2">
              <button type="button" onClick={() => { setMapCenter([item.latitude, item.longitude]); setMapZoom(15); }} className="min-w-0 text-left">
                <span className="block truncate text-xs font-semibold text-slate-800">{item.title || item.category}</span>
                <span className="text-[11px] text-slate-500">{item.reportCount} report(s) · {item.priority}</span>
              </button>
              <button type="button" onClick={() => setDrawerIssue(item.locationIssues[0])} className="shrink-0 text-xs font-bold text-blue-700">Details</button>
            </div>
          ))}
        </div>

        {/* Floating Active Hazards Summary Card (Top Left) */}
        <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md p-4 rounded-xl border border-[#D9E1EF] shadow-lg max-w-xs space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0A2342] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Active Hazards Summary
            </h3>
            <span className="w-2 h-2 rounded-full bg-emerald-500 pulse-live"></span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="p-2 bg-red-50 rounded-lg border border-red-100">
              <span className="text-lg font-extrabold text-red-600 block">
                {activeIssues.filter(i => i.priority === 'Critical').length}
              </span>
              <span className="text-[10px] text-red-800 font-semibold uppercase">Critical</span>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-lg font-extrabold text-amber-600 block">
                {activeIssues.filter(i => i.priority === 'High').length}
              </span>
              <span className="text-[10px] text-amber-800 font-semibold uppercase">High Priority</span>
            </div>
          </div>
          <div className="pt-2 text-[11px] text-[#52627A] font-medium border-t border-slate-100 flex items-center justify-between">
            <span>Total Active Markers:</span>
            <strong className="text-[#0A2342]">{visibleIssues.length}</strong>
          </div>
        </div>

        {/* Floating Map Legend (Bottom Right) */}
        <div className="absolute bottom-4 right-4 z-20 bg-white/95 backdrop-blur-md p-3.5 rounded-xl border border-[#D9E1EF] shadow-lg text-xs space-y-2">
          <h4 className="font-bold text-[#0A2342] border-b border-slate-100 pb-1">Map Marker Legend</h4>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-600"></span>
              <span className="font-semibold text-slate-700">Critical Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-amber-500"></span>
              <span className="font-semibold text-slate-700">High Priority</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#0755C9]"></span>
              <span className="font-semibold text-slate-700">Medium / Normal</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-slate-500"></span>
              <span className="font-semibold text-slate-700">Low Priority</span>
            </div>
          </div>
</div>
      </div>

      {/* Issue Detail Drawer */}
      {drawerIssue && (
        <IssueDetailDrawer
          issue={drawerIssue}
          onClose={() => setDrawerIssue(null)}
        />
      )}
    </div>
  );
};
