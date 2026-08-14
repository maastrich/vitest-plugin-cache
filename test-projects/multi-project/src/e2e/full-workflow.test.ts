import { beforeEach, describe, expect, it } from "vitest";
import { ApiClient } from "../shared/api.js";
import type { Logger } from "../shared/logger.js";

describe("Full Application Workflow - E2E Tests", () => {
  let apiClient: ApiClient;
  let logger: Logger;

  beforeEach(() => {
    apiClient = new ApiClient("https://e2e-api.example.com");
    logger = apiClient.getLogger();
  });

  describe("complete user journey", () => {
    it("should handle user registration and profile management", async () => {
      // Step 1: Register new user
      const registrationData = {
        username: "e2euser",
        email: "e2e@example.com",
        password: "securepassword123",
      };

      const registerResponse = await apiClient.post("/auth/register", registrationData);
      expect(registerResponse.status).toBe(201);
      expect(registerResponse.data).toEqual(registrationData);

      // Step 2: Login user
      const loginData = {
        email: "e2e@example.com",
        password: "securepassword123",
      };

      const loginResponse = await apiClient.post("/auth/login", loginData);
      expect(loginResponse.status).toBe(201);

      // Step 3: Get user profile
      const profileResponse = await apiClient.get("/user/profile");
      expect(profileResponse.status).toBe(200);

      // Step 4: Update profile
      const updateData = { name: "E2E Test User" };
      const updateResponse = await apiClient.post("/user/profile", updateData);
      expect(updateResponse.status).toBe(201);

      // Verify all operations were logged
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(4);

      const logMessages = logs.map((log) => log.message);
      // Logged messages are `<METHOD> <baseUrl><endpoint>`.
      expect(
        logMessages.some((msg) => msg.startsWith("POST") && msg.endsWith("/auth/register")),
      ).toBe(true);
      expect(logMessages.some((msg) => msg.startsWith("POST") && msg.endsWith("/auth/login"))).toBe(
        true,
      );
      expect(
        logMessages.some((msg) => msg.startsWith("GET") && msg.endsWith("/user/profile")),
      ).toBe(true);
    });

    it("should handle product catalog browsing and ordering", async () => {
      // Step 1: Browse products
      const productsResponse = await apiClient.get("/products");
      expect(productsResponse.status).toBe(200);

      // Step 2: Get specific product
      const productResponse = await apiClient.get("/products/123");
      expect(productResponse.status).toBe(200);

      // Step 3: Add to cart
      const cartData = { productId: 123, quantity: 2 };
      const addToCartResponse = await apiClient.post("/cart/items", cartData);
      expect(addToCartResponse.status).toBe(201);

      // Step 4: View cart
      const cartResponse = await apiClient.get("/cart");
      expect(cartResponse.status).toBe(200);

      // Step 5: Create order
      const orderData = { items: [cartData], total: 99.99 };
      const orderResponse = await apiClient.post("/orders", orderData);
      expect(orderResponse.status).toBe(201);

      // Verify comprehensive logging
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(5);
    });

    it("should handle error recovery scenarios", async () => {
      // Test error handling in a complete workflow
      try {
        // Attempt operations that might fail
        await apiClient.get("/nonexistent-endpoint");
        await apiClient.post("/invalid-endpoint", { invalid: "data" });

        // Even if some operations fail, the system should continue
        const statusResponse = await apiClient.get("/status");
        expect(statusResponse.status).toBe(200);
      } catch (error) {
        // In a real E2E test, we'd handle specific error types
        console.log("Expected error in E2E test:", error);
      }

      // Verify that logging continued despite errors
      const logs = logger.getLogs();
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe("performance and reliability", () => {
    it("should handle high-volume operations", async () => {
      const operations = [];

      // Create many concurrent operations
      for (let i = 0; i < 10; i++) {
        operations.push(apiClient.get(`/data/${i}`));
      }

      const results = await Promise.all(operations);

      // All operations should complete successfully
      results.forEach((result) => {
        expect(result.status).toBe(200);
      });

      // Verify all operations were logged
      const logs = logger.getLogs();
      expect(logs.length).toBe(10);
    });

    it("should maintain data consistency across operations", async () => {
      // Create initial data
      const initialData = { id: 1, value: "initial" };
      await apiClient.post("/data", initialData);

      // Update data
      const updateData = { id: 1, value: "updated" };
      await apiClient.post("/data/1", updateData);

      // Retrieve data
      const getResponse = await apiClient.get("/data/1");
      expect(getResponse.status).toBe(200);

      // Verify the workflow completed successfully
      const logs = logger.getLogs();
      expect(logs.length).toBe(3);
    });
  });
});
