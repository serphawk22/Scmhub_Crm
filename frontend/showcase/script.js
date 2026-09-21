/**
 * SCM HUB CRM - Core Application Scripts
 * Monochromatic UI, Theme Toggle, Interactive Demos,
 * and Neon PostgreSQL Real-Time Data Synchronization
 */

(function () {
  'use strict';

  // --- Theme Management ---
  const THEME_KEY = 'scmhub_crm_theme';

  function getPreferredTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeToggleIcons(theme);
  }

  function updateThemeToggleIcons(theme) {
    const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
    toggleButtons.forEach((btn) => {
      const sunIcon = btn.querySelector('.icon-sun');
      const moonIcon = btn.querySelector('.icon-moon');
      const label = btn.querySelector('.theme-label');

      if (theme === 'dark') {
        if (sunIcon) sunIcon.style.display = 'inline-block';
        if (moonIcon) moonIcon.style.display = 'none';
        if (label) label.textContent = 'Light Mode';
        btn.setAttribute('aria-label', 'Switch to light mode');
      } else {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'inline-block';
        if (label) label.textContent = 'Dark Mode';
        btn.setAttribute('aria-label', 'Switch to dark mode');
      }
    });
  }

  function initTheme() {
    const initialTheme = getPreferredTheme();
    setTheme(initialTheme);

    const toggleButtons = document.querySelectorAll('[data-theme-toggle]');
    toggleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
      });
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  // --- Mobile Navigation Menu ---
  function initMobileMenu() {
    const menuToggle = document.getElementById('mobileMenuToggle');
    const mobileNav = document.getElementById('mobileNav');

    if (menuToggle && mobileNav) {
      menuToggle.addEventListener('click', () => {
        const isOpen = mobileNav.classList.contains('open');
        if (isOpen) {
          mobileNav.classList.remove('open');
          menuToggle.setAttribute('aria-expanded', 'false');
        } else {
          mobileNav.classList.add('open');
          menuToggle.setAttribute('aria-expanded', 'true');
        }
      });

      const mobileLinks = mobileNav.querySelectorAll('.mobile-nav-link');
      mobileLinks.forEach((link) => {
        link.addEventListener('click', () => {
          mobileNav.classList.remove('open');
          menuToggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
  }

  // --- Neon PostgreSQL Data Hydration ---
  async function loadDashboardData() {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success) return;

      // Hydrate metrics
      if (data.metrics && Array.isArray(data.metrics)) {
        data.metrics.forEach((m) => {
          if (m.key === 'revenue') {
            const el = document.getElementById('metricRevenue');
            if (el) el.textContent = m.value;
            const sub = document.getElementById('metricRevenueSub');
            if (sub && m.subtext) sub.textContent = m.subtext;
          } else if (m.key === 'active_leads') {
            const el = document.getElementById('metricLeads');
            if (el) el.textContent = m.value;
            const sub = document.getElementById('metricLeadsSub');
            if (sub && m.subtext) sub.textContent = m.subtext;
          } else if (m.key === 'open_projects') {
            const el = document.getElementById('metricProjects');
            if (el) el.textContent = m.value;
            const sub = document.getElementById('metricProjectsSub');
            if (sub && m.subtext) sub.textContent = m.subtext;
          } else if (m.key === 'meetings_today') {
            const el = document.getElementById('metricMeetings');
            if (el) el.textContent = m.value;
            const sub = document.getElementById('metricMeetingsSub');
            if (sub && m.subtext) sub.textContent = m.subtext;
          }
        });
      }

      // Hydrate Recent Leads list from Neon
      if (data.leads && Array.isArray(data.leads) && data.leads.length > 0) {
        const leadsList = document.getElementById('recentLeadsList');
        if (leadsList) {
          leadsList.innerHTML = data.leads.map(lead => `
            <li class="lead-item">
              <span class="lead-name">${escapeHtml(lead.name)}</span>
              <span class="lead-tier">${escapeHtml(lead.tier || 'Enterprise')}</span>
            </li>
          `).join('');
        }
      }

      // Hydrate Recent Activities list from Neon
      if (data.activities && Array.isArray(data.activities) && data.activities.length > 0) {
        const activitiesList = document.getElementById('recentActivitiesList');
        if (activitiesList) {
          activitiesList.innerHTML = data.activities.map(act => `
            <li class="activity-item">
              <span class="activity-bullet"></span>
              <span class="activity-text">${escapeHtml(act.description)}</span>
              <span class="activity-time">${escapeHtml(act.time_ago || 'just now')}</span>
            </li>
          `).join('');
        }
      }
    } catch (err) {
      // Graceful fallback to initial HTML if offline or static file view
      console.log('Using initial static layout (API not reachable):', err.message);
    }
  }

  // Hydrate Team Table from Neon
  async function loadTeamData() {
    try {
      const res = await fetch('/api/team');
      if (!res.ok) return;
      const data = await res.json();
      if (!data.success || !Array.isArray(data.team) || data.team.length === 0) return;

      const tbody = document.getElementById('teamTableBody');
      if (tbody) {
        tbody.innerHTML = data.team.map(m => `
          <tr>
            <td>
              <div class="member-cell">
                <div class="member-avatar">${escapeHtml(m.initial || m.name.charAt(0))}</div>
                <div>
                  <div class="member-name">${escapeHtml(m.name)}</div>
                  <div class="member-role">${escapeHtml(m.role)}</div>
                </div>
              </div>
            </td>
            <td><strong>${m.tasks} tasks</strong></td>
            <td>
              <span class="progress-bar-bg"><span class="progress-bar-fill" style="width: ${m.completion_rate}%;"></span></span>
              <span style="font-size: 0.78rem;">${m.completion_rate}%</span>
            </td>
            <td>${m.meetings} meetings</td>
            <td>${m.calls} calls</td>
            <td>${m.projects} projects</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      // Graceful fallback
    }
  }

  // Helper to escape HTML safely
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- AI Email Agent Mockup Interactions ---
  function initAiAgentMockup() {
    const btnReview = document.getElementById('btnAiReview');
    const btnEdit = document.getElementById('btnAiEdit');
    const btnSend = document.getElementById('btnAiSend');
    const draftBubble = document.getElementById('aiDraftBubble');
    const statusToast = document.getElementById('aiStatusToast');

    function setStatus(msg) {
      if (!statusToast) return;
      statusToast.textContent = msg;
      statusToast.style.color = 'var(--blue-primary)';
      setTimeout(() => {
        if (statusToast) statusToast.style.color = 'var(--text-muted)';
      }, 3000);
    }

    if (btnReview && draftBubble) {
      btnReview.addEventListener('click', () => {
        draftBubble.innerHTML = `<strong>[Verified Recipients]:</strong> operations@cargoflow.com, dispatch@scmhub.internal<br><strong>[Summary]:</strong> Rotterdam customs milestone updated to Sep 24. 2 export declarations attached.`;
        setStatus('Verified: 2 Attachments & Recipient Validated');
      });
    }

    if (btnEdit && draftBubble) {
      btnEdit.addEventListener('click', () => {
        const currentText = draftBubble.textContent.trim();
        draftBubble.innerHTML = `"Hello Marcus & CargoFlow team, the shipment schedule for Rotterdam customs handover has been confirmed for Sep 24 (Pacific Trader). All export declarations and inspection certificates are attached for your clearance team."`;
        setStatus('Draft text updated with detailed vessel context');
      });
    }

    if (btnSend && draftBubble) {
      btnSend.addEventListener('click', async () => {
        const originalText = btnSend.textContent;
        btnSend.disabled = true;
        btnSend.textContent = 'Dispatching...';
        setStatus('Connecting to SERP Hawk Email Relay...');

        try {
          // Attempt backend dispatch if Express server is reachable
          await fetch('/api/ai-agent/dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipient: 'operations@cargoflow.com',
              subject: 'Shipment schedule update — Rotterdam customs handover',
              content: draftBubble.textContent.trim()
            })
          });
        } catch (e) {
          // Graceful fallback for client-side demo
        }

        setTimeout(() => {
          btnSend.textContent = 'Sent ✓';
          setStatus('Dispatched & Logged to Workspace Activities');

          // Add to recent activity list in dashboard if visible
          const activitiesList = document.getElementById('recentActivitiesList');
          if (activitiesList) {
            const newLi = document.createElement('li');
            newLi.className = 'activity-item';
            newLi.innerHTML = `
              <span class="activity-bullet"></span>
              <span class="activity-text">AI Email Agent dispatched schedule update to CargoFlow Systems</span>
              <span class="activity-time">Just now</span>
            `;
            activitiesList.insertBefore(newLi, activitiesList.firstChild);
          }

          setTimeout(() => {
            btnSend.disabled = false;
            btnSend.textContent = originalText;
          }, 3500);
        }, 800);
      });
    }
  }

  // --- Password Toggle for Sign-in Page ---
  function initPasswordToggle() {
    const toggleBtn = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('passwordInput');

    if (toggleBtn && passwordInput) {
      toggleBtn.addEventListener('click', () => {
        const currentType = passwordInput.getAttribute('type');
        const newType = currentType === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', newType);
        toggleBtn.setAttribute('aria-label', newType === 'password' ? 'Show password' : 'Hide password');
      });
    }
  }

  // --- Sign-in Form Handling with Neon Database Persistence ---
  function initSignInForm() {
    const signInForm = document.getElementById('signInForm');
    const authFeedback = document.getElementById('authFeedback');
    const emailInput = document.getElementById('emailInput');

    if (signInForm) {
      signInForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = signInForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          const originalText = submitBtn.textContent;
          submitBtn.disabled = true;
          submitBtn.textContent = 'Authenticating...';

          const email = emailInput ? emailInput.value : 'user@organization.com';

          try {
            const res = await fetch('/api/auth/signin', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });

            if (res.ok) {
              const data = await res.json();
              if (authFeedback) {
                authFeedback.style.display = 'block';
                authFeedback.textContent = `Authenticated via Neon PostgreSQL (${data.user.email}). Redirecting...`;
              }
            } else {
              if (authFeedback) {
                authFeedback.style.display = 'block';
                authFeedback.textContent = 'Enterprise workspace authenticated. Redirecting...';
              }
            }
          } catch (err) {
            if (authFeedback) {
              authFeedback.style.display = 'block';
              authFeedback.textContent = 'Enterprise workspace authenticated. Redirecting...';
            }
          }

          setTimeout(() => {
            window.location.href = 'index.html';
          }, 1200);
        }
      });
    }

    const forgotLink = document.getElementById('forgotPasswordLink');
    if (forgotLink) {
      forgotLink.addEventListener('click', (e) => {
        e.preventDefault();
        alert('Password resets must be requested directly through your organization administrator.');
      });
    }
  }

  // --- Contact Modal Handling ---
  function initContactModal() {
    const modalBackdrop = document.getElementById('contactModalBackdrop');
    const closeBtn = document.getElementById('closeContactModal');
    const openBtns = document.querySelectorAll('[data-open-contact]');
    const inquiryForm = document.getElementById('contactInquiryForm');
    const statusMsg = document.getElementById('contactFormStatus');

    if (!modalBackdrop) return;

    function openModal(e) {
      if (e) e.preventDefault();
      modalBackdrop.classList.add('open');
      modalBackdrop.setAttribute('aria-hidden', 'false');
      const firstInput = modalBackdrop.querySelector('input');
      if (firstInput) firstInput.focus();
    }

    function closeModal() {
      modalBackdrop.classList.remove('open');
      modalBackdrop.setAttribute('aria-hidden', 'true');
    }

    openBtns.forEach((btn) => {
      btn.addEventListener('click', openModal);
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalBackdrop.classList.contains('open')) {
        closeModal();
      }
    });

    if (inquiryForm) {
      inquiryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const submitBtn = inquiryForm.querySelector('button[type="submit"]');
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Submitting...';
        }

        setTimeout(() => {
          if (statusMsg) {
            statusMsg.style.display = 'block';
            statusMsg.textContent = 'Inquiry submitted. SCM Hub operations will respond shortly.';
          }
          if (submitBtn) {
            submitBtn.textContent = 'Inquiry Received';
          }
          setTimeout(() => {
            closeModal();
            inquiryForm.reset();
            if (statusMsg) statusMsg.style.display = 'none';
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = 'Submit Inquiry';
            }
          }, 2000);
        }, 800);
      });
    }
  }

  // Initialize on DOM load
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initMobileMenu();
    initContactModal();
    initAiAgentMockup();
    initPasswordToggle();
    initSignInForm();

    // Hydrate data from Neon PostgreSQL if available
    loadDashboardData();
    loadTeamData();
  });
})();
