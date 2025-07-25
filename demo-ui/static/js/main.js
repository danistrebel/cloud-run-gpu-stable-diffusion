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

window.onload = () => {
    loadGallery();
};

let lastGalleryLoadTime = 0;

function galleryAutoReload() {
    if (loadGeneratorInterval) {
        loadGallery();
        setTimeout(galleryAutoReload, 3000);
    } else {
        console.log("Generator Not Running")
    }
    
}

function loadGallery() {

    fetch('/images')
        .then(response => response.json())
        .then(images => {
            const galleryContainer = document.getElementById('imageGallery');
            isInitialLoad = galleryContainer.children.length === 0;
            let delay = 0;
            images.forEach(imageUrl => {
                if (!document.querySelector(`img[src="${imageUrl}"]`)) {
                    const img = document.createElement('img');
                    img.src = imageUrl;
                    img.alt = 'Gallery Image';
                    img.style.opacity = 0;

                    if (isInitialLoad) {
                        galleryContainer.appendChild(img);
                    } else {
                        galleryContainer.insertBefore(img, galleryContainer.firstChild);
                    }

                    img.addEventListener('click', () => {
                        openOverlay(imageUrl);
                    });

                    setTimeout(() => {
                        img.style.animation = `fadeIn 0.5s ease-in-out`;
                        img.style.opacity = 1;
                    }, delay);

                    delay += 100;
                }
            });
        })
        .catch(error => {
            console.error('Error fetching images:', error);
        });
}


// Update Load generator
let loadGeneratorInterval = null;

function updateLoadGeneratorStatus() {
    fetch('/generator/report')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json()
        })
        .then(data => {
            console.log('Load generator status:', data);
            updateGeneratorStatusUI(data);
        })
        .catch(error => {
            console.error('Error fetching Load generator status:', error);
        });
}

function updateGeneratorStatusUI(data) {
    const loadGenViz = document.querySelector(".serivce-info-entry.clients .service-info-viz");
    const gpuInstanceViz = document.querySelector(".serivce-info-entry.instances .service-info-viz");

    if (loadGenViz && gpuInstanceViz) {
        updateInstances(loadGenViz, data.clients_running, "load-gen-active");
        updateInstances(gpuInstanceViz, data.gpu_instances_running, "cloud-run-instance");
    } else {
        console.error("Could not find one of the service info viz elements in the dom. load-generator-running is probably not visible.");
    }

    document.getElementById('generator-images-generated').innerText = data.num_images_generated || 0;
    document.getElementById('generator-images-per-second').innerText = data.images_per_second || 0;
    document.getElementById('generator-images-generation-latency').innerText = (data.image_generation_latency || 0) + 's';
    document.getElementById('generator-requests-per-second').innerText = (data.requests_per_second || 0);
    document.getElementById('generator-gpu-instances').innerText = (data.gpu_instances_running || 0);
    document.getElementById('generator-clients').innerText = `${data.clients_running}/${data.clients_configured}`;

    const startTime = new Date(data.start_time);
    const now = new Date();
    const elapsedTime = Math.floor((now - startTime) / 1000); // in seconds
    const formattedElapsedTime = formatTime(elapsedTime);
    document.getElementById('generator-time-elapsed').innerText = formattedElapsedTime;
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
        return `${minutes}m ${remainingSeconds}s`;
    } else {
        return `${remainingSeconds}s`;
    }
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
            document.getElementById('generator-time').style.display = 'none';
            document.getElementById('ad-hoc-generator-card').style.display = 'block';
        })
        .catch(error => {
            console.error('Error stopping load generator:', error);
            alert("Error stopping load generator. Check the console for details.");
        });


}

function startLoadGenerator() {
    const targetUrl = document.getElementById('load-generator-target').value;
    const numClients = document.getElementById('load-generator-clients').value;
    const ramp = document.getElementById('load-generator-ramp').value

    if (!targetUrl || !numClients || !ramp) {
        alert("Please enter all of the following values: target URL, number of clients, and ramp interval.");
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
            document.getElementById('ad-hoc-generator-card').style.display = 'none';
            document.getElementById('load-generator-running').style.display = 'flex';
            document.getElementById('generator-time').style.display = 'inline';

            // Start polling for generator status every second
            loadGeneratorInterval = setInterval(updateLoadGeneratorStatus, 1000);
            // Auto refresh image gallery
            galleryAutoReload()
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

async function generateImage() {
    document.getElementById("loading").style.display = "block";

    const target = document.getElementById('ad-hoc-generator-target')?.value;
    const prompt = document.getElementById('ad-hoc-generator-prompt').value;

    const data = { prompt, target };

    try {
        const response = await fetch('/predictions/stable_diffusion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Request failed with status ${response.status}: ${errorData.error}`);
        }

        loadGallery();

        const responseData = await response.json();
        const imageFileName = responseData.image;
        if (imageFileName) {
            openOverlay(`/images/${imageFileName}`);        
        }
        
        document.getElementById("loading").style.display = "none";
    } catch (error) {
        console.error('Error:', error);
        document.getElementById("loading").style.display = "none";
    }
}

document.addEventListener('DOMContentLoaded', function () {
    const container = document.querySelector('.demo-controls');
    container.addEventListener('click', function (event) {
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
