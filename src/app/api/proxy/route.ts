import { NextRequest, NextResponse } from "next/server";
import axios, { AxiosError } from "axios";

interface ProxyRequest {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  time: number;
  size: number;
}

// Headers that browsers restrict and shouldn't be forwarded
const RESTRICTED_HEADERS = [
  "host",
  "origin",
  "referer",
  "connection",
  "content-length",
];

export async function POST(request: NextRequest) {
  try {
    const body: ProxyRequest = await request.json();
    const { method, url, headers = {}, body: requestBody } = body;

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Filter out restricted headers
    const filteredHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!RESTRICTED_HEADERS.includes(key.toLowerCase())) {
        filteredHeaders[key] = value;
      }
    }

    const startTime = Date.now();

    // Handle form data body types
    let finalBody = requestBody;
    if (
      requestBody &&
      typeof requestBody === "object" &&
      "_formData" in requestBody &&
      "_formMode" in requestBody
    ) {
      const { _formData, _formMode } = requestBody as {
        _formData: Record<string, string>;
        _formMode: string;
      };

      if (_formMode === "x-www-form-urlencoded") {
        // Convert to URL encoded string
        finalBody = new URLSearchParams(_formData).toString();
        filteredHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      } else if (_formMode === "form-data") {
        // For multipart/form-data, axios handles FormData automatically
        const formData = new FormData();
        for (const [key, value] of Object.entries(_formData)) {
          formData.append(key, value);
        }
        finalBody = formData;
        // Don't set Content-Type for form-data, axios will set it with boundary
        delete filteredHeaders["Content-Type"];
      }
    }

    const response = await axios({
      method,
      url,
      headers: filteredHeaders,
      data: finalBody,
      validateStatus: () => true, // Don't throw on any status code
    });

    const endTime = Date.now();

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(response.headers)) {
      if (typeof value === "string") {
        responseHeaders[key] = value;
      } else if (Array.isArray(value)) {
        responseHeaders[key] = value.join(", ");
      }
    }

    // Calculate response size
    const dataString = JSON.stringify(response.data);
    const size = new TextEncoder().encode(dataString).length;

    const apiResponse: ApiResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      data: response.data,
      time: endTime - startTime,
      size,
    };

    return NextResponse.json(apiResponse);
  } catch (error) {
    // Handle network errors gracefully
    if (error instanceof AxiosError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 200 } // Return 200 so client can display the error
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 200 }
    );
  }
}
