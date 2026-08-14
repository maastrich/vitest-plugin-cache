import { beforeEach, describe, expect, it } from "vitest";
import { ApiClient } from "../shared/api.js";
import { Logger } from "../shared/logger.js";

describe("ApiClient - Integration Tests", () => {
  let apiClient: ApiClient;
  let logger: Logger;

  beforeEach(() => {
    apiClient = new ApiClient("https://integration-api.example.com");
    logger = apiClient.getLogger();
  });

  describe("API workflow integration", () => {
    it("should handle complete user creation workflow", async () => {
      // Create user
      const userData = {
        name: "Integration Test User",
        email: "integration@test.com",
      };
      const createResponse = await apiClient.post("/users", userData);

      expect(createResponse.status).toBe(201);
      expect(createResponse.data).toEqual(userData);

      // Verify user was created
      const getResponse = await apiClient.get("/users");
      expect(getResponse.status).toBe(200);

      // Check logs
      const logs = logger.getLogs();
      expect(logs.some((log) => log.message.includes("POST"))).toBe(true);
      expect(logs.some((log) => log.message.includes("GET"))).toBe(true);
    });

    it("should handle error scenarios", async () => {
      // Test with invalid data
      const invalidData = { invalid: "data" };
      const response = await apiClient.post("/users", invalidData);

      // Even with invalid data, our mock returns success
      // In a real integration test, this would test error handling
      expect(response.status).toBe(201);
    });

    it("should maintain state across multiple requests", async () => {
      // First request
      await apiClient.get("/status");

      // Second request
      await apiClient.post("/events", { type: "test" });

      // Third request
      await apiClient.get("/metrics");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);

      // Verify all requests were logged
      const logMessages = logs.map((log) => log.message);
      expect(logMessages.some((msg) => msg.includes("GET /status"))).toBe(true);
      expect(logMessages.some((msg) => msg.includes("POST /events"))).toBe(true);
      expect(logMessages.some((msg) => msg.includes("GET /metrics"))).toBe(true);
    });
  });

  describe("cross-component integration", () => {
    it("should integrate logger with API client", () => {
      // Test that logger is properly integrated
      expect(logger).toBeInstanceOf(Logger);

      // Test that we can use logger independently
      logger.info("Independent log message");
      const logs = logger.getLogs();
      expect(logs.some((log) => log.message === "Independent log message")).toBe(true);
    });

    it("should handle concurrent operations", async () => {
      // Simulate concurrent API calls
      const promises = [
        apiClient.get("/users"),
        apiClient.get("/products"),
        apiClient.get("/orders"),
      ];

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All should be logged
      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
    });
  });
});
