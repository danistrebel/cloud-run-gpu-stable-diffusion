# Demo UI

## Preparation

```sh
export PROJECT_ID="$(gcloud config get project)" 
export REGION="us-central1"
```

Make a storage bucket to hold the generated images

```sh
gsutil mb -p $PROJECT_ID -l $REGION gs://$PROJECT_ID-images 
```

## Local Run 

```sh
STORAGE_BUCKET_NAME="$PROJECT_ID-images" \
GENERATOR_URL="https://.." \
SD_API_ENDPOINT="https://.." \
python main.py
```