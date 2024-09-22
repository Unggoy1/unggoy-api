import sharp from "sharp";
import * as tf from "@tensorflow/tfjs-node";
import nsfw from "../nsfw";

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
