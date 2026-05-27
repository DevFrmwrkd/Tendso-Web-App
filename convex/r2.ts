import { v } from 'convex/values';
import { query, action } from './_generated/server';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Get the R2 client instance
 */
function getR2Client() {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

    if (!accountId || !accessKeyId || !secretAccessKey) {
        throw new Error('R2 credentials not configured');
    }

    return new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
}

/**
 * Get bucket name from environment
 */
function getBucketName() {
    const bucketName = process.env.R2_BUCKET_NAME;
    if (!bucketName) {
        throw new Error('R2_BUCKET_NAME not configured');
    }
    return bucketName;
}

/**
 * Get public URL prefix for R2 bucket
 */
function getPublicUrlPrefix() {
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!publicUrl) {
        throw new Error('R2_PUBLIC_URL not configured');
    }
    // Ensure no trailing slash
    return publicUrl.replace(/\/$/, '');
}

/**
 * Get a streamable (public) URL for an R2 file key.
 * Returns the public URL directly without signing.
 *
 * Accepts either `{ key }` (web) or `{ fileKey }` (mobile APK stores R2 keys
 * under this name). Mobile-referenced — do not remove the fileKey alias.
 */
export const getStreamableUrl = query({
    args: {
        key: v.optional(v.string()),
        fileKey: v.optional(v.string()),
    },
    handler: async (_ctx, args) => {
        const k = args.key ?? args.fileKey;
        if (!k) throw new Error('key or fileKey is required');
        const publicUrl = process.env.R2_PUBLIC_URL;
        if (!publicUrl) {
            return null;
        }
        const prefix = publicUrl.replace(/\/$/, '');
        return `${prefix}/${k}`;
    },
});

/**
 * Shared implementation for R2 upload URL generation.
 *
 * Accepts BOTH arg shapes because web and the deployed Google Play APK use
 * different field names and neither can be changed without a rebuild of the
 * other side:
 *
 *   Web callers (app/submit/photos, app/submit/interview, app/edit-profile):
 *     { fileName, fileType, submissionId?, mediaType? }
 *
 *   Mobile Play Store binary (docs/changes/MOBILE-R2-FIX.md §2):
 *     { folder, filename, contentType }
 *
 * Convex argument validators reject unknown fields, so BOTH name variants are
 * declared on the validator as optional and the handler normalizes at runtime.
 * Missing-required errors are raised from inside the handler with a clear
 * message rather than relying on the validator.
 *
 * Return value includes both `key` and `fileKey` for the same reason — the
 * mobile APK reads `fileKey`, web reads `key`.
 */
type UploadArgs = {
    // Web-style (camelCase)
    fileName?: string;
    fileType?: string;
    mediaType?: 'photo' | 'video' | 'audio' | 'profile' | 'avatar';
    // Mobile-style (lowercase + explicit folder)
    filename?: string;
    contentType?: string;
    folder?: string;
    // Common
    submissionId?: string;
};

