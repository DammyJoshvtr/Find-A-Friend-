import * as THREE from 'three';

// ============================================
// 3D Background with Three.js
// ============================================

const init3DBackground = () => {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

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
                btn.innerHTML = '<span>Initializing...</span><i class="fas fa-spinner fa-spin"></i>';
                setTimeout(() => {
                    alert('Welcome to the Neural Grid. Your journey begins now.');
                    btn.innerHTML = '<span>Enter Vortex</span><i class="fas fa-arrow-right"></i>';
                }, 1500);
            } else if (action === 'explore') {
                const experienceSection = document.getElementById('experience');
                if (experienceSection) {
                    experienceSection.scrollIntoView({ behavior: 'smooth' });
                }
            } else if (action === 'launch' && emailInput) {
                const email = emailInput.value;
                if (email && email.includes('@')) {
                    btn.innerHTML = '<span>Initializing</span><i class="fas fa-spinner fa-spin"></i>';
                    setTimeout(() => {
                        alert(`Neural profile initialized for ${email}. Check your inbox for quantum confirmation.`);
                        btn.innerHTML = '<span>Initialize</span><i class="fas fa-arrow-right"></i>';
                        emailInput.value = '';
                    }, 1500);
                } else {
                    alert('Please enter a valid neural email address.');
                }
            }
        });
    };

    handleButtonClick(signupBtn, 'signup');
    handleButtonClick(exploreBtn, 'explore');
    handleButtonClick(launchBtn, 'launch');
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
        const cards = document.querySelectorAll('.float-card');
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;

        cards.forEach((card, index) => {
            const speed = 20 + (index * 10);
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            card.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
};

// ============================================
// Initialize Everything
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    init3DBackground();
    initNeuralCanvas();
    initCustomCursor();
    initScrollAnimations();
    initNavbar();
    initCounters();
    initButtons();
    addRippleStyles();
    initTypingAnimation();
    initParallax();

    console.log('FAF Neural Interface Loaded — Reality Reframed');
});