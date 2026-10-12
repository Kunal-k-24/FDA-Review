/**
 * FDAReview Reviews Service
 * Handles review submissions (invoking the atomic submit_review RPC), review updates, and fetching.
 */

import { supabase } from './supabase-client.js';
import { validateReview } from './validation.js';

export async function getOrCreateDbHotel(place) {
  const { data, error } = await supabase.rpc('get_or_create_hotel', {
    p_osm_type: place.osm_type || 'node',
    p_osm_id: String(place.osm_id),
    p_name: place.name,
    p_category: place.category || 'establishment',
    p_address: place.address || '',
    p_latitude: parseFloat(place.lat),
    p_longitude: parseFloat(place.lon)
  });

  if (error) {
    throw error;
  }
  return data; // Returns the UUID of the hotel in public.hotels
}

export async function fetchHotelReviews(hotelId) {
  const { data, error } = await supabase
    .from('reviews')
    .select(`
      id,
      rating,
      review_text,
      created_at,
      updated_at,
      user_id,
      is_hidden,
      profiles:user_id (
        id,
        username,
        display_name
      )
    `)
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }
  return data || [];
}

export async function submitNewReview(hotelId, rating, reviewText) {
  const validation = validateReview(rating, reviewText);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  // Calls the atomic database function: submit_review
  // Automatically creates review, updates wallet, and adds ledger transaction for 10 coins.
  const { data, error } = await supabase.rpc('submit_review', {
    p_hotel_id: hotelId,
    p_rating: validation.rating,
    p_review_text: validation.cleanText
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function updateExistingReview(reviewId, rating, reviewText) {
  const validation = validateReview(rating, reviewText);
  if (!validation.isValid) {
    throw new Error(validation.errors.join(' '));
  }

  const { data, error } = await supabase.rpc('update_review', {
    p_review_id: reviewId,
    p_rating: validation.rating,
    p_review_text: validation.cleanText
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function reportReview(reviewId, reason) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Authentication required to report a review');

  const { data, error } = await supabase
    .from('moderation_actions')
    .insert({
      review_id: reviewId,
      action: 'flagged',
      reason: reason || 'Inappropriate or spam review',
      performed_by: user.id
    });

  if (error) throw error;
  return data;
}
