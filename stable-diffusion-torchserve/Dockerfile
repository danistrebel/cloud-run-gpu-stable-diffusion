FROM pytorch/torchserve:0.12.0-gpu AS base

USER root

WORKDIR /home/model-server

COPY requirements.txt ./
RUN pip install --upgrade -r ./requirements.txt

# Stage 1 build the serving container.
FROM base AS serve-gcs

# ENV MODEL_NAME='stabilityai/stable-diffusion-3.5-large'
ENV MODEL_NAME='stabilityai/stable-diffusion-3.5-large-turbo'

ENV MAR_STORE_PATH='/home/model-server/model-store'
ENV MAR_FILE_NAME='model'
RUN mkdir -p $MAR_STORE_PATH

COPY config.properties ./
COPY stable_diffusion_handler.py ./

# creates the mar file used by torchserve
RUN torch-model-archiver --force --model-name ${MAR_FILE_NAME} --version 1.0 --handler stable_diffusion_handler.py -r requirements.txt --export-path ${MAR_STORE_PATH}

COPY start.sh ./

# entrypoint
CMD ["./start.sh"]