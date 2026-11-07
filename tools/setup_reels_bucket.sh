#!/usr/bin/env bash
# One-time setup for posting Reels from the dashboard. Instagram only fetches videos from a URL,
# so the dashboard copies each video to this private bucket and gives Meta a signed link that
# expires in an hour, then deletes the copy.
#
# Creates (if missing), in the polyjuice-project Google Cloud project:
#   - bucket gs://polyjuice-project-reels: private, public access blocked, files auto-deleted after 1 day
#   - service account dashboard-reels, allowed to manage files in that bucket only
#   - its key in secrets/gcs-reels.json (gitignored, owner-only)
#
# Run after `gcloud auth login`:   bash tools/setup_reels_bucket.sh
set -euo pipefail

PROJECT=polyjuice-project
BUCKET=${1:-polyjuice-project-reels}
LOCATION=us-central1
SA_NAME=dashboard-reels
SA="$SA_NAME@$PROJECT.iam.gserviceaccount.com"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KEY="$ROOT/secrets/gcs-reels.json"

if [ -z "$(gcloud auth list --filter=status:ACTIVE --format='value(account)')" ]; then
  echo "Not logged in. Run: gcloud auth login" >&2
  exit 1
fi

echo "→ Enabling Cloud Storage and IAM APIs"
gcloud services enable storage.googleapis.com iam.googleapis.com --project "$PROJECT"

if gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT" >/dev/null 2>&1; then
  echo "→ Bucket gs://$BUCKET already exists"
else
  echo "→ Creating private bucket gs://$BUCKET"
  gcloud storage buckets create "gs://$BUCKET" --project "$PROJECT" --location "$LOCATION" \
    --uniform-bucket-level-access --public-access-prevention
fi

echo "→ Auto-deleting files older than 1 day (backstop; the dashboard deletes them right away)"
LIFECYCLE="$(mktemp)"
echo '{"rule":[{"action":{"type":"Delete"},"condition":{"age":1}}]}' >"$LIFECYCLE"
gcloud storage buckets update "gs://$BUCKET" --lifecycle-file "$LIFECYCLE"
rm -f "$LIFECYCLE"

if gcloud iam service-accounts describe "$SA" --project "$PROJECT" >/dev/null 2>&1; then
  echo "→ Service account $SA_NAME already exists"
else
  echo "→ Creating service account $SA_NAME"
  gcloud iam service-accounts create "$SA_NAME" --project "$PROJECT" --display-name "Video dashboard: Reels handoff"
fi

echo "→ Allowing it to manage files in gs://$BUCKET only"
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$SA" \
  --role roles/storage.objectAdmin >/dev/null

if [ -f "$KEY" ]; then
  echo "→ Key already in secrets/gcs-reels.json"
else
  echo "→ Saving a key to secrets/gcs-reels.json"
  mkdir -p "$ROOT/secrets"
  umask 077
  TMP="$(mktemp)"
  gcloud iam service-accounts keys create "$TMP" --iam-account "$SA" --project "$PROJECT"
  python3 -c 'import json,sys; k=json.load(open(sys.argv[1])); k["bucket"]=sys.argv[2]; json.dump(k,open(sys.argv[3],"w"),indent=2)' \
    "$TMP" "$BUCKET" "$KEY"
  rm -f "$TMP"
  chmod 600 "$KEY"
fi

echo "✓ Done. In the dashboard: Channel & captions → Connections → Test upload (doesn't post)."
echo "  (New permissions can take a minute to apply; if the first test fails with 403, try again.)"
