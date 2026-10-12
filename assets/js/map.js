/**
 * FDAReview Map Service
 * Leaflet map wrapper with OpenStreetMap tile layer, custom markers, and geolocation.
 */

import { CONFIG } from './config.js';

let mapInstance = null;
let markersLayer = null;
let userLocationMarker = null;

export function initMap(elementId = 'map', initialCenter = CONFIG.DEFAULT_MAP_CENTER, initialZoom = CONFIG.DEFAULT_ZOOM) {
  if (mapInstance) {
    mapInstance.remove();
  }

  // Check if Leaflet L exists
  if (typeof L === 'undefined') {
    console.error('Leaflet library is not loaded');
    return null;
  }

  mapInstance = L.map(elementId, {
    zoomControl: false
  }).setView(initialCenter, initialZoom);

  // Add zoom control to top-right
  L.control.zoom({ position: 'topright' }).addTo(mapInstance);

  // Standard 100% Free OpenStreetMap tile layer (no API key required)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
    maxZoom: 19
  }).addTo(mapInstance);

  markersLayer = L.layerGroup().addTo(mapInstance);

  return mapInstance;
}

export function setMapView(lat, lng, zoom = 15) {
  if (mapInstance) {
    mapInstance.setView([lat, lng], zoom, { animate: true });
  }
}

export function renderUserLocationMarker(lat, lng) {
  if (!mapInstance) return;

  if (userLocationMarker) {
    markersLayer.removeLayer(userLocationMarker);
  }

  const userIcon = L.divIcon({
    className: 'user-pin-icon',
    html: `
      <div style="
        width: 18px;
        height: 18px;
        background-color: #339AF0;
        border: 3px solid #FFFFFF;
        border-radius: 50%;
        box-shadow: 0 0 12px rgba(51, 154, 240, 0.8);
      "></div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });

  userLocationMarker = L.marker([lat, lng], { icon: userIcon })
    .bindPopup('<strong>Your Location</strong>')
    .addTo(markersLayer);
}

export function displayEstablishmentMarkers(places, onPlaceClick) {
  if (!mapInstance || !markersLayer) return;

  // Clear existing establishment markers except user marker
  markersLayer.eachLayer(layer => {
    if (layer !== userLocationMarker) {
      markersLayer.removeLayer(layer);
    }
  });

  const placeIcon = (category) => {
    const isHotel = (category || '').toLowerCase().includes('hotel') || (category || '').toLowerCase().includes('lodging');
    const color = isHotel ? '#B8F36B' : '#FCC419';
    const symbol = isHotel ? '🏨' : '🍽️';

    return L.divIcon({
      className: 'place-pin-icon',
      html: `
        <div style="
          width: 32px;
          height: 32px;
          background-color: #142019;
          border: 2px solid ${color};
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          box-shadow: 0 4px 10px rgba(0,0,0,0.5);
          cursor: pointer;
        ">${symbol}</div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  };

  places.forEach(place => {
    if (!place.lat || !place.lon) return;

    const marker = L.marker([place.lat, place.lon], {
      icon: placeIcon(place.category)
    });

    const popupHtml = `
      <div style="padding: 4px;">
        <h4 style="margin: 0 0 4px 0; font-size: 14px; font-weight: bold; color: var(--text-primary);">${place.name}</h4>
        <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">${place.address || 'Address unavailable'}</div>
        <div style="display:flex; gap: 8px;">
          <a href="hotel.html?osm_type=${encodeURIComponent(place.osm_type)}&osm_id=${encodeURIComponent(place.osm_id)}&name=${encodeURIComponent(place.name)}&lat=${place.lat}&lon=${place.lon}&category=${encodeURIComponent(place.category)}&address=${encodeURIComponent(place.address || '')}" 
             style="background:var(--accent-primary); color:#000; font-size:11px; font-weight:bold; padding:4px 8px; border-radius:4px; text-decoration:none;">
            View & Review
          </a>
          <a href="https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lon}" 
             target="_blank" rel="noopener"
             style="background:var(--bg-secondary); color:var(--text-primary); font-size:11px; padding:4px 8px; border-radius:4px; text-decoration:none;">
            Directions ↗
          </a>
        </div>
      </div>
    `;

    marker.bindPopup(popupHtml);

    marker.on('click', () => {
      if (onPlaceClick) onPlaceClick(place);
    });

    markersLayer.addLayer(marker);
  });
}

export function getDirectionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
