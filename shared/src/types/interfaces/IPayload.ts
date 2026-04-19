export interface IPayload {
    data: Record<string, any> | string;
    contentType: string; // MIME type, e.g., "application/json", "text/plain"
    size: number; // Size of the payload in bytes
    headers?: Record<string, string>; // Optional HTTP headers associated with the payload
}