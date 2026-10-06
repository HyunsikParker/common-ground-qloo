# Integration

The Node/MCP factory requires an explicit private access file. It never uses an ambient key by itself, initializes a budget on restart or switches to fixtures after a live failure.

Version 1 access metadata can bind published free-use limits. Version 2 binds the issued event key, absence of a fee notice and conservative operator limits. Its fields are version: 2, eventAccessVerified, feeNoticeReceived:false, limitBasis:operator, evidenceUrl, verifiedAt, expiresAt, maxRequests, minIntervalMs, credentialFile and budgetFile. expiresAt is the operator stop time in version 2; it is not a claimed issuer expiration. Keep files mode 0600 in a privately owned mode 0700 directory outside the source tree. Provision the allowance once; do not reset it. A suspended policy cannot send requests.

The supported Qloo CLI runs in an isolated child environment. The key stays in its private file and is never an argument. Only one GET to the exact event endpoint is allowed per command; authentication, rate limit, timeout, malformed and oversize response states remain distinct. No redirect or automatic retry is allowed. The canonical decoder accepts specific type metadata and the observed generic Insights entity shape, bound to the documented place filter; explicit conflicting categories remain rejected.

The hosted Worker uses the same domain/ranking logic with documented event HTTP endpoints. It reserves each attempted request atomically in D1 before fetch, including operational failures. Anonymous sessions also use fenced D1 transactions. A missing or changed allowance stops requests. Initialize it once during owner-private provisioning with the existing measured count, then disable ALLOWANCE_INITIALIZATION_ALLOWED before public access. Store QLOO_API_KEY as a runtime secret, never in source or .openai/hosting.json.

The two runtimes were checked against actual event responses. Public cultural test interests are not a user-preference study. The operator request limits do not claim an official quota or guarantee perpetual issuer availability.
