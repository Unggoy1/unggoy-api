import {
  S3Client,
  ListBucketsCommand,
  CreateBucketCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_REGION;
const endpoint = process.env.AWS_ENDPOINT_URL;

if (!accessKeyId || !secretAccessKey || !region || !endpoint) {
  throw new Error("Missing required S3 credentials in environment variables.");
}
const b2 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
  region: process.env.AWS_REGION ?? "",
  endpoint: process.env.AWS_ENDPOINT_URL ?? "",
});

// Function to list all buckets
const listBuckets = async () => {
  try {
    const response = await b2.send(new ListBucketsCommand({}));
    console.log("Buckets in account:");
    response!.Buckets!.forEach((bucket) => {
      console.log(bucket.Name);
    });
  } catch (err) {
    console.error("Error listing buckets:", err);
    throw err;
  }
};

await listBuckets();
export default b2;
