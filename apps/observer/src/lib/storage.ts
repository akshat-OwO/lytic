import {
	DeleteObjectCommand,
	GetObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { Data, Effect } from "effect";

import { env } from "./env.js";

// Tagged errors
export class R2UploadError extends Data.TaggedError("R2UploadError")<{
	key: string;
	message: string;
	cause?: string;
}> {}

export class R2DownloadError extends Data.TaggedError("R2DownloadError")<{
	key: string;
	message: string;
	cause?: string;
}> {}

export class R2DeleteError extends Data.TaggedError("R2DeleteError")<{
	key: string;
	message: string;
	cause?: string;
}> {}

export class R2ListError extends Data.TaggedError("R2ListError")<{
	prefix: string;
	message: string;
	cause?: string;
}> {}

export class Storage extends Effect.Service<Storage>()("observer/Storage", {
	accessors: true,
	sync: () => {
		const client = new S3Client({
			region: "auto",
			endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
			credentials: {
				accessKeyId: env.R2_ACCESS_KEY_ID,
				secretAccessKey: env.R2_SECRET_ACCESS_KEY,
			},
		});

		const bucketName = env.R2_BUCKET_NAME;

		const upload = Effect.fn("Storage.upload")(function* (
			key: string,
			body: string | Buffer,
			contentType: string,
		) {
			yield* Effect.log("Uploading to R2", { key, contentType });

			const command = new PutObjectCommand({
				Bucket: bucketName,
				Key: key,
				Body: body,
				ContentType: contentType,
			});

			yield* Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) =>
					new R2UploadError({
						key,
						message: "Failed to upload to R2",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			yield* Effect.log("Upload successful", { key });
			return key;
		});

		const download = Effect.fn("Storage.download")(function* (key: string) {
			yield* Effect.log("Downloading from R2", { key });

			const command = new GetObjectCommand({
				Bucket: bucketName,
				Key: key,
			});

			const response = yield* Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) =>
					new R2DownloadError({
						key,
						message: "Failed to download from R2",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			if (!response.Body) {
				return yield* new R2DownloadError({
					key,
					message: "Empty response body from R2",
				});
			}

			const body = yield* Effect.tryPromise({
				try: () => response.Body!.transformToString(),
				catch: (error) =>
					new R2DownloadError({
						key,
						message: "Failed to read response body",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			yield* Effect.log("Download successful", {
				key,
				size: body.length,
			});
			return body;
		});

		const deleteObject = Effect.fn("Storage.delete")(function* (
			key: string,
		) {
			yield* Effect.log("Deleting from R2", { key });

			const command = new DeleteObjectCommand({
				Bucket: bucketName,
				Key: key,
			});

			yield* Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) =>
					new R2DeleteError({
						key,
						message: "Failed to delete from R2",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			yield* Effect.log("Delete successful", { key });
			return key;
		});

		const listByPrefix = Effect.fn("Storage.listByPrefix")(function* (
			prefix: string,
		) {
			yield* Effect.log("Listing objects from R2", { prefix });

			const command = new ListObjectsV2Command({
				Bucket: bucketName,
				Prefix: prefix,
			});

			const response = yield* Effect.tryPromise({
				try: () => client.send(command),
				catch: (error) =>
					new R2ListError({
						prefix,
						message: "Failed to list objects from R2",
						cause:
							error instanceof Error
								? error.message
								: String(error),
					}),
			});

			const keys = response.Contents?.map((obj) => obj.Key || "") || [];
			yield* Effect.log("List successful", {
				prefix,
				count: keys.length,
			});
			return keys;
		});

		const uploadJson = Effect.fn("Storage.uploadJson")(function* (
			key: string,
			data: unknown,
		) {
			const body = JSON.stringify(data, null, 2);
			return yield* upload(key, body, "application/json");
		});

		return {
			upload,
			download,
			delete: deleteObject,
			listByPrefix,
			uploadJson,
		};
	},
}) {}
