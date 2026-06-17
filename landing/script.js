// THREE is loaded globally via CDN in index.html

// ============================================
// 3D Background with Three.js
// ============================================

const init3DBackground = () => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    // Create particle system
    const particlesGeometry = new THREE.BufferGeometry();
    const particlesCount = 2000;
    const posArray = new Float32Array(particlesCount * 3);

    for (let i = 0; i < particlesCount * 3; i += 3) {
        posArray[i] = (Math.random() - 0.5) * 200;
        posArray[i + 1] = (Math.random() - 0.5) * 100;
        posArray[i + 2] = (Math.random() - 0.5) * 100 - 50;
    }

    particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

    const particlesMaterial = new THREE.PointsMaterial({
        color: 0xa78bfa,
        size: 0.2,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh = new THREE.Points(particlesGeometry, particlesMaterial);
    scene.add(particlesMesh);

    // Add a second particle system with different color
    const particlesGeometry2 = new THREE.BufferGeometry();
    const posArray2 = new Float32Array(1000 * 3);

    for (let i = 0; i < 1000 * 3; i += 3) {
        posArray2[i] = (Math.random() - 0.5) * 150;
        posArray2[i + 1] = (Math.random() - 0.5) * 80;
        posArray2[i + 2] = (Math.random() - 0.5) * 80;
    }

    particlesGeometry2.setAttribute('position', new THREE.BufferAttribute(posArray2, 3));

    const particlesMaterial2 = new THREE.PointsMaterial({
        color: 0x3b82f6,
        size: 0.15,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending
    });

    const particlesMesh2 = new THREE.Points(particlesGeometry2, particlesMaterial2);
    scene.add(particlesMesh2);

    camera.position.z = 30;

    // Mouse interaction
    let mouseX = 0;
    let mouseY = 0;

    document.addEventListener('mousemove', (event) => {
        mouseX = (event.clientX / window.innerWidth) * 2 - 1;
        mouseY = (event.clientY / window.innerHeight) * 2 - 1;
    });

    // Animation
    let time = 0;

    const animate = () => {
        requestAnimationFrame(animate);
        time += 0.002;

        particlesMesh.rotation.y = time * 0.1;
        particlesMesh.rotation.x = time * 0.05;
        particlesMesh2.rotation.y = -time * 0.08;
        particlesMesh2.rotation.x = time * 0.03;

        // Follow mouse slightly
        particlesMesh.rotation.x += (mouseY * 0.5 - particlesMesh.rotation.x) * 0.05;
        particlesMesh.rotation.y += (mouseX * 0.5 - particlesMesh.rotation.y) * 0.05;

        renderer.render(scene, camera);
    };

    animate();

    // Handle resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
};

// ============================================
// Hero Canvas Network Animation (Plexus vs Grid Mode)
// ============================================

const initHeroCanvas = () => {
    const canvas = document.getElementById('hero-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set high-DPI sizing
    const setSize = () => {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
    };
    setSize();
    window.addEventListener('resize', setSize);
    
    // Track mouse movement relative to the canvas
    const mouse = { x: null, y: null, radius: 155 };
    
    const heroSection = document.getElementById('hero');
    if (heroSection) {
        heroSection.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            mouse.x = e.clientX - rect.left;
            mouse.y = e.clientY - rect.top;
        });
        
        heroSection.addEventListener('mouseleave', () => {
            mouse.x = null;
            mouse.y = null;
        });
    }
    
    // Responsive configurations for particle density and line visibility
    const getResponsiveConfig = () => {
        const width = window.innerWidth;
        if (width < 480) {
            return {
                count: 10,
                maxDist: 50,
                lineAlphaScale: 0.12,
                mouseRadius: 60,
                nodeRadiusScale: 0.5,
                nodeAlpha: 0.25
            };
        } else if (width < 768) {
            return {
                count: 18,
                maxDist: 60,
                lineAlphaScale: 0.18,
                mouseRadius: 80,
                nodeRadiusScale: 0.65,
                nodeAlpha: 0.45
            };
        } else if (width < 1024) {
            return {
                count: 32,
                maxDist: 75,
                lineAlphaScale: 0.28,
                mouseRadius: 110,
                nodeRadiusScale: 0.8,
                nodeAlpha: 0.65
            };
        } else {
            return {
                count: 50,
                maxDist: 85,
                lineAlphaScale: 0.4,
                mouseRadius: 150,
                nodeRadiusScale: 0.95,
                nodeAlpha: 0.85
            };
        }
    };
    
    let config = getResponsiveConfig();
    
    // Violet Theme Configuration
    const nodeColor = '#a78bfa';
    const lineColorBase = 'rgba(167, 139, 250, ';
    
    // Plexus particle setup
    const particles = [];
    
    const initParticles = () => {
        config = getResponsiveConfig(); // re-evaluate on resize
        particles.length = 0;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        for (let i = 0; i < config.count; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                vx: (Math.random() - 0.5) * 0.6,
                vy: (Math.random() - 0.5) * 0.6,
                radius: (Math.random() * 1.5 + 1.2) * config.nodeRadiusScale,
                pulseSpeed: Math.random() * 0.02 + 0.01,
                pulseTime: Math.random() * 100
            });
        }
    };
    initParticles();
    
    // Handle resizing logic
    window.addEventListener('resize', initParticles);
    
    // Animation Loop
    let time = 0;
    const animate = () => {
        time += 1;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        ctx.clearRect(0, 0, width, height);
        
        // Draw connection lines between nodes
        for (let i = 0; i < particles.length; i++) {
            const p1 = particles[i];
            
            // Draw connection line to mouse
            if (mouse.x !== null && mouse.y !== null) {
                const dx = mouse.x - p1.x;
                const dy = mouse.y - p1.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < config.mouseRadius) {
                    const alpha = (1 - dist / config.mouseRadius) * (config.lineAlphaScale + 0.1);
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(mouse.x, mouse.y);
                    ctx.strokeStyle = lineColorBase + alpha + ')';
                    ctx.lineWidth = 1.8 * config.nodeRadiusScale;
                    ctx.stroke();
                    
                    // Gravitate particles slightly towards mouse
                    p1.x += dx * 0.015;
                    p1.y += dy * 0.015;
                }
            }
            
            for (let j = i + 1; j < particles.length; j++) {
                const p2 = particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist < config.maxDist) {
                    const alpha = (1 - dist / config.maxDist) * config.lineAlphaScale;
                    ctx.beginPath();
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    ctx.strokeStyle = lineColorBase + alpha + ')';
                    ctx.lineWidth = 1.4 * config.nodeRadiusScale;
                    ctx.stroke();
                }
            }
        }
        
        // Draw and update nodes
        particles.forEach(p => {
            // Motion
            p.x += p.vx;
            p.y += p.vy;
            
            // Boundary bounce
            if (p.x < 0 || p.x > width) p.vx *= -1;
            if (p.y < 0 || p.y > height) p.vy *= -1;
            
            // Pulse glow
            p.pulseTime += p.pulseSpeed;
            const pulse = (Math.sin(p.pulseTime) + 1) / 2;
            const currentRadius = p.radius + pulse * 1.5;
            
            // Draw node with the exact color theme from initNeuralCanvas
            ctx.save();
            ctx.globalAlpha = config.nodeAlpha || 1.0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, currentRadius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(p.x - 2, p.y - 2, 0, p.x, p.y, currentRadius);
            gradient.addColorStop(0, '#a78bfa');
            gradient.addColorStop(1, '#3b82f6');
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Glow effect
            ctx.shadowBlur = 10 * config.nodeRadiusScale;
            ctx.shadowColor = '#a78bfa';
            ctx.fill();
            ctx.restore();
        });
        
        requestAnimationFrame(animate);
    };
    
    animate();
};

