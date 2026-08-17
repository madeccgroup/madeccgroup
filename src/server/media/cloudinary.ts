import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Cloudinary configuration is missing. " +
      "Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET."
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

export { cloudinary };

export async function uploadMediaFile(
  filepath: string,
  options: {
    publicId: string;
    resourceType: "image" | "video" | "raw" | "auto";
    folder?: string;
  }
) {
  return cloudinary.uploader.upload(filepath, {
    public_id: options.publicId,
    folder:
      options.folder ||
      process.env.MEDIA_FOLDER ||
      "madecc/ai-studio",
    resource_type: options.resourceType,
    overwrite: false,
    unique_filename: false,
    use_filename: false,
  });
}

export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video" | "raw"
) {
  return cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
}
