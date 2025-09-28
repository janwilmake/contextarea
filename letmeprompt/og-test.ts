//@ts-ignore
import providers from "./providers.json";
import { ImageResponse } from "workers-og";
export { DORM, SQLStreamPromptDO, RatelimitDO } from "./main";
export default {
  fetch: (request) => {
    const provider = providers.find((x) => x.model === "grok-4-latest");

    // Extract a preview of the prompt - display first 40 chars
    const headline = "Making a new app called Fair Completions";

    // Ensure all divs have display: flex and only using inline styles
    const ogHtml = `<div style="display: flex; width: 1200px; height: 630px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #2a2a2a;">
    
    <!-- Top orange section -->
    <div style="position: absolute; top: 0; left: 0; display:flex; width: 100%; height: 80px; background-color: #feca57;"></div>
    
    <!-- Bottom orange section -->
    <div style="position: absolute; bottom: 0; left: 0; display:flex; width: 100%; height: 80px; background-color: #feca57;"></div>
    
    <!-- Main content container -->
    <div style="display: flex; flex-direction: column; width: 100%; height: 100%; padding: 100px 60px; justify-content: center; align-items: center; position: relative; z-index: 1;">
      
      <!-- Title -->
      <div style="display: flex; margin-bottom: 40px;">
        <h1 style="color: #ffffff; font-size: 72px; font-weight: 600; margin: 0; text-align: center; line-height: 1.2;">${headline}</h1>
      </div>
      
      <!-- Subtitle with provider info and signature -->
      <div style="display: flex; align-items: center; gap: 20px;">
        
        <!-- Provider icon -->
        ${
          provider?.icon
            ? `<img src="https://letmeprompt.com${provider.icon}" alt="${
                provider?.name || "Provider"
              }" width="48" height="48" style="width: 48px; height: 48px; border-radius: 24px;" />`
            : ""
        }
        
        <!-- Provider name -->
        <span style="color: #e5e5e5; font-size: 36px; font-weight: 400;">${
          provider?.name || "AI"
        } Generation</span>
        
        <span style="color: #b5b5b5; font-size: 36px; font-weight: 300;">by Jan Wilmake</span>
        
        <!-- Profile picture -->
        <img src="https://pbs.twimg.com/profile_images/1904848783290019841/1duyf2SK_400x400.jpg" width="48" height="48" alt="Jan Wilmake" style="width: 48px; height: 48px; border-radius: 24px;" />
        
      </div>
      
    </div>
  </div>`;

    // Generate the image using ImageResponse from workers-og
    try {
      console.log("Generating OG image");

      const imageResponse = new ImageResponse(ogHtml, {
        width: 1200,
        height: 630,
        format: "png",
        debug: true,
      });

      // Ensure proper headers are set
      const imageHeaders = new Headers({});
      imageHeaders.set("Content-Type", "image/png");
      // imageHeaders.set("Cache-Control", "public, max-age=86400");

      console.log("OG image generated successfully");

      return new Response(imageResponse.body, {
        headers: imageHeaders,
        status: 200,
      });
    } catch (error) {
      console.error("Error generating OG image:", error);
      //   headers.set("Content-Type", "text/plain");
      return new Response("Error generating image: " + error.message, {
        status: 500,
        headers: {},
      });
    }
  },
};
