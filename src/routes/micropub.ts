import type { APIRoute } from "astro";
import { formToMicroformats, parseRequest } from "../lib/parsers.js";
import { withAuth } from "../lib/token-verification.js";
import {
	addCorsHeaders,
	createAuthError,
	createCorsPreflightResponse,
	createErrorResponse,
	getRuntimeConfig,
	isAbsoluteUrl,
} from "../lib/utils.js";
import type { MicroformatsEntry } from "../types/micropub.js";
import {
	convertToUpdateOperations,
	validateMicropubAction,
	validateMicropubCreate,
} from "../validators/micropub.js";
import { hasScope } from "../validators/scopes.js";

export const prerender = false;

/**
 * OPTIONS - CORS preflight
 */
export const OPTIONS: APIRoute = async () => {
	const config = getRuntimeConfig();
	return createCorsPreflightResponse(config.security?.allowedOrigins);
};

/**
 * GET - Query endpoint
 */
export const GET: APIRoute = async ({ request, url }) => {
	const config = getRuntimeConfig();

	// Verify authentication
	const auth = await withAuth(
		request,
		config.indieauth.tokenEndpoint,
		config.indieauth.tokenVerificationCache,
	);

	if (!auth.authorized || !auth.verification) {
		return createAuthError(401, "invalid_token");
	}

	const query = url.searchParams.get("q");

	if (!query) {
		return addCorsHeaders(
			createErrorResponse(400, "invalid_request", "Missing q parameter"),
			config.security?.allowedOrigins,
		);
	}

	try {
		// Handle different query types
		switch (query) {
			case "config":
				return handleConfigQuery(config);

			case "source":
				return await handleSourceQuery(url, config);

			case "syndicate-to":
				return handleSyndicateToQuery(config);

			default:
				return addCorsHeaders(
					createErrorResponse(
						400,
						"invalid_request",
						`Unknown query: ${query}`,
					),
					config.security?.allowedOrigins,
				);
		}
	} catch (error) {
		console.error("Query error:", error);
		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Internal server error"),
			config.security?.allowedOrigins,
		);
	}
};

/**
 * POST - Create, update, or delete posts
 */
export const POST: APIRoute = async ({ request }) => {
	const config = getRuntimeConfig();

	// Verify authentication
	const auth = await withAuth(
		request,
		config.indieauth.tokenEndpoint,
		config.indieauth.tokenVerificationCache,
	);

	if (!auth.authorized || !auth.verification) {
		return createAuthError(401, "invalid_token");
	}

	try {
		// Parse request
		const { data, files } = await parseRequest(request);

		// Check if this is an action request (update/delete/undelete)
		if (data.action) {
			return await handleAction(data, auth.verification, config);
		}

		// Otherwise, it's a create request
		return await handleCreate(data, files, auth.verification, config);
	} catch (error: any) {
		console.error("Micropub error:", error);

		if (error.message?.includes("content type")) {
			return addCorsHeaders(
				createErrorResponse(400, "invalid_request", error.message),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Internal server error"),
			config.security?.allowedOrigins,
		);
	}
};

/**
 * Handle config query
 */
function handleConfigQuery(config: any): Response {
	const responseData: any = {};

	// Add media endpoint
	if (config.micropub?.mediaEndpoint) {
		const mediaUrl = new URL(
			config.micropub.mediaEndpoint,
			config.siteUrl,
		).toString();
		responseData["media-endpoint"] = mediaUrl;
	}

	// Add syndication targets
	if (config.micropub?.syndicationTargets?.length > 0) {
		responseData["syndicate-to"] = config.micropub.syndicationTargets;
	}

	// Add supported queries
	responseData.queries = ["config", "source", "syndicate-to"];

	return addCorsHeaders(
		new Response(JSON.stringify(responseData), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		}),
		config.security?.allowedOrigins,
	);
}

/**
 * Handle source query
 */