async function generateR2UploadUrlImpl(args: UploadArgs) {
    const client = getR2Client();
    const bucketName = getBucketName();
    const publicUrlPrefix = getPublicUrlPrefix();

    // Normalize name + type across web/mobile call shapes.
    const name = args.fileName ?? args.filename;
    const type = args.fileType ?? args.contentType;
    if (!name) {
        throw new Error('fileName (or filename) is required');
    }
    if (!type) {
        throw new Error('fileType (or contentType) is required');
    }

    // Route to bucket folder. Priority:
    //   1. explicit `folder` arg (mobile style)
    //   2. map from `mediaType` (web style)
    //   3. default `images/`
    const folderMap: Record<string, string> = {
        photo: 'images',
        video: 'videos',
        audio: 'audio',
        profile: 'avatars',
        avatar: 'avatars',
    };
    const folder =
        args.folder ||
        (args.mediaType ? folderMap[args.mediaType] || 'images' : 'images');

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const extension = name.split('.').pop() || 'bin';
    const key = `${folder}/${timestamp}-${randomStr}.${extension}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: type,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
    const publicUrl = `${publicUrlPrefix}/${key}`;

    // Return both `key` and `fileKey` — mobile reads fileKey, web reads key.
    return { uploadUrl, publicUrl, key, fileKey: key };
}

// Validator that tolerates BOTH web and mobile arg shapes. Every field is
// optional at the validator layer; required-field checks happen in the
// handler with clearer error messages.
const uploadUrlArgs = {
    fileName: v.optional(v.string()),
    fileType: v.optional(v.string()),
    filename: v.optional(v.string()),
    contentType: v.optional(v.string()),
    folder: v.optional(v.string()),
    submissionId: v.optional(v.string()),
    mediaType: v.optional(
        v.union(
            v.literal('photo'),
            v.literal('video'),
            v.literal('audio'),
            v.literal('profile'),
            v.literal('avatar'),
        )
    ),
} as const;

/**
 * Generate a presigned URL for uploading a file to R2.
 *
 * Two exported names point at the same implementation:
 *   - `generateUploadUrl` — used by the web app AND by the current Play Store APK
 *   - `generateR2UploadUrl` — reserved for future mobile builds
 *
 * Mobile-referenced — do not remove either export. The Play Store binary is
 * compiled against `api.r2.generateUploadUrl` and calls it at runtime.
 * Removing either would 404 already-shipped installs.
 */
export const generateUploadUrl = action({
    args: uploadUrlArgs,
    handler: async (_ctx, args) => generateR2UploadUrlImpl(args),
});

export const generateR2UploadUrl = action({
    args: uploadUrlArgs,
    handler: async (_ctx, args) => generateR2UploadUrlImpl(args),
});

/**
 * Delete a file from R2.
 *
 * Accepts either `{ key }` (web) or `{ fileKey }` (mobile).
 * Mobile-referenced — do not remove the fileKey alias.
 */
export const deleteFile = action({
    args: {
        key: v.optional(v.string()),
        fileKey: v.optional(v.string()),
    },
    handler: async (_ctx, args) => {
        const k = args.key ?? args.fileKey;
        if (!k) throw new Error('key or fileKey is required');
        const client = getR2Client();
        const bucketName = getBucketName();

        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: k,
        });

        await client.send(command);
        return { success: true };
    },
});

/**
 * Generate a presigned URL for uploading an APK to R2.
 *
 * Uses a STABLE storage key — `releases/negosyo-digital.apk` — so the
 * downloaded file is always named "negosyo-digital.apk" without any
 * Content-Disposition rewrites or route-level indirection. R2 derives
 * the download filename from the storage key, and re-uploads simply
 * overwrite the previous file at the same key.
 *
 * Trade-off accepted on purpose: no per-release version history in R2.
 * If we ever need historical releases, snapshot apk_uploaded_at +
 * archive the bytes elsewhere; don't pollute the storage key.
 */
const APK_STABLE_KEY = 'releases/negosyo-digital.apk';

export const generateApkUploadUrl = action({
    args: {
        fileName: v.string(),
        fileType: v.string(),
    },
    handler: async (_ctx, args) => {
        const client = getR2Client();
        const bucketName = getBucketName();
        const publicUrlPrefix = getPublicUrlPrefix();

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: APK_STABLE_KEY,
            ContentType: args.fileType || 'application/vnd.android.package-archive',
        });

        const uploadUrl = await getSignedUrl(client, command, { expiresIn: 3600 });
        const publicUrl = `${publicUrlPrefix}/${APK_STABLE_KEY}`;

        return { uploadUrl, publicUrl, key: APK_STABLE_KEY };
    },
});

/**
 * Get a presigned URL for downloading a file (for private buckets).
 *
 * Accepts either `{ key }` (web) or `{ fileKey }` (mobile).
 * Mobile-referenced — do not remove the fileKey alias.
 */
export const getDownloadUrl = action({
    args: {
        key: v.optional(v.string()),
        fileKey: v.optional(v.string()),
    },
    handler: async (_ctx, args) => {
        const k = args.key ?? args.fileKey;
        if (!k) throw new Error('key or fileKey is required');
        const client = getR2Client();
        const bucketName = getBucketName();

        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: k,
        });

        // Generate presigned URL valid for 1 hour
        const url = await getSignedUrl(client, command, { expiresIn: 3600 });
        return { url };
    },
});
