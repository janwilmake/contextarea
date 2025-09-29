import { calculateWorkflow, WorkflowFile } from "./calculateWorkflow.js";

const files: { [p: string]: WorkflowFile<any> } = {
  "/README.md": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/README.md",
      ext: "md",
      code:
        "This should be enough to create a single website similar to hackernews.actionschema.com, but just with my filter, that is already pre-updated, pre-rendered, and has a simple cacheable HTML that updates each hour.\n" +
        "\n" +
        "The beauty is that this can be easily remixed into by changing the filter, or we can add a layer of complexity of topics, and create a page for each topic. If this becomes possible, the possibilities are endless. Imagine the same thing, now also answering a question about each filtered item.\n" +
        "\n" +
        "Effective allocation of LLM compute. Hidden algo. Open Data.\n" +
        "\n" +
        "Please note the dependency structure:\n" +
        "\n" +
        "![](shuffle-hackernews.drawio.svg)\n" +
        "\n" +
        "Because of the dependency structure, we only need to specify the hourly cron at the top-level, as it causes downstream staleness, causing them being redone too.\n" +
        "\n" +
        "all.json relies on itself as well and our algo shouldn't bother that.\n",
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: undefined,
  },
  "/allow-filter.md": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/allow-filter.md",
      ext: "md",
      code:
        "Check the following news item from hackernews:\n" +
        "\n" +
        "```\n" +
        "{item}\n" +
        "```\n" +
        "\n" +
        'Also consider the user specified filter: "I only want news about ai and coding and cool LLM stuff"\n' +
        "\n" +
        'Please respond with { "isAllowed": boolean } in a JSON Codeblock as to whether or not this item should be allowed according to the filter.\n',
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: undefined,
  },
  "/new-filtered.json": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/new-filtered.json",
      ext: "json",
      prompt:
        "---\n" +
        "api: actionschema-chat.jsonGpt\n" +
        "---\n" +
        "\n" +
        "A script that checks `new.json` and for each item, calls `jsonGpt` with the prompt in `allow-filter.md`, replacing {item} with the item.\n" +
        "\n" +
        "The result is a filtered JSON.\n",
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: ["/new.json", "/allow-filter.md"],
  },
  "/new.json": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/new.json",
      ext: "json",
      prompt:
        "---\n" +
        "cron: hour\n" +
        "api: hackernews.new, hackernews.item\n" +
        "---\n" +
        "\n" +
        "Script that calls the hackernews API to get new posts, and loops over each new post - for each id, get the post and check the date. Stop if it's more than 1 hour ago.\n" +
        "\n" +
        "The script returns a JSON with all posts in the past hour.\n",
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: [],
  },
  "/shuffle-hackernews.drawio.svg": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/shuffle-hackernews.drawio.svg",
      ext: "svg",
      code:
        '<svg host="65bd71144e" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="551px" height="291px" viewBox="-0.5 -0.5 551 291" content="&lt;mxfile&gt;&lt;diagram id=&quot;qfm8KLHImKyYh8m2ymHb&quot; name=&quot;Page-1&quot;&gt;1VhNc9owEP01PoaxURzMMZCkvXSmMxwajhprwWpli5EFmP76SljClmUnTEIacmG0T1+7b99KMgGa59U3gTfZD06ABeOQVAF6CMbjeILUrwYOBoimNbAWlNRQ1AAL+hcMGBp0SwmUzkDJOZN044IpLwpIpYNhIfjeHbbizN11g9fgAYsUMx/9RYnMajSJwwb/DnSd2Z2j0PTk2A42QJlhwvctCD0GaC44l3Urr+bANHeWl3re00DvyTEBhTxrwm09Y4fZ1gRnHJMHG63g24KAnhAGaLbPqITFBqe6d6/Sq7BM5kxZkWqa5UBIqAZ9ik6RKoUAz0GKgxpiJlhurDiMuW+Yji2WtVgeTw2ITXbXp5UbAlTDcNDPx60XPRCVemMWvAA3XKiofG61l5qlUWysh8qQdjQO1iiUU89tozVLm820o2XnDfCovOVbkRp3TfokFmswo0yx6UBepF8Aw5LuXI2/h8yxp60C9qPfJS98lhlTxQuv6wuXm7qiV7TSmhxmxdPgoODuXMGdjpmW4qY9gruE3u6+ut6Qr7f4s/SG+vR2s6JMggByhcKLks9TXhT5XHwt6cW+9Cx//197sac9zNgVSg5FXcnFnuSSHsklF5DcxH9rPI6D5CmYhXo3ldqbVPQQpkKTLjOlFPwPzDnjotGqKnTWgTCj60KZqSIMFD7TRFH1kLs3HTklhA2lwn34XOKimYxil/07n/1J7LOPLsD+9I313tT4stXzWr03Jb50Kvwd9Z5c0dMm6St3bi+bUU6uq+qjxNXd1L9nPqro7XnTooqqqqpGx5CviqVb9HlnY+Q/lj1y0q3YHY+jYxEW5F5/yurTjeGypOkZ1/VbLusPuqrPfSW2P/t6uLfY2RVudvjJqfK3+ebsvMRQ2MlpHY2Z1f6g7iyEuhqKOwvVHHgLqVziQ2vYRg8ohx1Gk8TZJ0Lhy35ZPfWPV43ag0aspxz06VeZzZ8U9fDmnx70+A8=&lt;/diagram&gt;&lt;/mxfile&gt;">\n' +
        "    <defs/>\n" +
        "    <g>\n" +
        '        <rect x="0" y="0" width="550" height="290" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/>\n' +
        '        <path d="M 130 205 L 153.63 205" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/>\n' +
        '        <path d="M 158.88 205 L 151.88 208.5 L 153.63 205 L 151.88 201.5 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/>\n' +
        '        <ellipse cx="85" cy="205" rx="45" ry="45" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/>\n' +
        '        <g transform="translate(-0.5 -0.5)">\n' +
        "            <switch>\n" +
        '                <foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;">\n' +
        '                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 88px; height: 1px; padding-top: 205px; margin-left: 41px;">\n' +
        '                        <div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;">\n' +
        '                            <div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">\n' +
        "                                new.json\n" +
        "                            </div>\n" +
        "                        </div>\n" +
        "                    </div>\n" +
        "                </foreignObject>\n" +
        '                <text x="85" y="209" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">\n' +
        "                    new.json\n" +
        "                </text>\n" +
        "            </switch>\n" +
        "        </g>\n" +
        '        <path d="M 250 205 L 283.63 205" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/>\n' +
        '        <path d="M 288.88 205 L 281.88 208.5 L 283.63 205 L 281.88 201.5 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/>\n' +
        '        <ellipse cx="205" cy="205" rx="45" ry="45" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/>\n' +
        '        <g transform="translate(-0.5 -0.5)">\n' +
        "            <switch>\n" +
        '                <foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;">\n' +
        '                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 88px; height: 1px; padding-top: 205px; margin-left: 161px;">\n' +
        '                        <div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;">\n' +
        '                            <div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">\n' +
        "                                new-filtered.json\n" +
        "                            </div>\n" +
        "                        </div>\n" +
        "                    </div>\n" +
        "                </foreignObject>\n" +
        '                <text x="205" y="209" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">\n' +
        "                    new-filtered.js...\n" +
        "                </text>\n" +
        "            </switch>\n" +
        "        </g>\n" +
        '        <path d="M 370 205 L 403.63 205" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/>\n' +
        '        <path d="M 408.88 205 L 401.88 208.5 L 403.63 205 L 401.88 201.5 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/>\n' +
        '        <ellipse cx="330" cy="205" rx="40" ry="40" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/>\n' +
        '        <g transform="translate(-0.5 -0.5)">\n' +
        "            <switch>\n" +
        '                <foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;">\n' +
        '                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 78px; height: 1px; padding-top: 205px; margin-left: 291px;">\n' +
        '                        <div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;">\n' +
        '                            <div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">\n' +
        "                                all.json\n" +
        "                            </div>\n" +
        "                        </div>\n" +
        "                    </div>\n" +
        "                </foreignObject>\n" +
        '                <text x="330" y="209" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">\n' +
        "                    all.json\n" +
        "                </text>\n" +
        "            </switch>\n" +
        "        </g>\n" +
        '        <rect x="47.5" y="215" width="75" height="30" fill="none" stroke="none" pointer-events="all"/>\n' +
        '        <g transform="translate(-0.5 -0.5)">\n' +
        "            <switch>\n" +
        '                <foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;">\n' +
        '                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 73px; height: 1px; padding-top: 230px; margin-left: 49px;">\n' +
        '                        <div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;">\n' +
        '                            <div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">\n' +
        "                                ⏰ hour-cron\n" +
        "                            </div>\n" +
        "                        </div>\n" +
        "                    </div>\n" +
        "                </foreignObject>\n" +
        '                <text x="85" y="234" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">\n' +
        "                    ⏰ hour-cron\n" +
        "                </text>\n" +
        "            </switch>\n" +
        "        </g>\n" +
        '        <path d="M 205 120 L 205 153.63" fill="none" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="stroke"/>\n' +
        '        <path d="M 205 158.88 L 201.5 151.88 L 205 153.63 L 208.5 151.88 Z" fill="rgb(0, 0, 0)" stroke="rgb(0, 0, 0)" stroke-miterlimit="10" pointer-events="all"/>\n' +
        '        <ellipse cx="205" cy="80" rx="40" ry="40" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/>\n' +
        '        <g transform="translate(-0.5 -0.5)">\n' +
        "            <switch>\n" +
        '                <foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;">\n' +
        '                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 78px; height: 1px; padding-top: 80px; margin-left: 166px;">\n' +
        '                        <div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;">\n' +
        '                            <div style="display: inline-block; font-size: 12px; font-family: Helvetica; color: rgb(0, 0, 0); line-height: 1.2; pointer-events: all; white-space: normal; overflow-wrap: normal;">\n' +
        "                                allow-filter.md\n" +
        "                            </div>\n" +
        "                        </div>\n" +
        "                    </div>\n" +
        "                </foreignObject>\n" +
        '                <text x="205" y="84" fill="rgb(0, 0, 0)" font-family="Helvetica" font-size="12px" text-anchor="middle">\n' +
        "                    allow-filter....\n" +
        "                </text>\n" +
        "            </switch>\n" +
        "        </g>\n" +
        '        <ellipse cx="450" cy="205" rx="40" ry="40" fill="rgb(255, 255, 255)" stroke="rgb(0, 0, 0)" pointer-events="all"/>\n' +
        '        <g transform="translate(-0.5 -0.5)">\n' +
        "            <switch>\n" +
        '                <foreignObject pointer-events="none" width="100%" height="100%" requiredFeatures="http://www.w3.org/TR/SVG11/feature#Extensibility" style="overflow: visible; text-align: left;">\n' +
        '                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: unsafe center; justify-content: unsafe center; width: 78px; height: 1px; padding-top: 205px; margin-left: 411px;">\n' +
        '                        <div data-drawio-colors="color: rgb(0, 0, 0); " style="box-sizing: border-box; font-size: 0px; text-align: center;">\n' +
        '                            <div style="display: inline-block; fo',
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: undefined,
  },
  "/all.json": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/all.json",
      ext: "json",
      prompt:
        "A script that fetches `all.json` and `new-filtered.json` and prepends `new-filtered.json` to `all.json`, in order of newest first.\n",
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: ["/new-filtered.json"],
  },
  "/index.html": {
    file: {
      branch: "main",
      repo: "shuffle-hackernews",
      owner: "codefromanywhere",
      path: "/index.html",
      ext: "html",
      prompt:
        "A script that fetches `all.json`, then returns a simple HTML website that loops over the items inthere and renders them nicely in a cardview.\n",
      private: true,
      deleted: false,
      updatedAt: 1726492549420,
    },
    hasChanges: true,
    dependencies: ["/all.json"],
  },
};

console.log(calculateWorkflow(files));
