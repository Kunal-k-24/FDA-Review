/**
 * FDAReview Navigation Bar Component
 * Dynamically injects consistent header & footer across all pages.
 */

import { initAuth, getCurrentUser, getCurrentProfile, getCurrentWallet, logout, isAdmin } from './auth.js';
import { formatCoins } from './ui.js';

export function renderNavigation(activePage = 'explore') {
  const headerContainer = document.getElementById('main-header');
  if (!headerContainer) return;

  const user = getCurrentUser();
  const profile = getCurrentProfile();
  const wallet = getCurrentWallet();

  const isLoggedIn = !!user;
  const isUserAdmin = isAdmin();

  headerContainer.innerHTML = `
    <header class="site-header">
      <div class="container header-container">
        <a href="index.html" class="brand-logo" id="nav-brand">
          <div class="logo-badge">FDA</div>
          <div class="brand-text">FDA<span>Review</span></div>
        </a>

        <button class="mobile-nav-toggle" id="mobile-toggle" aria-label="Toggle navigation">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>

        <nav class="site-nav" id="site-nav">
          <ul class="nav-links">
            <li>
              <a href="index.html" class="nav-link ${activePage === 'explore' ? 'active' : ''}" id="nav-explore">
                Explore
              </a>
            </li>
            ${isLoggedIn ? `
              <li>
                <a href="wallet.html" class="nav-link ${activePage === 'wallet' ? 'active' : ''}" id="nav-wallet">
                  My Wallet
                </a>
              </li>
              <li>
                <a href="profile.html" class="nav-link ${activePage === 'profile' ? 'active' : ''}" id="nav-profile">
                  My Profile
                </a>
              </li>
            ` : ''}
            ${isUserAdmin ? `
              <li>
                <a href="admin.html" class="nav-link ${activePage === 'admin' ? 'active' : ''}" id="nav-admin">
                  Admin <span class="nav-badge-admin">HQ</span>
                </a>
              </li>
            ` : ''}
          </ul>

          <div class="nav-actions">
            ${isLoggedIn ? `
              <a href="wallet.html" class="wallet-quick-badge" id="nav-quick-wallet" title="Your available coin balance">
                <span class="coin-icon">©</span>
                <span id="nav-coin-count">${formatCoins(wallet?.balance_coins || 0)}</span> Coins
              </a>

              <div class="user-menu" id="user-menu-wrapper">
                <button class="user-menu-btn" id="user-menu-btn" aria-haspopup="true">
                  <div class="user-avatar-small">${(profile?.display_name || user.email || 'U')[0].toUpperCase()}</div>
                  <span>${profile?.display_name || 'Account'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </button>

                <div class="dropdown-menu" id="user-dropdown">
                  <a href="profile.html" class="dropdown-item">Profile & Reviews</a>
                  <a href="wallet.html" class="dropdown-item">Wallet & Redeem</a>
                  ${isUserAdmin ? '<a href="admin.html" class="dropdown-item">Admin Dashboard</a>' : ''}
                  <div class="dropdown-divider"></div>
                  <button class="dropdown-item" id="logout-btn" style="color:var(--status-error);">Log Out</button>
                </div>
              </div>
            ` : `
              <a href="login.html" class="btn btn-secondary btn-sm" id="nav-login">Sign In</a>
              <a href="register.html" class="btn btn-primary btn-sm" id="nav-register">Create Account</a>
            `}
          </div>
        </nav>
      </div>
    </header>
  `;

  // Attach event listeners
  const mobileToggle = document.getElementById('mobile-toggle');
  const siteNav = document.getElementById('site-nav');
  if (mobileToggle && siteNav) {
    mobileToggle.addEventListener('click', () => {
      siteNav.classList.toggle('mobile-open');
    });
  }

  const userMenuBtn = document.getElementById('user-menu-btn');
  const userDropdown = document.getElementById('user-dropdown');
  if (userMenuBtn && userDropdown) {
    userMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
      if (!userMenuBtn.contains(e.target)) {
        userDropdown.classList.remove('show');
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logout();
    });
  }
}

export function renderFooter() {
  const footerContainer = document.getElementById('main-footer');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <footer class="site-footer">
      <div class="container footer-content">
        <div>
          <strong style="color:var(--text-primary);">FDAReview</strong> &mdash; Discover great hotels & restaurants, post verified reviews, and earn FDA Coins.
          <div style="font-size:12px;margin-top:4px;">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors.</div>
          <div style="font-size:12px;margin-top:4px;color:var(--accent-primary);font-weight:600;">Created by Aditya Thorat &bull; MIT CSN</div>
        </div>
        <div style="font-size:12px;">
          Redemption is simulated &bull; 1,000 FDA Coins = ₹10
        </div>
      </div>
    </footer>
  `;
}
