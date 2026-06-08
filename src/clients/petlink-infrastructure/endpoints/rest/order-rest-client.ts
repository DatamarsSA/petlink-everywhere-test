import { logger } from "../../../../config/logger.js";

// Request types (mirror BE zod schema orderInput.ts)
export interface OrderAddressRequestInput {
  first_name: string;
  last_name: string;
  address: string;
  province: string;
  country: string;
  city: string;
  zip: string;
}

export interface OrderCustomerRequestInput {
  first_name: string;
  last_name: string;
  email: string;
  phone_prefix: string;
  phone: string;
}

export interface OrderLineItemRequestInput {
  external_item_id: string;
  amount: string;
  quantity: number;
  kippy_sku: string;
}

export interface OrderRequestInput {
  order_source: "PIDUS" | "KIPPYEU";
  external_order_id: number;
  external_order_name: string;
  status: string;
  customer: OrderCustomerRequestInput;
  total: string;
  currency: string;
  payment_method: string;
  ip: string;
  shipping_address: OrderAddressRequestInput;
  billing_address: OrderAddressRequestInput;
  line_items: OrderLineItemRequestInput[];
}

export interface OrderTrackingLineItem {
  kippy_item_id: number;
  imei?: string;
}

export interface OrderTrackingRequestInput {
  kippy_order_id: number;
  tracking_service: string;
  tracking_code: string;
  tracking_url: string;
  line_items: OrderTrackingLineItem[];
}

// Response types (mirror BE orderResponse.ts + DefaultResponse)
export interface LineItemResponse {
  external_item_id: string;
  kippy_item_id: number;
  quantity: number;
}

export interface OrderResponse {
  status: string;
  external_order_id?: number;
  kippy_order_id: number;
  subscription_available: boolean;
  subscription_url: string;
  line_items: LineItemResponse[];
}

export interface OrderTrackingResponse {
  status: string;
}

/**
 * REST client for Core Order Manager service (Basic Auth).
 */
export class OrderRestClient {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(baseUrl: string, username: string, password: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    logger.info(`[REST/ORDER] → POST ${path}`, { body });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`[REST/ORDER] POST ${path} failed: ${response.status} ${response.statusText} - ${text}`);
    }

    const data = (await response.json()) as T;
    logger.info(`[REST/ORDER] ← POST ${path}`, { data });
    return data;
  }

  /**
   * Create a new order (prepaid or standard).
   * Country: 'us' → PETLINK, 'eu' → KIPPY.
   */
  async createOrder(country: "us" | "eu", input: OrderRequestInput): Promise<OrderResponse> {
    return this.post<OrderResponse>(`/api/${country}/v1/order`, input);
  }

  /**
   * Update order with tracking info and real serial numbers.
   * Country: 'us' → PETLINK, 'eu' → KIPPY.
   */
  async trackOrder(country: "us" | "eu", input: OrderTrackingRequestInput): Promise<OrderTrackingResponse> {
    return this.post<OrderTrackingResponse>(`/api/${country}/v1/order-tracking`, input);
  }
}