async function handleSourceQuery(url: URL, config: any): Promise<Response> {
	const sourceUrl = url.searchParams.get("url");

	if (!sourceUrl) {
		return addCorsHeaders(
			createErrorResponse(400, "invalid_request", "Missing url parameter"),
			config.security?.allowedOrigins,
		);
	}

	// Validate that URL is absolute
	if (!isAbsoluteUrl(sourceUrl)) {
		return addCorsHeaders(
			createErrorResponse(400, "invalid_request", "URL must be absolute"),
			config.security?.allowedOrigins,
		);
	}

	// Get properties filter if specified
	const properties = url.searchParams.getAll("properties[]");

	try {
		const entry = await config.storage.adapter.getPost(
			sourceUrl,
			properties.length > 0 ? properties : undefined,
		);

		if (!entry) {
			return addCorsHeaders(
				createErrorResponse(404, "not_found", "Post not found"),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			new Response(JSON.stringify(entry), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
			config.security?.allowedOrigins,
		);
	} catch (error) {
		console.error("Source query error:", error);
		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Failed to retrieve post"),
			config.security?.allowedOrigins,
		);
	}
}

/**
 * Handle syndicate-to query
 */
function handleSyndicateToQuery(config: any): Response {
	const targets = config.micropub?.syndicationTargets || [];

	return addCorsHeaders(
		new Response(
			JSON.stringify({
				"syndicate-to": targets,
			}),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			},
		),
		config.security?.allowedOrigins,
	);
}

/**
 * Handle create request
 */
