/**
 * FDAReview Places Service
 * Resilient multi-tier OpenStreetMap discovery:
 * 1. Tries Nominatim bounded POI query for fast, reliable, rate-limit friendly results
 * 2. Falls back to Overpass API mirrors with optimized query
 * 3. Enriches results with Supabase community ratings and review statistics
 */

import { CONFIG } from './config.js';
import { supabase } from './supabase-client.js';

// Cache for places query to respect external service rate limits
const placesCache = new Map();

export async function fetchNearbyPlaces(lat, lon, radiusMeters = 3000) {
  const cacheKey = `${lat.toFixed(3)}_${lon.toFixed(3)}`;
  if (placesCache.has(cacheKey)) {
    return placesCache.get(cacheKey);
  }

  let places = [];

  // Strategy 1: OpenStreetMap Nominatim Bounded Discovery (Fast, reliable, free, no 504 gateway timeouts)
  try {
    places = await fetchPlacesViaNominatim(lat, lon);
  } catch (nominatimErr) {
    console.warn('Nominatim discovery encountered an error, trying Overpass mirrors:', nominatimErr);
  }

  // Strategy 2: If Nominatim returned fewer than 5 places, try Overpass API mirrors with light query
  if (!places || places.length < 5) {
    try {
      const overpassPlaces = await fetchPlacesViaOverpass(lat, lon, radiusMeters);
      if (overpassPlaces && overpassPlaces.length > 0) {
        // Merge without duplicating OSM IDs
        const existingIds = new Set(places.map(p => p.osm_id));
        overpassPlaces.forEach(p => {
          if (!existingIds.has(p.osm_id)) {
            places.push(p);
          }
        });
      }
    } catch (overpassErr) {
      console.warn('Overpass mirrors exhausted:', overpassErr);
    }
  }

  // If still empty due to severe external outage, provide standard local area spots so user can still test reviews & rewards
  if (!places || places.length === 0) {
    places = getFallbackDemonstrationPlaces(lat, lon);
  }

  // Enrich with Supabase review statistics
  const enriched = await enrichPlacesWithSupabaseRatings(places);
  placesCache.set(cacheKey, enriched);
  return enriched;
}

/**
 * Fetch hotels & restaurants via OpenStreetMap Nominatim with viewbox bounding
 */
async function fetchPlacesViaNominatim(lat, lon) {
  const delta = 0.045; // ~4-5km bounding box
  const viewbox = `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`;
  
  const categories = ['restaurant', 'hotel', 'cafe'];
  const allResults = [];

  for (const cat of categories) {
    const url = `${CONFIG.NOMINATIM_API_URL}?format=json&q=${encodeURIComponent(cat)}&viewbox=${viewbox}&bounded=1&limit=15&addressdetails=1`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'FDAReview-DemoPlatform/1.0' }
      });
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          items.forEach(item => {
            const rawName = item.name || (item.display_name ? item.display_name.split(',')[0] : 'Establishment');
            const addrParts = (item.display_name || '').split(',').slice(1, 4).join(',').trim();

            allResults.push({
              osm_type: item.osm_type || 'node',
              osm_id: String(item.osm_id || Math.floor(Math.random() * 1000000)),
              name: rawName,
              category: cat,
              address: addrParts || 'Local Area',
              lat: parseFloat(item.lat),
              lon: parseFloat(item.lon)
            });
          });
        }
      }
    } catch (e) {
      console.warn(`Nominatim query for ${cat} skipped:`, e);
    }
  }

  // Deduplicate by osm_id
  const uniqueMap = new Map();
  allResults.forEach(p => {
    if (p.lat && p.lon && !uniqueMap.has(p.osm_id)) {
      uniqueMap.set(p.osm_id, p);
    }
  });

  return Array.from(uniqueMap.values());
}

/**
 * Overpass API fallback with multiple mirror endpoints
 */
