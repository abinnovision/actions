import * as core from "@actions/core";

(async () => {
	const token = core.getState("token");
	if (!token) {
		core.info("No token to revoke");
		return;
	}

	if (core.getBooleanInput("skip-token-revoke")) {
		core.info("Token revocation skipped");
		return;
	}

	const apiUrl = process.env.GITHUB_API_URL ?? "https://api.github.com";
	const response = await fetch(`${apiUrl}/installation/token`, {
		method: "DELETE",
		headers: {
			Accept: "application/vnd.github+json",
			Authorization: `Bearer ${token}`,
			"X-GitHub-Api-Version": "2022-11-28",
		},
		signal: AbortSignal.timeout(10_000),
	});

	if (response.status === 204) {
		core.info("Token revoked");
		return;
	}

	if (response.status === 401) {
		core.info("Token already expired or revoked");
		return;
	}

	core.warning(`Failed to revoke token: HTTP ${String(response.status)}`);
})().catch((error: unknown) => {
	core.warning(
		`Failed to revoke token: ${error instanceof Error ? error.message : String(error)}`,
	);
});