// ============================================
// Neural Network Visualization
// ============================================

const initNeuralCanvas = () => {
    const canvas = document.getElementById('neural-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    const setSize = () => {
        const container = canvas.parentElement;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
    };

    setSize();
    window.addEventListener('resize', setSize);

    const nodes = [];
    const nodeCount = 30;

    // Create nodes
    for (let i = 0; i < nodeCount; i++) {
        nodes.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: 2 + Math.random() * 3
        });
    }

    const animate = () => {
        if (!canvas || !ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Update and draw nodes
        for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];

            // Update position
            node.x += node.vx;
            node.y += node.vy;

            // Bounce off edges
            if (node.x < 0 || node.x > canvas.width) node.vx *= -1;
            if (node.y < 0 || node.y > canvas.height) node.vy *= -1;

            // Draw connections
            for (let j = i + 1; j < nodes.length; j++) {
                const other = nodes[j];
                const dx = node.x - other.x;
                const dy = node.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 100) {
                    ctx.beginPath();
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(other.x, other.y);
                    const opacity = 0.3 * (1 - distance / 100);
                    ctx.strokeStyle = `rgba(167, 139, 250, ${opacity})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
            }

            // Draw node
            ctx.beginPath();
            ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
            const gradient = ctx.createRadialGradient(node.x - 2, node.y - 2, 0, node.x, node.y, node.radius);
            gradient.addColorStop(0, '#a78bfa');
            gradient.addColorStop(1, '#3b82f6');
            ctx.fillStyle = gradient;
            ctx.fill();

            // Glow effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#a78bfa';
            ctx.fill();
            ctx.shadowBlur = 0;
        }

        requestAnimationFrame(animate);
    };

    animate();
};

// ============================================
// Custom Cursor
// ============================================

const initCustomCursor = () => {
    if (window.innerWidth <= 768) return;

    const cursorDot = document.querySelector('.cursor-dot');
    const cursorOutline = document.querySelector('.cursor-outline');

    if (!cursorDot || !cursorOutline) return;

    let mouseX = 0, mouseY = 0;
    let outlineX = 0, outlineY = 0;

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;

        cursorDot.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
    });

    const animateOutline = () => {
        outlineX += (mouseX - outlineX) * 0.1;
        outlineY += (mouseY - outlineY) * 0.1;
        cursorOutline.style.transform = `translate(${outlineX - 20}px, ${outlineY - 20}px)`;
        requestAnimationFrame(animateOutline);
    };

    animateOutline();

    // Hover effect on interactive elements
    const interactiveElements = document.querySelectorAll('button, a, .nav-link, .exp-card, .cap-card');

    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursorOutline.style.width = '60px';
            cursorOutline.style.height = '60px';
            cursorOutline.style.borderColor = '#3b82f6';
            cursorOutline.style.opacity = '0.8';
        });

        el.addEventListener('mouseleave', () => {
            cursorOutline.style.width = '40px';
            cursorOutline.style.height = '40px';
            cursorOutline.style.borderColor = '#a78bfa';
            cursorOutline.style.opacity = '1';
        });
    });
};

// ============================================
// Scroll Animations
// ============================================

const initScrollAnimations = () => {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -100px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');

                // Add staggered animation to children
                const children = entry.target.querySelectorAll('.exp-card, .cap-card, .float-card');
                children.forEach((child, index) => {
                    setTimeout(() => {
                        child.style.opacity = '1';
                        child.style.transform = 'translateY(0)';
                    }, index * 100);
                });
            }
        });
    }, observerOptions);

    // Observe sections
    const sections = document.querySelectorAll('.experience, .capabilities, .neural, .launch');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(30px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });

    // Make visible class trigger
    document.head.insertAdjacentHTML('beforeend', `
        <style>
            .experience.visible, .capabilities.visible, .neural.visible, .launch.visible {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
            .exp-card, .cap-card {
                opacity: 0;
                transform: translateY(20px);
                transition: opacity 0.5s ease, transform 0.5s ease;
            }
        </style>
    `);
};

// ============================================
// Navbar Scroll Effect
// ============================================

const initNavbar = () => {
    const nav = document.querySelector('.nav');

    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    const mobileBtn = document.querySelector('.mobile-menu');
    const navLinks = document.querySelector('.nav-links');
    const navActions = document.querySelector('.nav-actions');

    if (mobileBtn && navLinks && navActions) {
        mobileBtn.addEventListener('click', () => {
            const isOpen = navLinks.style.display === 'flex';
            navLinks.style.display = isOpen ? 'none' : 'flex';
            navActions.style.display = isOpen ? 'none' : 'flex';

            if (!isOpen) {
                navLinks.style.flexDirection = 'column';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '100%';
                navLinks.style.left = '0';
                navLinks.style.width = '100%';
                navLinks.style.background = 'rgba(10, 10, 15, 0.95)';
                navLinks.style.backdropFilter = 'blur(20px)';
                navLinks.style.padding = '2rem';
                navLinks.style.gap = '1rem';
                navActions.style.position = 'absolute';
                navActions.style.top = '100%';
                navActions.style.right = '0';
                navActions.style.width = '100%';
                navActions.style.padding = '0 2rem 2rem';
                navActions.style.justifyContent = 'center';
            }
        });
    }

    // Smooth scroll for nav links
    document.querySelectorAll('.nav-link, .btn-primary').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const target = document.querySelector(href);
                if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
};

// ============================================
// Counter Animation for Stats
// ============================================

const animateCounter = (element, target, duration = 2000) => {
    let start = 0;
    const increment = target / (duration / 16);

    const updateCounter = () => {
        start += increment;
        if (start < target) {
            element.textContent = Math.floor(start).toLocaleString();
            requestAnimationFrame(updateCounter);
        } else {
            element.textContent = target.toLocaleString();
        }
    };

    updateCounter();
};

const initCounters = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const userCount = document.getElementById('activeUsers');
                const msgCount = document.getElementById('messagesSent');
                const eventCount = document.getElementById('eventsCreated');

                if (userCount) animateCounter(userCount, 2347);
                if (msgCount) animateCounter(msgCount, 1200000, 3000);
                if (eventCount) animateCounter(eventCount, 847);

                observer.disconnect();
            }
        });
    }, { threshold: 0.5 });

    const neuralSection = document.querySelector('.neural');
    if (neuralSection) observer.observe(neuralSection);
};

// ============================================
// Button Interactions with Haptic Feedback
// ============================================

const initButtons = () => {
    const launchBtn = document.getElementById('launchBtn');
    const emailInput = document.getElementById('emailInput');
    const signupBtn = document.getElementById('signupBtn');
    const exploreBtn = document.getElementById('exploreBtn');

    const handleButtonClick = (btn, action) => {
        if (!btn) return;

        btn.addEventListener('click', () => {
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            btn.appendChild(ripple);

            setTimeout(() => ripple.remove(), 600);

            // Haptic feedback simulation (vibration if supported)
            if (navigator.vibrate) navigator.vibrate(50);

            // Button action
            if (action === 'signup') {
                btn.innerHTML = '<span>Connecting...</span><i class="fas fa-spinner fa-spin"></i>';
                setTimeout(() => {
                    btn.innerHTML = '<span>Join FAF</span><i class="fas fa-arrow-right"></i>';
                    showLaunchpadModal();
                }, 1000);
            } else if (action === 'explore') {
                const experienceSection = document.getElementById('experience');
                if (experienceSection) {
                    experienceSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (action === 'launch' && emailInput) {
                const email = emailInput.value.trim();
                if (email && email.includes('@')) {
                    btn.innerHTML = '<span>Requesting...</span><i class="fas fa-spinner fa-spin"></i>';
                    setTimeout(() => {
                        btn.innerHTML = '<span>Request Access</span><i class="fas fa-arrow-right"></i>';
                        emailInput.value = '';
                        showLaunchpadModal(email);
                    }, 1000);
                } else {
                    alert('Please enter a valid student email address.');
                }
            }
        });
    };

    handleButtonClick(signupBtn, 'signup');
    handleButtonClick(exploreBtn, 'explore');
    handleButtonClick(launchBtn, 'launch');
};

// ============================================
// FAF Launchpad Modal
// ============================================

const showLaunchpadModal = (email = '') => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const pwaUrl = 'https://faf-pwa.vercel.app/';

    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 550px;">
            <button class="modal-close">&times;</button>
            <h3 class="modal-title gradient-text" style="margin-bottom: 0.8rem; font-family: 'Outfit', sans-serif;">FAF Launchpad</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem;">
                ${email ? `Profile initialized for <strong>${email}</strong>.` : 'Access the Find-A-Friend student network instantly.'}
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
                <!-- Web / PWA option -->
                <div style="background: var(--bg-tertiary); border: 1px solid var(--glass-border); padding: 1.2rem; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; padding-right: 1rem;">
                        <h4 style="font-family: 'Outfit', sans-serif; color: var(--accent-violet); margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fas fa-globe"></i> Web Version (PWA)
                        </h4>
                        <p style="font-size: 0.8rem; color: var(--text-secondary);">Run directly in your browser. Install as a progressive web app on your home screen.</p>
                    </div>
                    <a href="${pwaUrl}" target="_blank" class="btn-premium" style="text-decoration: none; padding: 0.6rem 1.2rem; font-size: 0.8rem;">
                        <span>Launch PWA</span>
                    </a>
                </div>

                <!-- Android option -->
                <div style="background: var(--bg-tertiary); border: 1px solid var(--glass-border); padding: 1.2rem; border-radius: 16px; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1; padding-right: 1rem;">
                        <h4 style="font-family: 'Outfit', sans-serif; color: var(--accent-cyan); margin-bottom: 0.2rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fab fa-android"></i> Android Native
                        </h4>
                        <p style="font-size: 0.8rem; color: var(--text-secondary);">Download the FAF Android APK directly to install the native app on your phone.</p>
                    </div>
                    <a href="https://expo.dev/artifacts/eas/jCt5RyJVZcpykaBFGY23Uj.apk" download class="btn-premium" style="text-decoration: none; padding: 0.6rem 1.2rem; font-size: 0.8rem; background: var(--gradient-2);">
                        <span>Download APK</span>
                    </a>
                </div>
            </div>

            <button class="btn-premium modal-btn-close" style="width: 100%; justify-content: center; margin-top: 1.5rem; background: transparent; border: 1px solid var(--glass-border); color: var(--text-secondary);">
                <span>Close Launchpad</span>
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    setTimeout(() => overlay.classList.add('active'), 50);

    const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-btn-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Download handled via link; no extra click handler needed

    if (navigator.vibrate) navigator.vibrate(50);
};

// ============================================
// Coming Soon Popup for Social Media Icons
// ============================================

const showComingSoonModal = (platformName = '') => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
        <div class="modal-content" style="max-width: 400px; text-align: center; padding: 2.5rem 2rem;">
            <button class="modal-close">&times;</button>
            <div style="font-size: 3rem; color: var(--accent-violet); margin-bottom: 1rem; animation: pulse-glow 2s ease-in-out infinite;">
                <i class="fas fa-clock"></i>
            </div>
            <h3 class="modal-title gradient-text" style="margin-bottom: 0.8rem; font-family: 'Outfit', sans-serif;">Coming Soon</h3>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1.5rem; line-height: 1.5;">
                We are currently building our official <strong>${platformName}</strong> presence. Stay tuned for updates!
            </p>
            <button class="btn-premium modal-btn-close" style="width: 100%; justify-content: center; background: var(--gradient-1);">
                <span>Got It!</span>
            </button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animation triggers
    setTimeout(() => overlay.classList.add('active'), 50);

    const close = () => {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    };

    overlay.querySelector('.modal-close').addEventListener('click', close);
    overlay.querySelector('.modal-btn-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    if (navigator.vibrate) navigator.vibrate(50);
};

const initSocialIcons = () => {
    const socialLinks = document.querySelectorAll('.footer-social a');
    socialLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const icon = link.querySelector('i');
            let platformName = 'Social Media';
            if (icon) {
                if (icon.classList.contains('fa-twitter')) platformName = 'X (Twitter)';
                else if (icon.classList.contains('fa-discord')) platformName = 'Discord';
                else if (icon.classList.contains('fa-github')) platformName = 'GitHub';
                else if (icon.classList.contains('fa-instagram')) platformName = 'Instagram';
            }
            showComingSoonModal(platformName);
        });
    });
};

// ============================================
// Interactive Demo Modal
// ============================================

const initDemoModal = () => {
    const demoBtn = document.getElementById('demoBtn');
    if (!demoBtn) return;

    demoBtn.addEventListener('click', () => {
        // Create modal elements
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-content">
                <button class="modal-close">&times;</button>
                <h3 class="modal-title gradient-text" style="margin-bottom: 1.2rem;">FAF (Find-A-Friend)</h3>
                <div class="modal-body" style="display: flex; flex-direction: column; gap: 0.8rem; text-align: left; font-size: 0.9rem;">
                    <p style="margin-bottom: 0.5rem; font-weight: 600;">FAF is the ultimate campus network built to bring your university experience to life:</p>
                    <p>📢 <strong>Campus Feed & Stories:</strong> Share daily updates and view 24h student stories.</p>
                    <p>🤝 <strong>Friend Matcher:</strong> Discover and connect with peers based on interest match scores.</p>
                    <p>💬 <strong>Chat Rooms:</strong> Send direct messages or coordinate in active course study channels.</p>
                    <p>🔒 <strong>Confessions Board:</strong> Share anonymous thoughts safely with encrypted audit trails.</p>
                    <p>📍 <strong>Campus Map:</strong> View buildings and live events overlay offline-ready.</p>
                </div>
                <button class="btn-premium modal-btn-close" style="width: 100%; justify-content: center; margin-top: 1.5rem;">Got It!</button>
            </div>
        `;

        document.body.appendChild(overlay);

        // Animation triggers
        setTimeout(() => overlay.classList.add('active'), 50);

        const close = () => {
            overlay.classList.remove('active');
            setTimeout(() => overlay.remove(), 300);
        };

        overlay.querySelector('.modal-close').addEventListener('click', close);
        overlay.querySelector('.modal-btn-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        if (navigator.vibrate) navigator.vibrate(50);
    });
};

// Add ripple styles
const addRippleStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.5);
            transform: scale(0);
            animation: ripple-animation 0.6s linear;
            pointer-events: none;
        }
        
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
        
        button {
            position: relative;
            overflow: hidden;
        }
    `;
    document.head.appendChild(style);
};

// ============================================
// Typing Animation for Hero Title
// ============================================

const initTypingAnimation = () => {
    const titleLines = document.querySelectorAll('.hero-title .title-line');
    titleLines.forEach((line, index) => {
        line.style.opacity = '0';
        line.style.transform = 'translateY(20px)';
        line.style.transition = 'opacity 0.6s ease, transform 0.6s ease';

        setTimeout(() => {
            line.style.opacity = '1';
            line.style.transform = 'translateY(0)';
        }, 300 + (index * 200));
    });
};

// ============================================
// Parallax Effect for Floating Elements
// ============================================

const initParallax = () => {
    document.addEventListener('mousemove', (e) => {
        const chips = document.querySelectorAll('.float-chip');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;

        chips.forEach((chip, index) => {
            const speed = 12 + (index * 6);
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            chip.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
};


// ============================================
// Initialize Everything
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    init3DBackground();
    initHeroCanvas();
    initNeuralCanvas();
    initCustomCursor();
    initScrollAnimations();
    initNavbar();
    initCounters();
    initButtons();
    initDemoModal();
    initSocialIcons();
    addRippleStyles();
    initTypingAnimation();
    initParallax();

    console.log('FAF (Find-A-Friend) Landing Page Loaded');
});