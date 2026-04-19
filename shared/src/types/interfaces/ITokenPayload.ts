import { JwtPayload } from "jsonwebtoken";

export interface ITokenPayload extends JwtPayload {
    email: string;
    username: string;
    role: string;
    status: string;
}