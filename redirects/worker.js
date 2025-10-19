export default {
  async fetch(request, env, ctx) {
    // Get the URL from the request
    const url = new URL(request.url);

    // Create the redirect URL by combining letmeprompt.com with the path and search params
    const redirectUrl = `https://contextarea.com${url.pathname}${url.search}`;

    // Return a 301 permanent redirect
    return Response.redirect(redirectUrl, 301);
  },
};
