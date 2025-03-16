function showLoading() {
    document.getElementById("loading").style.display = "block";
}

function removeQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has(param)) {
        urlParams.delete(param);
        const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
        window.history.replaceState({}, '', newUrl); // Update URL without reloading
    }
}

function generatePrompt() {
    const promptInput = document.getElementById('prompt');

    const subjects = [
        "A majestic dragon", "A curious fox", "A steampunk robot", "A field of wildflowers", "A bustling cityscape", "A serene forest", "A hidden waterfall", "A futuristic spaceship", "A group of playful kittens", "A wise old owl"
    ];
    const actions = [
        "soaring through the clouds", "exploring a hidden cave", "playing a violin", "dancing in the rain", "reading a book under a tree", "building a sandcastle", "flying through space", "painting a masterpiece", "singing a beautiful melody", "solving a complex puzzle"
    ];
    const styles = [
        "in the style of a Studio Ghibli film", "in a cyberpunk aesthetic", "as a photorealistic render", "with a dreamlike atmosphere", "in the style of an Impressionist painting", "with vibrant, saturated colors", "in a dark and mysterious tone", "with a whimsical and playful feel", "in a minimalist and abstract style", "with a dramatic chiaroscuro lighting"
    ];
    const details = [
        "with intricate details and textures", "in a highly detailed and realistic style", "with a soft and ethereal glow", "with a sense of depth and scale", "with a focus on contrasting light and shadow", "with a harmonious color palette", "with dynamic and flowing lines", "with a sense of movement and energy", "with a touch of magic and wonder", "with a unique and captivating perspective"
    ];

    let prompt = `${subjects[Math.floor(Math.random() * subjects.length)]} ${actions[Math.floor(Math.random() * actions.length)]} ${styles[Math.floor(Math.random() * styles.length)]} ${details[Math.floor(Math.random() * details.length)]}`;

    promptInput.value = prompt;
}

// Function to fetch and display gallery images
function loadGallery() {
    fetch('/images')
        .then(response => response.json())
        .then(images => {
            const galleryContainer = document.getElementById('imageGallery');
            let delay = 0;
            images.forEach(imageUrl => {
                const img = document.createElement('img');
                img.src = imageUrl;
                img.alt = 'Gallery Image';
                img.style.opacity = 0;
                galleryContainer.appendChild(img);

                // Add click event to each gallery image
                img.addEventListener('click', () => {
                    openOverlay(imageUrl);
                });

                setTimeout(() => {
                    img.style.animation = `fadeIn 0.5s ease-in-out`;
                    img.style.opacity = 1;
                }, delay);

                delay += 100;

                // Highlight the first image after it is generated or explicitly query parameter is set
                if (new URLSearchParams(window.location.search).has('highlight_latest')) {
                    openOverlay(imageUrl);
                    removeQueryParam('highlight_latest');
                }
            });
        })
        .catch(error => {
            console.error('Error fetching images:', error);
        });
}

// Function to open the overlay
function openOverlay(imageUrl) {
    document.getElementById('overlayImage').src = imageUrl;
    document.getElementById('imageOverlay').style.display = 'block';
}

// Function to close the overlay
function closeOverlay() {
    document.getElementById('imageOverlay').style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    const serviceInfoDiv = document.querySelector('.service-info-title'); 
    const serviceInfoBody = document.querySelector('.service-info-body');
    const icon = serviceInfoDiv.querySelector('.material-icons');

    serviceInfoDiv.addEventListener('click', function() {
        icon.classList.toggle('rotated');
        serviceInfoBody.classList.toggle('collapsed');
    });
});

// Load the gallery when the page loads
window.onload = loadGallery;