async function fetchPlacesViaOverpass(lat, lon, radiusMeters) {
  // Ultra-lightweight node-only query to avoid 504 timeouts on busy Overpass servers
  const query = `[out:json][timeout:10];(node["tourism"="hotel"](around:${radiusMeters},${lat},${lon});node["amenity"="restaurant"](around:${radiusMeters},${lat},${lon});node["amenity"="cafe"](around:${radiusMeters},${lat},${lon}););out 25;`;
  
  for (const endpoint of CONFIG.OVERPASS_API_MIRRORS) {
    try {
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawElements = data.elements || [];

        return rawElements
          .filter(item => item.tags && (item.tags.name || item.tags['name:en']))
          .map(item => {
            const category = item.tags.tourism || item.tags.amenity || 'establishment';
            const street = item.tags['addr:street'] || '';
            const city = item.tags['addr:city'] || '';
            const address = [street, city].filter(Boolean).join(', ') || item.tags.cuisine || 'Local Area';

            return {
              osm_type: item.type || 'node',
              osm_id: String(item.id),
              name: item.tags.name || item.tags['name:en'],
              category: category,
              address: address,
              lat: item.lat,
              lon: item.lon
            };
          });
      }
    } catch (e) {
      console.warn(`Overpass mirror ${endpoint} failed or timed out:`, e.message);
    }
  }

  return [];
}

/**
 * OpenStreetMap Nominatim City/Area Geocoder
 */
export async function geocodeCityOrArea(query) {
  const url = `${CONFIG.NOMINATIM_API_URL}?format=json&q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'FDAReview-DemoPlatform/1.0'
    }
  });

  if (!res.ok) {
    throw new Error('Geocoding service unavailable');
  }

  const results = await res.json();
  if (!results || results.length === 0) {
    return null;
  }

  return {
    lat: parseFloat(results[0].lat),
    lon: parseFloat(results[0].lon),
    display_name: results[0].display_name
  };
}

/**
 * Merges discovered places with existing Supabase hotel records and review statistics
 */
export async function enrichPlacesWithSupabaseRatings(places) {
  if (!places || places.length === 0) return [];

  try {
    const osmIds = places.map(p => p.osm_id);
    const { data: dbHotels } = await supabase
      .from('hotels')
      .select('id, osm_id, osm_type')
      .in('osm_id', osmIds);

    const hotelMap = new Map();
    if (dbHotels) {
      dbHotels.forEach(h => hotelMap.set(`${h.osm_type}_${h.osm_id}`, h.id));
    }

    const hotelIds = Array.from(hotelMap.values());
    let ratingsMap = new Map();

    if (hotelIds.length > 0) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('hotel_id, rating')
        .in('hotel_id', hotelIds)
        .eq('is_hidden', false);

      if (reviews) {
        reviews.forEach(r => {
          if (!ratingsMap.has(r.hotel_id)) {
            ratingsMap.set(r.hotel_id, { count: 0, sum: 0 });
          }
          const curr = ratingsMap.get(r.hotel_id);
          curr.count++;
          curr.sum += r.rating;
        });
      }
    }

    return places.map(p => {
      const dbId = hotelMap.get(`${p.osm_type}_${p.osm_id}`);
      const stats = dbId ? ratingsMap.get(dbId) : null;
      return {
        ...p,
        db_id: dbId || null,
        review_count: stats ? stats.count : 0,
        avg_rating: stats && stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : null
      };
    });
  } catch (err) {
    console.error('Error enriching places with Supabase stats:', err);
    return places;
  }
}

/**
 * High-reliability fallback places around coordinates if external OSM APIs are undergoing maintenance
 */
function getFallbackDemonstrationPlaces(lat, lon) {
  return [
    {
      osm_type: 'node',
      osm_id: '9901001',
      name: 'Grand Heritage Hotel & Bistro',
      category: 'hotel',
      address: 'Central Avenue, Main District',
      lat: lat + 0.003,
      lon: lon + 0.002
    },
    {
      osm_type: 'node',
      osm_id: '9901002',
      name: 'The Spice Garden Restaurant',
      category: 'restaurant',
      address: 'Lane 4, Near City Center',
      lat: lat - 0.002,
      lon: lon + 0.004
    },
    {
      osm_type: 'node',
      osm_id: '9901003',
      name: 'Roast & Brew Artisan Cafe',
      category: 'cafe',
      address: 'High Street Commercial Complex',
      lat: lat + 0.004,
      lon: lon - 0.003
    },
    {
      osm_type: 'node',
      osm_id: '9901004',
      name: 'Royal Orchid Suites & Lounge',
      category: 'hotel',
      address: 'Station Road, Riverside',
      lat: lat - 0.005,
      lon: lon - 0.002
    }
  ];
}
