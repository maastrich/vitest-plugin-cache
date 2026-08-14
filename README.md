# Vitest Plugin Cache

A Vitest plugin that caches test results based on import trees, supporting both single and multiple project configurations.

## Features

- **Import Tree Analysis**: Analyzes file dependencies to determine when tests need to be re-run
- **Multi-Project Support**: Works with both single and multiple Vitest project configurations
- **Cache Invalidation**: Automatically invalidates cache when dependencies change
- **Cross-Project Caching**: Optional caching across different test projects
- **Performance Optimization**: Reduces test execution time by skipping unchanged tests

## Installation

```bash
npm install @maastrich/vitest-plugin-cache
# or
pnpm add @maastrich/vitest-plugin-cache
# or
yarn add @maastrich/vitest-plugin-cache
```

## Usage

### Basic Setup

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";
import { vitestCache } from "@maastrich/vitest-plugin-cache";

export default defineConfig({
  plugins: [
    vitestCache({
      cacheDir: ".vitest-cache",
      enableInvalidation: true,
      crossProjectCache: false,
    }),
  ],
  test: {
    globals: true,
    environment: "node",
  },
});
```

### Advanced Configuration

```typescript
import { defineConfig } from "vitest/config";
import { vitestCache } from "@maastrich/vitest-plugin-cache";

export default defineConfig({
  plugins: [
    vitestCache({
      cacheDir: ".vitest-cache",
      enableInvalidation: true,
      crossProjectCache: true,
      hashFunction: (content) => {
        // Custom hash function
        return require("crypto").createHash("sha256").update(content).digest("hex");
      },
    }),
  ],
  test: {
    globals: true,
    environment: "node",
    projects: [
      {
        name: "unit",
        testMatch: ["**/unit/**/*.test.ts"],
      },
      {
        name: "integration",
        testMatch: ["**/integration/**/*.test.ts"],
      },
    ],
  },
});
```

## Configuration Options

| Option               | Type                          | Default                       | Description                                     |
| -------------------- | ----------------------------- | ----------------------------- | ----------------------------------------------- |
| `cacheDir`           | `string`                      | `'.vitest-cache'`             | Directory to store cache files                  |
| `enableInvalidation` | `boolean`                     | `true`                        | Enable cache invalidation based on file changes |
| `crossProjectCache`  | `boolean`                     | `false`                       | Enable caching across different test projects   |
| `hashFunction`       | `(content: string) => string` | `crypto.createHash('sha256')` | Custom hash function for cache keys             |

## How It Works

1. **Import Analysis**: The plugin analyzes each test file's import tree to understand dependencies
2. **Cache Key Generation**: Creates unique cache keys based on file content and import dependencies
3. **Cache Storage**: Stores test results with metadata about dependencies
4. **Invalidation**: Automatically invalidates cache when any dependency file changes
5. **Result Retrieval**: Returns cached results for unchanged tests

## Test Projects

This repository includes test projects to demonstrate and validate the plugin:

### Single Project Test

Located in `test-projects/single-project/`, this demonstrates basic plugin usage with a single test configuration.

```bash
cd test-projects/single-project
pnpm install
pnpm test
```

### Multi-Project Test

Located in `test-projects/multi-project/`, this demonstrates plugin usage with multiple test projects (unit, integration, e2e).

```bash
cd test-projects/multi-project
pnpm install
pnpm test
```

## API

### VitestCachePlugin Class

For advanced usage, you can access the cache plugin instance directly:

```typescript
import { VitestCachePlugin } from "@maastrich/vitest-plugin-cache";

const cachePlugin = new VitestCachePlugin({
  cacheDir: ".custom-cache",
  enableInvalidation: true,
});

// Get cached result
const result = await cachePlugin.getCachedResult("test-file.ts", "project-name");

// Set cached result
await cachePlugin.setCachedResult("test-file.ts", "project-name", testResult);

// Clear cache
cachePlugin.clearCache();

// Get cache statistics
const stats = cachePlugin.getCacheStats();
```

## Development

### Building

```bash
pnpm build
```

### Testing

```bash
# Test the plugin itself
pnpm test

# Test with single project
cd test-projects/single-project && pnpm test

# Test with multi-project
cd test-projects/multi-project && pnpm test
```

### Development Mode

```bash
pnpm dev
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
