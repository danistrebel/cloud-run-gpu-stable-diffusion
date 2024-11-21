import requests
from flask import Flask, render_template, request, make_response, jsonify, redirect
from google.cloud import storage
import os
import logging


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)

logger = logging.getLogger(__name__)


# Flask app

app = Flask(__name__)

# Replace with your actual Torchserve Stable diffusion API endpoint
API_ENDPOINT = os.environ.get("SD_API_ENDPOINT") or "http://localhost:8181/predictions/stable_diffusion"

# Storage bucket that holds all generated images
STORAGE_BUCKET_NAME = os.environ.get("STORAGE_BUCKET_NAME")

def list_recently_created_image_urls():
    """Lists all objects in a bucket with their public URLs."""

    if not STORAGE_BUCKET_NAME:
        return []

    storage_client = storage.Client()
    bucket = storage_client.bucket(STORAGE_BUCKET_NAME)

    return [f"images/{blob.name}" for blob in sorted(bucket.list_blobs(), key=lambda blob: blob.time_created, reverse=True)]

@app.route("/", methods=["GET", "POST"])
def index():
    if request.method == "POST":
        prompt_text = request.form["prompt"]
        logger.info("Received image generation request: %s", prompt_text)

        data = {"data": prompt_text}
        response = requests.post(f"{API_ENDPOINT}/predictions/stable_diffusion", data=data)

        if response.status_code == 200:
            return redirect("/?highlight_latest=true")
        else:
            logger.error("API request failed with status code: %s", response.status_code)
            logger.error("API response: %s", response.text)
            return f"Error: API request failed: {response.text}"

    return render_template("index.html")

# Pass-through route for /predictions/stable_diffusion
@app.route('/predictions/stable_diffusion', methods=['POST'])
def stable_diffusion_proxy():
    return requests.post(f"{API_ENDPOINT}/predictions/stable_diffusion", data=request.data).content

@app.route('/images')
def get_gallery_images():
    """Returns a JSON response with URLs of recently created images."""
    image_urls = list_recently_created_image_urls()
    return jsonify(image_urls)

@app.route('/images/<filename>', methods=['GET'])
def serve_image(filename):
    storage_client = storage.Client()
    bucket = storage_client.bucket(STORAGE_BUCKET_NAME)
    blob = bucket.blob(filename)
    image_data = blob.download_as_bytes()

    # Set cache control headers for one day
    response = make_response(image_data)
    response.headers['Cache-Control'] = 'public, max-age=86400' 

    return response

@app.route('/images/<path:filename>', methods=['DELETE'])
def delete_image(filename):
    storage_client = storage.Client()
    bucket = storage_client.bucket(STORAGE_BUCKET_NAME)
    blob = bucket.blob(filename)
    blob.delete()
    return jsonify({"message": "Image deleted successfully"})


if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=os.environ.get("PORT", 8080))
