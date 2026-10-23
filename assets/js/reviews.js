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

/**
 * Submits a full questionnaire-based review.
 * The RPC computes the star rating automatically from 9 numeric questions (average → round).
 */
export async function submitQuestionnaireReview(hotelId, answers) {
  const { data, error } = await supabase.rpc('submit_questionnaire_review', {
    p_hotel_id: hotelId,
    p_visit_frequency: answers.visit_frequency,
    p_preferred_type: answers.preferred_type,
    p_food_quality: answers.food_quality,
    p_food_taste: answers.food_taste,
    p_food_freshness: answers.food_freshness,
    p_menu_variety: answers.menu_variety,
    p_cleanliness: answers.cleanliness,
    p_staff_behaviour: answers.staff_behaviour,
    p_speed_of_service: answers.speed_of_service,
    p_ambience: answers.ambience,
    p_value_for_money: answers.value_for_money,
    p_would_visit_again: answers.would_visit_again,
    p_liked_most: answers.liked_most,
    p_improvement: answers.improvement || '',
    p_favourite_dish: answers.favourite_dish || ''
  });

  if (error) throw error;
  return data;
}

/**
 * Fetch questionnaire response for a specific hotel + user (for display on review cards).
 */
export async function fetchQuestionnaireByHotel(hotelId) {
  const { data, error } = await supabase
    .from('questionnaire_responses')
    .select('*')
    .eq('hotel_id', hotelId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
