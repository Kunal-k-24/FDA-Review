/**
 * FDAReview Input Validation
 * Client-side validation routines matching server-side PostgreSQL constraints.
 */

export const validateReview = (rating, reviewText) => {
  const errors = [];
  const r = parseInt(rating, 10);
  if (isNaN(r) || r < 1 || r > 5) {
    errors.push('Rating must be an integer between 1 and 5 stars.');
  }

  const text = (reviewText || '').trim();
  if (text.length < 10) {
    errors.push('Review text must be at least 10 characters long.');
  } else if (text.length > 1000) {
    errors.push('Review text cannot exceed 1000 characters.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanText: text,
    rating: r
  };
};

export const validateRedemption = (coins, currentBalance) => {
  const errors = [];
  const c = parseInt(coins, 10);
  if (isNaN(c) || c <= 0) {
    errors.push('Redemption amount must be a positive number of coins.');
  } else if (c > currentBalance) {
    errors.push(`Insufficient coins! You requested ${c} coins but your balance is ${currentBalance}.`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    requestedCoins: c
  };
};
