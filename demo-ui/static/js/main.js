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
    const promptInput = document.getElementById('ad-hoc-generator-prompt');

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
    promptInput.parentElement.classList.add("is-dirty");
}


// Function to fetch and display gallery images
function loadGallery() {
    fetch('/images')
        .then(response => response.json())
        .then(images => {
            const galleryContainer = document.getElementById('imageGallery');
            let delay = 0;
            images.forEach(imageUrl => {
                if (!document.querySelector(`img[src="${imageUrl}"]`)) {  //check if img already exists
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.alt = 'Gallery Image';
                    img.style.opacity = 0;
                    galleryContainer.insertBefore(img, galleryContainer.firstChild);

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
                }
            });
        })
        .catch(error => {
            console.error('Error fetching images:', error);
        });
}


// Update Load generator
let loadGeneratorInterval = null;

function updateLoadGeneratorStatus(){
    fetch('/generator/report')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json()
        })
        .then(data => {
            console.log('Load generator status:', data);
            updateUI(data);
        })
        .catch(error => {
            console.error('Error fetching Load generator status:', error);
        });
}

function updateUI(data) {
    const loadGenViz = document.querySelector(".serivce-info-entry.clients .service-info-viz");
    const gpuInstanceViz = document.querySelector(".serivce-info-entry.instances .service-info-viz");

    if (loadGenViz && gpuInstanceViz) {
        updateInstances(loadGenViz, data.clients_running, "load-gen-active");
        updateInstances(gpuInstanceViz, data.gpu_instances_running, "cloud-run-instance");
    } else {
      console.error("Could not find one of the service info viz elements in the dom. load-generator-running is probably not visible.");
    }
    document.querySelector('.serivce-info-entry.clients .service-info-label').innerText = `Load Generator Clients: ${data.clients_running}/${data.clients_configured}`
    document.querySelector('.serivce-info-entry.instances .service-info-label').innerText = `GPU Instances: ${data.gpu_instances_running}`
    document.getElementById('generator-images-generated').innerText = data.num_images_generated;

    
    const startTime = new Date(data.start_time);
    const now = new Date();
    const elapsedTime = Math.floor((now - startTime) / 1000); // in seconds
    const formattedElapsedTime = formatTime(elapsedTime);
    document.getElementById('generator-time-elapsed').innerText = formattedElapsedTime;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

function updateInstances(container, count, activeClass) {
    container.innerHTML = "";
    for (let i = 0; i < count; i++) {
        const instance = document.createElement("div");
        instance.classList.add("instance", activeClass);
        container.appendChild(instance);
    }    
}

function stopLoadGenerator() {
    fetch(`/generator/stop`, {
        method: 'GET'
    }).then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text()
    })
    .then(data => {
        if (loadGeneratorInterval) {
            clearInterval(loadGeneratorInterval);
            loadGeneratorInterval = null;
        }
        document.getElementById('load-generator-stopped').style.display = 'flex';
        document.getElementById('load-generator-running').style.display = 'none';
    })
    .catch(error => {
        console.error('Error stopping load generator:', error);
        alert("Error stopping load generator. Check the console for details.");
    });

    
}

function startLoadGenerator() {
    const targetUrl = document.getElementById('load-generator-target').value;
    const numClients = document.getElementById('load-generator-clients').value;
    const ramp = document.getElementById('load-generator-ramp').value;

    if (!targetUrl || !numClients || !ramp) {
        alert("Please enter both target URL, number of clients and ramp interval.");
        return;
    }

    fetch(`/generator/start?target=${encodeURIComponent(targetUrl)}&clients=${numClients}&ramp=${ramp}s`, {
        method: 'GET'
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text()
        })
        .then(data => {
            console.log('Load generator started:', data);
            document.getElementById('load-generator-stopped').style.display = 'none';
            document.getElementById('load-generator-running').style.display = 'flex';
            
            // Start polling for generator status every second
            loadGeneratorInterval = setInterval(updateLoadGeneratorStatus, 1000);
        })
        .catch(error => {
            console.error('Error starting load generator:', error);
            alert("Error starting load generator. Check the console for details.");
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
    const container = document.querySelector('.demo-controls');

    container.addEventListener('click', function(event) {
        const serviceInfoDiv = event.target.closest('.service-info-title');
        if (serviceInfoDiv) {
            const serviceInfoBody = serviceInfoDiv.nextElementSibling;
            const icon = serviceInfoDiv.querySelector('.material-icons');

            if (serviceInfoBody) {
                icon.classList.toggle('rotated');
                serviceInfoBody.classList.toggle('collapsed');
            }
        }
    });
});

// Load the gallery when the page loads
window.onload = loadGallery;
setInterval(loadGallery, 3000);
