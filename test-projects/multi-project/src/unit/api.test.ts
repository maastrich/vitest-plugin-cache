import { beforeEach, describe, expect, it } from "vitest";
import { ApiClient } from "../shared/api.js";

describe("ApiClient - Unit Tests", () => {
  let apiClient: ApiClient;

  beforeEach(() => {
    apiClient = new ApiClient("https://test-api.example.com");
  });

  describe("initialization", () => {
    it("should initialize with default base URL", () => {
      const client = new ApiClient();
      expect(client).toBeDefined();
    });

    it("should initialize with custom base URL", () => {
      const customUrl = "https://custom-api.example.com";
      const client = new ApiClient(customUrl);
      expect(client).toBeDefined();
    });
  });

  describe("GET requests", () => {
    it("should make GET requests", async () => {
      const response = await apiClient.get("/users");
      expect(response.status).toBe(200);
      expect(response.message).toBe("Success");
    });

    it("should handle different endpoints", async () => {
      const response = await apiClient.get("/products/123");
      expect(response.status).toBe(200);
    });
  });

  describe("POST requests", () => {
    it("should make POST requests with data", async () => {
      const testData = { name: "Test User", email: "test@example.com" };
      const response = await apiClient.post("/users", testData);

      expect(response.status).toBe(201);
      expect(response.message).toBe("Created");
      expect(response.data).toEqual(testData);
    });

    it("should handle empty POST data", async () => {
      const response = await apiClient.post("/users", {});
      expect(response.status).toBe(201);
    });
  });

  describe("logging integration", () => {
    it("should have access to logger", () => {
      const logger = apiClient.getLogger();
      expect(logger).toBeDefined();
    });

    it("should log API calls", async () => {
      await apiClient.get("/test");
      const logger = apiClient.getLogger();
      const logs = logger.getLogs();

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log) => log.message.includes("GET"))).toBe(true);
    });
  });
});
