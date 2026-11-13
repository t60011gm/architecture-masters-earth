# Runtime split-model validation

- Run `node test-split-models.mjs` from the repository root.
- All seven real split GLBs reassemble byte-for-byte to original SHA-256 and byte lengths. GLB magic and internal declared length match.
- Tests cover byte order, oversize and undersize responses, checksum mismatch, HTTP failure, cancellation, relative model URL matching, and unchanged ordinary model loading.
- The production island entry path still calls `GLTFLoader.parseAsync` after transport; existing Meshopt decoder, lighting, error/retry UI, and stale-ticket cancellation remain unchanged.
- The runtime performs sequential, streamed chunk downloads only when that island is entered, and does not cache model buffers globally. It allocates one full-model byte buffer before loading; this is lossless transport, not progressive rendering or reduced total transfer.
- Browser/WebGL verification is not completed: the cloud Chromium process could not start due to OS socket permissions, including an escalated attempt. GPU rendering, phone memory use and touch interactions were not verified.
- Serve `dist/` over HTTPS or localhost, including its `backup-parts/` directory and `model-parts.json`. Do not use `file://` or deploy only the JavaScript/HTML files.
