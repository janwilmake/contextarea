Yes, you can get frontmatter IntelliSense in VS Code for your `.task.md` files! Here are several approaches:

First, install the **YAML** extension by Red Hat if you haven't already.

Then add this to your (user or workspace) VS Code settings:

```json path="settings.json"
{
  "yaml.schemas": {
    "https://markdownops.com/task.schema.json": ["*.task.md", "**/*.task.md"]
  },
  "files.associations": {
    "*.task.md": "markdown"
  }
}
```

Alternatively, you can add a schema reference directly in your `.task.md` files' frontmatter:

```markdown path="example.task.md"
---
# yaml-language-server: $schema=https://markdownops.com/task.schema.json
processor: base
---

# Task Content

Your markdown content here...
```

**Restart VS Code** after making these changes

The frontmatter IntelliSense should now work with autocompletion, validation, and hover documentation based on your schema!
