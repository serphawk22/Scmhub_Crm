document.addEventListener('DOMContentLoaded', () => {
  // Initialize AOS
  AOS.init({
    duration: 1000,
    once: true,
    offset: 100,
    easing: 'ease-out-cubic'
  });

  // ---- Custom Cursor Logic ----
  const cursorDot = document.querySelector('.cursor-dot');
  const cursorOutline = document.querySelector('.cursor-outline');
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let outlineX = mouseX;
  let outlineY = mouseY;
  
  if (cursorDot && cursorOutline && !window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      
      // Update dot instantly
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
    });
    
    // Smooth trailing effect for outline
    const animateCursor = () => {
      const ease = 0.15;
      outlineX += (mouseX - outlineX) * ease;
      outlineY += (mouseY - outlineY) * ease;
      
      cursorOutline.style.left = `${outlineX}px`;
      cursorOutline.style.top = `${outlineY}px`;
      
      requestAnimationFrame(animateCursor);
    };
    animateCursor();
    
    // Add hover states
    const interactiveElements = document.querySelectorAll('a, button, .nav-link, .group');
    interactiveElements.forEach(el => {
      el.addEventListener('mouseenter', () => cursorOutline.classList.add('hover'));
      el.addEventListener('mouseleave', () => cursorOutline.classList.remove('hover'));
    });
  }

  // ---- Hero Magnetic Grid ----
  const canvas = document.getElementById('hero-particles');
  if (canvas && window.innerWidth > 1024) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = document.getElementById('hero').offsetHeight;
    
    // Grid parameters
    const spacing = 35; // Space between dots
    const dots = [];
    
    class Dot {
      constructor(x, y) {
        this.ox = x; // Original x
        this.oy = y; // Original y
        this.x = x;  // Current x
        this.y = y;  // Current y
        this.vx = 0; // Velocity x
        this.vy = 0; // Velocity y
        this.opacity = 0; // Current opacity
        this.targetOpacity = 0;
      }
      
      update() {
        // Calculate distance from document-relative mouse position
        const absMouseX = mouseX + window.scrollX;
        const absMouseY = mouseY + window.scrollY;
        
        const dx = absMouseX - this.ox;
        const dy = absMouseY - this.oy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const magneticRadius = 200; // How far the magnet reaches
        let targetX = this.ox;
        let targetY = this.oy;
        
        if (dist < magneticRadius) {
          // Repel outward (North Pole to North Pole)
          const force = (magneticRadius - dist) / magneticRadius;
          const pushDistance = force * 80; // The strength of the repulsion ring
          
          if (dist > 0) { 
            targetX = this.ox - (dx / dist) * pushDistance;
            targetY = this.oy - (dy / dist) * pushDistance;
          }
          
          // Make visible when near the magnet
          this.targetOpacity = force * 1.5; 
        } else {
          this.targetOpacity = 0;
        }
        
        // Spring physics for smooth movement
        this.vx += (targetX - this.x) * 0.15;
        this.vy += (targetY - this.y) * 0.15;
        
        // Damping / Friction
        this.vx *= 0.8;
        this.vy *= 0.8;
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Smooth opacity transition
        this.opacity += (this.targetOpacity - this.opacity) * 0.15;
      }
      
      draw() {
        if (this.opacity < 0.01) return; // Optimization: don't draw invisible dots
        ctx.beginPath();
        ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0, 0, 0, ${Math.min(this.opacity, 1)})`; // Solid black with opacity
        ctx.fill();
      }
    }
    
    const initGrid = () => {
      dots.length = 0;
      for (let x = 0; x < width; x += spacing) {
        for (let y = 0; y < height; y += spacing) {
          dots.push(new Dot(x, y));
        }
      }
    };
    initGrid();
    
    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = document.getElementById('hero').offsetHeight;
      initGrid();
    });

    let isHeroVisible = true;
    const heroSection = document.getElementById('hero');
    if (heroSection) {
      const heroObserver = new IntersectionObserver((entries) => {
        isHeroVisible = entries[0].isIntersecting;
      }, { threshold: 0 });
      heroObserver.observe(heroSection);
    }

    const animateDots = () => {
      if (isHeroVisible) {
        ctx.clearRect(0, 0, width, height);
        for (let i = 0; i < dots.length; i++) {
          dots[i].update();
          dots[i].draw();
        }
      }
      requestAnimationFrame(animateDots);
    };
    animateDots();
  }

  // ---- Navbar Blur / Scroll Logic ----
  const navbar = document.getElementById('navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('py-4', 'bg-white/80', 'backdrop-blur-xl', 'border-gray-200', 'shadow-sm');
      navbar.classList.remove('py-6', 'border-transparent');
    } else {
      navbar.classList.add('py-6', 'border-transparent');
      navbar.classList.remove('py-4', 'bg-white/80', 'backdrop-blur-xl', 'border-gray-200', 'shadow-sm');
    }
  });

  // ---- Mobile Menu Logic ----
  const menuBtn = document.getElementById('mobile-menu-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const spans = menuBtn ? menuBtn.querySelectorAll('span') : [];
  
  if (menuBtn && mobileMenu) {
    let isOpen = false;
    menuBtn.addEventListener('click', () => {
      isOpen = !isOpen;
      if (isOpen) {
        mobileMenu.classList.remove('opacity-0', 'pointer-events-none');
        mobileMenu.classList.add('opacity-100', 'menu-active');
        // Hamburger to X animation
        if(spans.length === 3) {
           spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
           spans[1].style.opacity = '0';
           spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
        }
      } else {
        mobileMenu.classList.add('opacity-0', 'pointer-events-none');
        mobileMenu.classList.remove('opacity-100', 'menu-active');
        if(spans.length === 3) {
           spans[0].style.transform = 'none';
           spans[1].style.opacity = '1';
           spans[2].style.transform = 'none';
        }
      }
    });
    
    // Close menu when clicking a link
    document.querySelectorAll('.mobile-link').forEach(link => {
       link.addEventListener('click', () => {
         if(isOpen) menuBtn.click();
       });
    });
  }

  // ---- Stat Counters Animation ----
  const counters = document.querySelectorAll('.stat-counter');
  let hasAnimated = false;
  
  const animateCounters = () => {
    counters.forEach(counter => {
      const target = +counter.getAttribute('data-target');
      const duration = 2000;
      const increment = target / (duration / 16);
      let current = 0;
      
      const updateCounter = () => {
        current += increment;
        if (current < target) {
          counter.innerText = Math.ceil(current);
          requestAnimationFrame(updateCounter);
        } else {
          counter.innerText = target;
        }
      };
      updateCounter();
    });
  };

  const statsSection = document.getElementById('stats');
  if (statsSection) {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !hasAnimated) {
        animateCounters();
        hasAnimated = true;
      }
    }, { threshold: 0.5 });
    observer.observe(statsSection);
  }

  // ---- Fetch & Render Products ----
  const productGrid = document.getElementById('product-grid');
  if (productGrid) {
    const WHATSAPP_NUMBER = "+1234567890"; // Admin should update this
    
    // Use the Next.js proxy route so it automatically resolves the correct API_BASE_URL
    fetch('/api/public-products')
      .then(res => res.json())
      .then(data => {
        const products = data.products || [];
        const activeProducts = products.filter(p => p.is_active);
        
        if (activeProducts.length === 0) {
          productGrid.innerHTML = '<div class="col-span-full text-center text-gray-500 py-12">No products available at the moment.</div>';
          return;
        }

        productGrid.innerHTML = activeProducts.map(p => `
          <div class="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 group flex flex-col h-full">
            <div class="flex items-center justify-between mb-4">
              <span class="text-xs font-bold uppercase tracking-wider text-brand-accent bg-brand-light px-3 py-1 rounded-full">${p.category || 'Service'}</span>
              <span class="text-2xl font-black text-brand-dark">${p.currency} ${p.unit_price}</span>
            </div>
            <h3 class="text-2xl font-bold mb-3 text-brand-dark">${p.name}</h3>
            <p class="text-gray-500 mb-8 flex-grow">${p.description || 'Premium solution for your business growth.'}</p>
            <a href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent('Hi, I am interested in a demo for ' + p.name)}" target="_blank" class="block w-full text-center bg-black text-white py-3 rounded-xl font-bold hover:bg-gray-800 transition-colors mt-auto group-hover:scale-[1.02]">
              Request for Demo
            </a>
          </div>
        `).join('');
      })
      .catch(err => {
        console.error('Error fetching products:', err);
        productGrid.innerHTML = '<div class="col-span-full text-center text-red-500 py-12">Failed to load catalog. Please try again later.</div>';
      });
  }

});
