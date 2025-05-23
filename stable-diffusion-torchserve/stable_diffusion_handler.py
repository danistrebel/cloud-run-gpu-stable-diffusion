from abc import ABC
import base64
import datetime
import io
import logging
import os

from diffusers import StableDiffusionXLImg2ImgPipeline
from diffusers import StableDiffusionXLPipeline
from google.cloud import storage
import numpy as np
from PIL import Image
import torch
from ts.torch_handler.base_handler import BaseHandler


logger = logging.getLogger(__name__)


def image_to_base64(image: Image.Image) -> str:
  """Convert a PIL image to a base64 string."""
  buffer = io.BytesIO()
  image.save(buffer, format="JPEG")
  image_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
  return image_str


class DiffusersHandler(BaseHandler, ABC):
  """Diffusers handler class for text to image generation."""

  def __init__(self):
    self.initialized = False

  def initialize(self, ctx):
    """In this initialize function, the Stable Diffusion model is loaded and

       initialized here.
    Args:
        ctx (context): It is a JSON Object containing information pertaining to
          the model artifacts parameters.
    """
    logger.info("Initialize DiffusersHandler")
    self.manifest = ctx.manifest
    properties = ctx.system_properties
    model_dir = properties.get("model_dir")
    model_name = os.environ["MODEL_NAME"]
    model_refiner = os.environ["MODEL_REFINER"]
    # set optional model_cache to the env variable or None
    model_cache_path = os.environ.get("MODEL_CACHE_PATH")

    self.bucket = None
    if os.environ.get("STORAGE_BUCKET_NAME"):
      self.bucket = storage.Client().bucket(os.environ["STORAGE_BUCKET_NAME"])

    logger.info(
        "GPU device count: %s",
        torch.cuda.device_count(),
    )
    logger.info(
        "select the GPU device, cuda is available: %s",
        torch.cuda.is_available(),
    )
    self.device = torch.device(
        "cuda:" + str(properties.get("gpu_id"))
        if torch.cuda.is_available() and properties.get("gpu_id") is not None
        else "cpu"
    )
    logger.info("Device used: %s", self.device)

    # open the pipeline to the inferenece model
    # this is generating the image
    logger.info("Downloading model %s", model_name)
    self.pipeline = StableDiffusionXLPipeline.from_pretrained(
        model_name,
        variant="fp16",
        torch_dtype=torch.float16,
        use_safetensors=True,
        cache_dir=model_cache_path,
    ).to(self.device)
    logger.info("done Downloading model %s", model_name)

    # open the pipeline to the refiner
    # refiner is used to remove artifacts from the image
    logger.info("Downloading refiner %s", model_refiner)
    self.refiner = StableDiffusionXLImg2ImgPipeline.from_pretrained(
        model_refiner,
        variant="fp16",
        torch_dtype=torch.float16,
        use_safetensors=True,
        cache_dir=model_cache_path,
    ).to(self.device)
    logger.info("done Downloading refiner %s", model_refiner)

    self.n_steps = 40
    self.high_noise_frac = 0.8
    self.initialized = True
    # Commonly used basic negative prompts.
    logger.info("using negative_prompt")
    self.negative_prompt = (
        "worst quality, normal quality, low quality, low res, blurry"
    )

  # this handles the user request
  def preprocess(self, requests):
    """Basic text preprocessing, of the user's prompt.

    Args:
        requests (str): The Input data in the form of text is passed on to the
          preprocess function.

    Returns:
        list : The preprocess function returns a list of prompts.
    """
    logger.info("Process request started")
    inputs = []
    for _, data in enumerate(requests):
      input_text = data.get("data")
      if input_text is None:
        input_text = data.get("body")
      if isinstance(input_text, (bytes, bytearray)):
        input_text = input_text.decode("utf-8")
      logger.info("Received text: '%s'", input_text)
      inputs.append(input_text)
    return inputs

  def inference(self, inputs):
    """Generates the image relevant to the received text.

    Args:
        input_batch (list): List of Text from the pre-process function is passed
          here

    Returns:
        list : It returns a list of the generate images for the input text
    """
    logger.info("Inference request started")
    # Handling inference for sequence_classification.
    # Expecting a list of string from the inputs
    images = self.pipeline(
        prompt=inputs,
        negative_prompt=self.negative_prompt,
        num_inference_steps=self.n_steps,
        denoising_end=self.high_noise_frac,
        output_type="latent",
    ).images
    logger.info("Done model")

    # The refiner expect a list of image from the image variable
    images = self.refiner(
        prompt=inputs,
        negative_prompt=self.negative_prompt,
        num_inference_steps=self.n_steps,
        denoising_start=self.high_noise_frac,
        image=images,
    ).images
    logger.info("Done refiner")

    return images

  def postprocess(self, inference_output):
    """Post Process Function converts the generated image into Torchserve readable format.

    Args:
        inference_output (list): It contains the generated image of the input
          text.

    Returns:
        (list): Returns a list of the images.
    """
    logger.info("Post process request started")
    images = []
    response_size = 0
    for image in inference_output:
      # Save image to GCS
      image_name = None
      if self.bucket:
          # Calculate milliseconds until year 3000 so we can have decreasing file names over time.
          future_date = datetime.datetime(3000, 1, 1)
          time_diff = future_date - datetime.datetime.now()
          milliseconds_until_3000 = int(time_diff.total_seconds() * 1000)
          image_name = f"{milliseconds_until_3000:016d}.jpg"
          with io.BytesIO() as output:
            image.save(output, format="JPEG")
            image_bytes = output.getvalue()
            # Create a blob object
            blob = self.bucket.blob(image_name)

            # Upload the file
            blob.upload_from_string(image_bytes, content_type='image/jpeg')
      if image_name is None:
          image_name = "no_bucket_" + datetime.datetime.now().strftime("%Y%m%d_%H%M%S") + ".jpg"
          image.save(image_name)
      images.append({"image": image_name})

    logger.info(
        "Images %d, paths: [%s]",
        len(images),
        ", ".join(img["image"] for img in images),
    )
    return images