async function handleCreate(
	data: any,
	_files: any[] | undefined, // Reserved for future multipart support
	verification: any,
	config: any,
): Promise<Response> {
	// Check for create scope
	if (
		config.security?.requireScope &&
		!hasScope(verification.scope, "create")
	) {
		return createAuthError(403, "insufficient_scope", undefined, "create");
	}

	let entry: MicroformatsEntry;

	try {
		// Convert to MF2 format based on input type
		if (data.type && data.properties) {
			// Already in MF2 JSON format
			entry = validateMicropubCreate(data);
		} else if (data.h) {
			// Form-encoded format
			entry = formToMicroformats(data);
		} else {
			return addCorsHeaders(
				createErrorResponse(
					400,
					"invalid_request",
					"Missing required fields (type and properties, or h)",
				),
				config.security?.allowedOrigins,
			);
		}

		// Validate required content
		if (
			!entry.properties.content &&
			!entry.properties.name &&
			!entry.properties.photo
		) {
			return addCorsHeaders(
				createErrorResponse(
					400,
					"invalid_request",
					"Post must have content, name, or photo",
				),
				config.security?.allowedOrigins,
			);
		}

		// Create post via storage adapter
		const metadata = await config.storage.adapter.createPost(entry);

		// Return 201 Created with Location header
		return addCorsHeaders(
			new Response(null, {
				status: 201,
				headers: {
					Location: metadata.url,
				},
			}),
			config.security?.allowedOrigins,
		);
	} catch (error: any) {
		console.error("Create error:", error);

		if (error.name === "ZodError") {
			return addCorsHeaders(
				createErrorResponse(400, "invalid_request", "Invalid entry format"),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Failed to create post"),
			config.security?.allowedOrigins,
		);
	}
}

/**
 * Handle action requests (update/delete/undelete)
 */
async function handleAction(
	data: any,
	verification: any,
	config: any,
): Promise<Response> {
	try {
		const action = validateMicropubAction(data);

		switch (action.action) {
			case "update":
				return await handleUpdate(action, verification, config);

			case "delete":
				return await handleDelete(action, verification, config);

			case "undelete":
				return await handleUndelete(action, verification, config);

			default:
				return addCorsHeaders(
					createErrorResponse(
						400,
						"invalid_request",
						`Unknown action: ${data.action}`,
					),
					config.security?.allowedOrigins,
				);
		}
	} catch (error: any) {
		console.error("Action error:", error);

		if (error.name === "ZodError") {
			return addCorsHeaders(
				createErrorResponse(400, "invalid_request", "Invalid action format"),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Failed to perform action"),
			config.security?.allowedOrigins,
		);
	}
}

/**
 * Handle update action
 */
async function handleUpdate(
	action: any,
	verification: any,
	config: any,
): Promise<Response> {
	// Check for update scope
	if (
		config.security?.requireScope &&
		!hasScope(verification.scope, "update")
	) {
		return createAuthError(403, "insufficient_scope", undefined, "update");
	}

	if (!config.micropub?.enableUpdates) {
		return addCorsHeaders(
			createErrorResponse(403, "forbidden", "Updates are disabled"),
			config.security?.allowedOrigins,
		);
	}

	// Validate URL is absolute
	if (!isAbsoluteUrl(action.url)) {
		return addCorsHeaders(
			createErrorResponse(400, "invalid_request", "URL must be absolute"),
			config.security?.allowedOrigins,
		);
	}

	try {
		// Convert update request to operations
		const operations = convertToUpdateOperations(action);

		// Apply update via storage adapter
		await config.storage.adapter.updatePost(action.url, operations);

		return addCorsHeaders(
			new Response(null, { status: 204 }),
			config.security?.allowedOrigins,
		);
	} catch (error: any) {
		console.error("Update error:", error);

		if (error.message?.includes("not found")) {
			return addCorsHeaders(
				createErrorResponse(404, "not_found", "Post not found"),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Failed to update post"),
			config.security?.allowedOrigins,
		);
	}
}

/**
 * Handle delete action
 */
async function handleDelete(
	action: any,
	verification: any,
	config: any,
): Promise<Response> {
	// Check for delete scope
	if (
		config.security?.requireScope &&
		!hasScope(verification.scope, "delete")
	) {
		return createAuthError(403, "insufficient_scope", undefined, "delete");
	}

	if (!config.micropub?.enableDeletes) {
		return addCorsHeaders(
			createErrorResponse(403, "forbidden", "Deletes are disabled"),
			config.security?.allowedOrigins,
		);
	}

	// Validate URL is absolute
	if (!isAbsoluteUrl(action.url)) {
		return addCorsHeaders(
			createErrorResponse(400, "invalid_request", "URL must be absolute"),
			config.security?.allowedOrigins,
		);
	}

	try {
		await config.storage.adapter.deletePost(action.url);

		return addCorsHeaders(
			new Response(null, { status: 204 }),
			config.security?.allowedOrigins,
		);
	} catch (error: any) {
		console.error("Delete error:", error);

		if (error.message?.includes("not found")) {
			return addCorsHeaders(
				createErrorResponse(404, "not_found", "Post not found"),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Failed to delete post"),
			config.security?.allowedOrigins,
		);
	}
}

/**
 * Handle undelete action
 */
async function handleUndelete(
	action: any,
	verification: any,
	config: any,
): Promise<Response> {
	// Check for delete scope (undelete requires same permission as delete)
	if (
		config.security?.requireScope &&
		!hasScope(verification.scope, "delete")
	) {
		return createAuthError(403, "insufficient_scope", undefined, "delete");
	}

	if (!config.micropub?.enableDeletes) {
		return addCorsHeaders(
			createErrorResponse(403, "forbidden", "Undelete is disabled"),
			config.security?.allowedOrigins,
		);
	}

	// Validate URL is absolute
	if (!isAbsoluteUrl(action.url)) {
		return addCorsHeaders(
			createErrorResponse(400, "invalid_request", "URL must be absolute"),
			config.security?.allowedOrigins,
		);
	}

	try {
		await config.storage.adapter.undeletePost(action.url);

		return addCorsHeaders(
			new Response(null, { status: 204 }),
			config.security?.allowedOrigins,
		);
	} catch (error: any) {
		console.error("Undelete error:", error);

		if (error.message?.includes("not found")) {
			return addCorsHeaders(
				createErrorResponse(404, "not_found", "Post not found"),
				config.security?.allowedOrigins,
			);
		}

		return addCorsHeaders(
			createErrorResponse(500, "server_error", "Failed to undelete post"),
			config.security?.allowedOrigins,
		);
	}
}
