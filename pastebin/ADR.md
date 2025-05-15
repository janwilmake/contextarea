This error happens locally more quickly, but also happens in production for larger files: `✘ [ERROR]   TypeError: Can't read from request stream after response has been sent.`

This means we must not be done with the response before the request stopped streaming; this cannot be done, not even when using waitUntil. Therefore, the solution shown here, streams the URL directly, but only stops the stream after request is completely streamed in.
