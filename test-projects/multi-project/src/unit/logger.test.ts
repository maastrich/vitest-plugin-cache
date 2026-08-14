import { beforeEach, describe, expect, it } from "vitest";
import { LOG_LEVELS, Logger } from "../shared/logger.js";

describe("Logger - Unit Tests", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger();
  });

  describe("basic logging", () => {
    it("should log debug messages", () => {
      logger.debug("Debug message");
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LOG_LEVELS.DEBUG);
      expect(logs[0].message).toBe("Debug message");
    });

    it("should log info messages", () => {
      logger.info("Info message");
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LOG_LEVELS.INFO);
    });

    it("should log warn messages", () => {
      logger.warn("Warning message");
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LOG_LEVELS.WARN);
    });

    it("should log error messages", () => {
      logger.error("Error message");
      const logs = logger.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe(LOG_LEVELS.ERROR);
    });
  });

  describe("log management", () => {
    it("should track multiple logs", () => {
      logger.info("First message");
      logger.warn("Second message");
      logger.error("Third message");

      const logs = logger.getLogs();
      expect(logs).toHaveLength(3);
      expect(logs[0].message).toBe("First message");
      expect(logs[1].message).toBe("Second message");
      expect(logs[2].message).toBe("Third message");
    });

    it("should clear logs", () => {
      logger.info("Test message");
      expect(logger.getLogs()).toHaveLength(1);

      logger.clearLogs();
      expect(logger.getLogs()).toHaveLength(0);
    });

    it("should include timestamps", () => {
      const before = new Date();
      logger.info("Timestamp test");
      const after = new Date();

      const logs = logger.getLogs();
      expect(logs[0].timestamp).toBeInstanceOf(Date);
      expect(logs[0].timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(logs[0].timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });
});
