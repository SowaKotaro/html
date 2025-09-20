const cards = document.querySelectorAll('.content');

const TILT_STRENGTH = 15; // How much the card tilts

function applyTilt(e, card) {
    const { width, height, left, top } = card.getBoundingClientRect();
    const x = e.clientX - left;
    const y = e.clientY - top;

    const rotateX = (y / height - 0.5) * TILT_STRENGTH * -1;
    const rotateY = (x / width - 0.5) * TILT_STRENGTH;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
}

function resetTilt(card) {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
}

// --- Parallax Logo Effect ---
const parallaxLayers = document.querySelectorAll('.parallax-layer');

function applyParallax(e) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    const moveX = (e.clientX - centerX);
    const moveY = (e.clientY - centerY);

    parallaxLayers.forEach(layer => {
        const speed = parseFloat(layer.dataset.speed || 0);
        const x = (moveX * speed) / 100;
        const y = (moveY * speed) / 100;
        layer.style.transform = `translateX(${x}px) translateY(${y}px)`;
    });
}

// Add listeners only on non-touch/larger screens
if (window.matchMedia('(min-width: 1025px)').matches) {
    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            applyTilt(e, card);
        });

        card.addEventListener('mouseleave', () => {
            resetTilt(card);
        });

        card.addEventListener('mouseenter', () => {
            card.style.transition = 'transform 0.1s ease-out';
        });
    });

    window.addEventListener('mousemove', applyParallax);
}
