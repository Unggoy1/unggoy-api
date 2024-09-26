import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-node";
import nsfw from "../nsfw";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import b2 from "../backblaze";
import { Validation } from "./errors";

async function getChannelCount(image: File) {
  // Convert File to Buffer (you can use .bytes() or .arrayBuffer for this)
  const buffer = await image.arrayBuffer();

  // Use sharp to get image metadata
  const { channels } = await sharp(Buffer.from(buffer)).metadata();

  return channels; // Will return 3 for RGB, or 4 for RGBA
}

export async function checkImageNsfw(image: File): Promise<Boolean> {
  // Convert the file to Uint8Array for TensorFlow.js
  const arrayBuffer = await image.arrayBuffer();
  const uint8Array = new Uint8Array(arrayBuffer);

  // Decode image with TensorFlow.js, using the detected number of channels
  const decodedImage = tf.node.decodeImage(uint8Array, 3) as tf.Tensor3D; // thought channel 4 was needed for rgba but nsfw.classify only works with 3
  const predictions = await nsfw.classify(decodedImage);
  decodedImage.dispose();
  const unsafeCategories = ["Porn", "Hentai", "Sexy"];

  // Check if any unsafe categories have high probability
  const isUnsafe = predictions.some(
    (prediction) =>
      unsafeCategories.includes(prediction.className) &&
      prediction.probability > 0.75,
  );
  return isUnsafe;
}

/**
 * Resizes, optimizes, and converts a File to WebP format, returning the optimized buffer.
 * @param file - The file input from a form submission.
 * @param maxWidth - The maximum width for resizing the image.
 * @param maxHeight - The maximum height for resizing the image.
 * @param quality - Optional quality setting for the WebP output (default: 80).
 * @returns - A promise that resolves to the optimized WebP buffer.
 */
export async function resizeAndOptimizeFileToWebP(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 80,
): Promise<Buffer> {
  try {
    // Convert the File to an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Convert the ArrayBuffer to a Buffer
    const buffer = Buffer.from(arrayBuffer);

    // Use sharp to resize the image and convert it to WebP
    const optimizedWebPBuffer = await sharp(buffer)
      .resize({
        width: maxWidth,
        height: maxHeight,
        fit: sharp.fit.inside, // Ensures the image fits within the bounds without cropping
        withoutEnlargement: true, // Prevent enlarging images smaller than the max size
      })
      .webp({ quality }) // Compress the image to WebP with the specified quality
      .toBuffer();

    // Return the optimized WebP buffer
    return optimizedWebPBuffer;
  } catch (error) {
    console.error("Error optimizing image:", error);
    throw new Error("Failed to resize and optimize image");
  }
}

export async function uploadToS3(
  buffer: Buffer,
  bucketName: string,
  key: string,
) {
  const params = {
    Bucket: bucketName,
    Key: key, // The file name or path in the S3 bucket
    Body: buffer,
    ContentType: "image/webp", // Since the image is now WebP
  };

  try {
    const data = await b2.send(new PutObjectCommand(params));
    console.log(`File uploaded successfully: ${data}`);
    return data;
  } catch (error) {
    console.error("Error uploading to S3:", error);
    throw error;
  }
}

// Function to delete a file from S3
export async function deleteFromS3(
  bucketName: string,
  key: string, // Existing file name
) {
  const params = {
    Bucket: bucketName,
    Key: key, // The file path or name to delete
  };

  try {
    const data = await b2.send(new DeleteObjectCommand(params));
    console.log(`File deleted successfully: ${key}`);
    return data;
  } catch (error) {
    console.error("Error deleting from S3:", error);
    throw error;
  }
}

// Function to handle updating the file in S3
export async function updateS3File(
  buffer: Buffer,
  bucketName: string,
  newKey: string, // New file name
  oldUrl: string, // Existing URL stored in the database
) {
  try {
    // Extract the old S3 key from the URL
    const oldKey = extractS3Key(oldUrl);

    // Delete the old file if it exists
    if (oldKey) {
      await deleteFromS3(bucketName, oldKey);
    } else {
      console.log("No existing file to delete.");
    }

    // Upload the new file
    const uploadResult = await uploadToS3(buffer, bucketName, newKey);
    return uploadResult;
  } catch (error) {
    console.error("Error during update process:", error);
    throw error;
  }
}
export function extractS3Key(url: string): string | null {
  const s3BaseUrl = process.env.IMAGE_DOMAIN; // Base URL of your S3 files
  const key = url.includes(s3BaseUrl) ? url.split(s3BaseUrl)[1] : null;
  return key; // Returns the key (e.g., oldkey.png) or null if no match
}

export function generateUniqueFilename(userId: string): string {
  // Get the current timestamp
  const timestamp = Date.now(); // Returns the number of milliseconds since 1970-01-01

  // Create a unique filename using the userId and timestamp
  const uniqueFilename = `${userId}${timestamp}.webp`;

  return uniqueFilename;
}
