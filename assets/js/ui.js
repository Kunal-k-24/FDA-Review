/**
 * FDAReview UI Utilities
 * Reusable toast notifications, modal dialogues, loaders, and formatting functions.
 */

import { CONFIG } from './config.js';

export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✅';
  if (type === 'error') icon = '⚠️';
  if (type === 'warning') icon = '⚡';

  toast.innerHTML = `
    <span>${icon}</span>
    <span style="flex: 1;">${escapeHTML(message)}</span>
    <button style="background:none;border:none;color:var(--text-muted);cursor:pointer;padding:2px;" aria-label="Close">&times;</button>
  `;

  toast.querySelector('button').addEventListener('click', () => toast.remove());
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

export function escapeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatCoins(coins) {
  const num = Number(coins) || 0;
  return new Intl.NumberFormat('en-IN').format(num);
}

export function formatRupees(coins) {
  const num = Number(coins) || 0;
  const inr = (num / CONFIG.COINS_TO_INR_RATIO).toFixed(2);
  return `₹${inr}`;
}

export function formatDate(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function renderStarRating(rating) {
  const rounded = Math.round(rating) || 0;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      html += '<span class="star-filled">★</span>';
    } else {
      html += '<span class="star-empty">☆</span>';
    }
  }
  return `<span class="rating-stars">${html}</span>`;
}
