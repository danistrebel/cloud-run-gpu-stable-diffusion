# Cloud Run GPU Demo Stable Diffusion

Runs a Cloud Run Service with GPU with Stable Diffusion.

This is a demo based on the public [Cloud Run Stable Diffusion Codelab](https://codelabs.developers.google.com/codelabs/how-to-use-stable-diffusion-cloud-run-gpu) and adapted with:
- Demo UI
- Storage of generated images

## Prequisites

```sh
export PROJECT_ID="$(gcloud config get project)" 
export REGION="us-central1"

gcloud services enable run.googleapis.com cloudbuild.googleapis.com storage.googleapis.com --project $PROJECT_ID
```

Create an artifact repo

```sh
gcloud artifacts repositories create demo \
  --repository-format=docker \
  --location="$REGION" \
  --project="$PROJECT_ID"
```

Create the buckets for storing images

```sh
gsutil mb -p $PROJECT_ID -l $REGION gs://$PROJECT_ID-images 
```

## Setup Nat

```sh
gcloud compute routers create nat-router --network default --region $REGION --project $PROJECT_ID
gcloud compute routers nats create nat --router=nat-router --region=$REGION --auto-allocate-nat-external-ips --nat-all-subnet-ip-ranges  --project $PROJECT_ID
```

## Build the Torchserve Image

```sh
(cd stable-diffusion-torchserve && gcloud builds submit --tag "us-central1-docker.pkg.dev/$PROJECT_ID/demo/torchserve-stable-diffusion" --project $PROJECT_ID)
```

## Build the Demo UI Image

```sh
(cd demo-ui && gcloud builds submit --tag "us-central1-docker.pkg.dev/$PROJECT_ID/demo/demo-ui" --project $PROJECT_ID)
```

## Deploy the Cloud Run Service

```sh
sed "s/PROJECT_ID/${PROJECT_ID}/g" stable-diffusion-service.template.yaml > stable-diffusion-service.yaml
gcloud beta run services replace stable-diffusion-service.yaml --project $PROJECT_ID
```

## Test it


### CLI Test

```sh
PROMPT_TEXT="a cat sitting in a magnolia tree"

SERVICE_URL=$(gcloud run services describe stable-diffusion-gpu --region $REGION --format 'value(status.url)' --project $PROJECT_ID)

time curl $SERVICE_URL/predictions/stable_diffusion \
   -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
   -d "data=$PROMPT_TEXT" | base64 --decode > image.jpg
```


### UI With Cloud Run Proxy

```sh
gcloud run services proxy stable-diffusion-gpu --region $REGION --port=8081 --project=$PROJECT_ID 
```

### UI with IAP

Make sure you have set the cloud run invoker for the IAP service account:

```sh
PROJECT_NUMBER="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')"
gcloud run services add-iam-policy-binding stable-diffusion-gpu \
--region=$REGION \
--member="serviceAccount:service-$PROJECT_NUMBER@gcp-sa-iap.iam.gserviceaccount.com" \
--role='roles/run.invoker' \
--project=$PROJECT_ID
```

![](./img/demo.png)