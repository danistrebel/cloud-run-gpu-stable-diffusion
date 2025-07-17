import io
import os
import datetime
import logging
from typing import Dict
import sys
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from pydantic import BaseModel

import torch
from diffusers import AutoPipelineForText2Image
from PIL import Image

from google.cloud import storage

logging.basicConfig(
    stream=sys.stdout,
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

if not torch.cuda.is_available():
    raise RuntimeError("This application requires a CUDA-enabled GPU.")
DEVICE = "cuda"

MODEL_ID = "stabilityai/sdxl-turbo"
DTYPE = torch.float16
MODEL_BUCKET_NAME = os.environ.get("MODEL_BUCKET_NAME")
MODEL_CACHE_DIR = "/app/model"

pipe = None

def download_model_from_gcs(bucket_name: str, destination_directory: str):
    """Downloads a model from a GCS bucket to a local directory."""
    logger.info(f"Downloading model from GCS bucket: {bucket_name}")
    
    storage_client = storage.Client()
    bucket = storage_client.bucket(bucket_name)
    blobs = bucket.list_blobs()

    destination_path = Path(destination_directory)
    destination_path.mkdir(parents=True, exist_ok=True)

    for blob in blobs:
        destination_file_path = destination_path / blob.name
        destination_file_path.parent.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Downloading {blob.name} to {destination_file_path}")
        blob.download_to_filename(destination_file_path)
    
    logger.info("Model download from GCS complete.")
    return destination_directory

@asynccontextmanager
async def lifespan(app: FastAPI):
    global pipe
    model_source = MODEL_ID
    
    if MODEL_BUCKET_NAME:
        logger.info(f"MODEL_BUCKET_NAME is set to '{MODEL_BUCKET_NAME}'.")
        
        if not Path(MODEL_CACHE_DIR).joinpath("model_index.json").is_file():
            logger.info(f"Model not found in cache ({MODEL_CACHE_DIR}). Downloading from GCS.")
            model_source = download_model_from_gcs(MODEL_BUCKET_NAME, MODEL_CACHE_DIR)
        else:
            logger.info(f"Model found in cache: {MODEL_CACHE_DIR}")
            model_source = MODEL_CACHE_DIR
    else:
        logger.info("MODEL_BUCKET_NAME is not set. Downloading model from Hugging Face Hub.")

    logger.info(f"Loading model from: {model_source}")
    pipe = AutoPipelineForText2Image.from_pretrained(
        model_source,
        torch_dtype=DTYPE,
        variant="fp16"
    ).to(DEVICE)
    logger.info("Model loaded successfully.")
    yield
    pipe = None


app = FastAPI(lifespan=lifespan)

class GenerationRequest(BaseModel):
    prompt: str

@app.post("/predictions/stable_diffusion")
def generate(req: GenerationRequest) -> Dict[str, str]:
    if pipe is None:
        return {"error": "Model is loading, please try again in a moment."}

    logger.info("Generating image for prompt: %s", req.prompt)
    image = pipe(
        prompt=req.prompt,
        num_inference_steps=1,
        guidance_scale=0.0,
    ).images[0]

    image_name = "generated_image.jpg"
    
    if os.environ.get("STORAGE_BUCKET_NAME"):
        bucket = storage.Client().bucket(os.environ["STORAGE_BUCKET_NAME"])
        future_date = datetime.datetime(3000, 1, 1)
        time_diff = future_date - datetime.datetime.now()
        milliseconds_until_3000 = int(time_diff.total_seconds() * 1000)
        image_name = f"{milliseconds_until_3000:016d}.jpg"
        with io.BytesIO() as output:
            image.save(output, format="JPEG")
            image_bytes = output.getvalue()
            blob = bucket.blob(image_name)
            blob.upload_from_string(image_bytes, content_type='image/jpeg')
    else:
        image.save(image_name)

    return {"image": image_name}

@app.get("/status")
def status():
    return {"model-ready": pipe is not None}

@app.get("/")
def root():
    return {"status": "ok"}