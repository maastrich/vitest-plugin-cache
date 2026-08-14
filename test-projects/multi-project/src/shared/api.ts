import { Logger } from "./logger.js";

// Mock API client for testing
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
}

export class ApiClient {
  private logger: Logger;
  private baseUrl: string;

  constructor(baseUrl: string = "https://api.example.com") {
    this.baseUrl = baseUrl;
    this.logger = new Logger();
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    this.logger.debug(`GET ${this.baseUrl}${endpoint}`);

    // Mock implementation
    return {
      data: {} as T,
      status: 200,
      message: "Success",
    };
  }

  async post<T>(endpoint: string, data: unknown): Promise<ApiResponse<T>> {
    this.logger.debug(`POST ${this.baseUrl}${endpoint}`, data);

    // Mock implementation
    return {
      data: data as T,
      status: 201,
      message: "Created",
    };
  }

  getLogger(): Logger {
    return this.logger;
  }
}
