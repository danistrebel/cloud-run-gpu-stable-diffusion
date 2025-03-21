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
API_ENDPOINT = os.environ.get("SD_API_ENDPOINT") or "http://localhost:8181"
logging.info("Using API endpoint: %s", API_ENDPOINT)

GENERATOR_URL = os.environ.get("GENERATOR_URL")

# Storage bucket that holds all generated images
STORAGE_BUCKET_NAME = os.environ.get("STORAGE_BUCKET_NAME")

storage_client = storage.Client()
image_bucket = None

if STORAGE_BUCKET_NAME:
    try:
        image_bucket = storage_client.bucket(STORAGE_BUCKET_NAME)
    except Exception as e:
        logger.error(f"Error accessing storage bucket: {e}")
else:
    logger.warning("STORAGE_BUCKET_NAME environment variable not set")


def list_recently_created_image_urls():
    """Lists up to 200 recently created objects in a bucket with their publicly accessible URLs."""

    if not image_bucket:
        return []
    blobs = sorted(image_bucket.list_blobs(), key=lambda blob: blob.time_created, reverse=True)
    return [f"images/{blob.name}" for blob in blobs[:200]]


@app.route("/", methods=["GET"])
def index():
    return render_template("index.html", default_api_endpoint=API_ENDPOINT)

@app.route('/predictions/stable_diffusion', methods=['POST'])
def stable_diffusion_proxy():
    try:
      data = request.get_json(force=True)
      target = data.get('target', None)
      prompt = data.get('prompt', None)
      
      if not prompt:
          logger.error("No prompt provided in the request.")
          return jsonify({"error": "No prompt provided"}), 400

      api_data = {"data": prompt}

      if target and target.startswith('http'):
        response = requests.post(f"{target}/predictions/stable_diffusion", data=api_data)
      else:
        logger.warning(f"Invalid target URL: {target}, using default API endpoint: {API_ENDPOINT}")
        response = requests.post(f"{API_ENDPOINT}/predictions/stable_diffusion", json=data)
      response.raise_for_status()
      logger.info(f"Response: {response.content}")
      return make_response(response.content, response.status_code, response.headers.items())
    except requests.exceptions.RequestException as e:
        logger.error(f"Error proxying stable diffusion request: {e}, response: {e.response.content if e.response else 'No Response'}")
        return jsonify({"error": f"Failed to proxy stable diffusion request: {e}"}), 500
    except Exception as e:
        logger.error(f"Error proxying stable diffusion request: {e}")
        return jsonify({"error": "Failed to proxy stable diffusion request"}), 500

@app.route('/images')
def get_gallery_images():
    """Returns a JSON response with URLs of recently created images."""
    image_urls = list_recently_created_image_urls()
    return jsonify(image_urls)

@app.route('/images/<filename>', methods=['GET'])
def serve_image(filename):
    blob = image_bucket.blob(filename)
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

@app.route('/generator/report', methods=['GET'])
def generator_status():
    """Fetches and returns the status from the GENERATOR_URL."""
    try:
        response = requests.get(f"{GENERATOR_URL}/report")
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        logger.error(f"Error fetching generator status: {e}")
        return jsonify({"error": "Failed to fetch generator status"}), 500

@app.route('/generator/start')
def start_load_generator():
    target = request.args.get('target')
    clients = request.args.get('clients')

    try:
        response = requests.get(f"{GENERATOR_URL}/start?target={target}&clients={clients}")
        response.raise_for_status()
        return "OK"
    except requests.exceptions.RequestException as e:
        logger.error(f"Error starting load generator: {e}")
        return jsonify({"error": "Failed to start load generator"}), 500

@app.route('/generator/stop')
def stop_load_generator():
    try:
        response = requests.get(f"{GENERATOR_URL}/stop")
        response.raise_for_status()
        return "OK"
    except requests.exceptions.RequestException as e:
        logger.error(f"Error stopping load generator: {e}")
        return jsonify({"error": "Failed to stop load generator"}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=os.environ.get("PORT", 8080))
