import { JwtPayload } from "jsonwebtoken";

export interface ITokenPayload extends JwtPayload {
    email: string;
    name?: string;
    username: string;
    elo?: number;
    role: string;
    status: string;
}
