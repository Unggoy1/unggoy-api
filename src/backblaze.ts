import {
  S3Client,
} from "@aws-sdk/client-s3";

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;
const endpoint = process.env.AWS_ENDPOINT_URL;

if (!accessKeyId || !secretAccessKey || !region || !endpoint) {
  throw new Error("Missing required S3 credentials in environment variables.");
}

// Create a custom S3Client with B2-compatible configuration
const b2 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
  region: process.env.AWS_REGION ?? "",
  endpoint: process.env.AWS_ENDPOINT_URL ?? "",
  forcePathStyle: true,
});

// Function to list all buckets
export default b2;
